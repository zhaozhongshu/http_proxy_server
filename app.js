
'use strict';

var http = require('http');
var util = require('util');
var url = require('url');
var net = require('net');
var Logger = require('./logger.js');

var log = new Logger(__filename + '.log');

var httpServer = http.createServer();
httpServer.on('checkContinue', function (req, resp) {
    // 100-Continue
    log('checkContinue');
    response.writeContinue();
});

httpServer.on('clientError', function (exception, socket) {
    log('client emit error ' + exception);
});

httpServer.on('close', function (argument) {
    log('server close');
});

httpServer.on('connect', function (request, socket, head) {
    // request: http request object
    // socket: connection
    // head: first packet Buffer
    log('CONNECT ' + request.url);
    if (!request.url) {
        socket.write('HTTP/1.1 500 Bad URL\r\n\r\n', function (argument) {
            socket.end();
        });
        return;
    }
    var target = request.url.split(':');
    if (target.length == 1) {
        target.push(80);
    }
    else if (target.length > 2) {
        socket.write('HTTP/1.1 500 Bad URL\r\n\r\n', function (argument) {
            socket.end();
        });
        return;
    }
    // connect server
    var s_socket = net.connect(target[1], target[0]);

    // lookup event
    s_socket.on('lookup', function (err, address, family) {
        if (err) {
            log('DNS lookup error');
        }
        else {
            log('DNS lookup ' + target[0] + ' --> ' + address);
        }
    });

    var connecting = true;

    s_socket.on('connect', function () {
        connecting = false;
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        if (head.length) {
            s_socket.write(head);
        }
        s_socket.pipe(socket);
        socket.pipe(s_socket);
    });

    s_socket.on('end', function () {
        log('server end');
    });

    s_socket.on('error', function (err) {
        if( !connecting ){
            return;
        }
        log('server error ' + err);
        var message = '' + err;
        socket.write(
            'HTTP/1.1 404 Connect Error\r\n' + 
            'Content-Length: ' + message.length + '\r\n' +
            'Connection: Close\r\n' +
            '\r\n' + 
            message,
            function () { 
                socket.end();
            });
    });
    
    s_socket.on('timeout', function (err) {
        log('server error ' + err);
        socket.end();
    });

    socket.on('end', function () {
        log('client end');
        s_socket.end();
    });

    socket.on('error', function (err) {
        log('client error ' + err);
        s_socket.end();
    });

    socket.on('timeout', function (err) {
        log('client error ' + err);
        s_socket.end();
    });
});

httpServer.on('connection', function (socket) {
    // log('new socket connect');
});
// req:ServerRequest
// resp:ServerResponse
httpServer.on('request', function (req, resp) {
    // http request: header only 
    // get post data listen 'data' + 'end' event
    log('request ' + req.url);
    var target = url.parse(req.url);
    if (!target || !target.hostname) {
       var datas = [];
       datas.push(req.url);
       datas.push('\r\n');
       datas.push(util.inspect(req.headers));
       datas.push('\r\n');

       var message = datas.join();
       resp.writeHead(200, {
           'Content-Length': message.length, 
           'Content-Type': 'text/plain'
       });
       resp.end(message);
       return; 
    }

    // console.log(req.url);
    // console.log(util.inspect(target));

    // filter some http header
    var newHeaders = {};
    Object.keys(req.headers).forEach(function (key) {
        if( key.toLowerCase() == 'proxy-connection' ){
            newHeaders['Connection'] = req.headers[key];
        }
        else{
            newHeaders[key] = req.headers[key];
        }
    });

    // new request
    var s_req = http.request({
        hostname: target.host,
        port: target.port ? target.port : 80,
        method: req.method,
        path: target.path,
        headers: newHeaders,
        auth: target.auth
    });

    s_req.on('response', function (s_resp) {
        // s_resp : IncomingMessage
        // console.log('resp '+ s_resp.statusCode);
        // console.log('resp '+ util.inspect(s_resp.headers));

        resp.writeHead(s_resp.statusCode, s_resp.headers);
        s_resp.pipe(resp);
        s_resp.on('end', function () {
            resp.end();
            // console.log('proxy done '+req.url);
        });
    });
    s_req.on('socket', function (socket) {
        // body...
    });
    s_req.on('error', function (err) {
        console.log('proxy '+req.url+' error:' + err);
        resp.end();
    });

    // 发送body
    req.pipe(s_req);

    req.on('end', function () {
        s_req.end();
    });

    // 
    // resp.writeHead(200);
    // resp.end(
    //     'target\r\n'+util.inspect(target)+
    //     'real\r\n'+util.inspect(req.headers)+
    //     'new\r\n'+util.inspect(newHeaders));
});

httpServer.on('upgrade', function (req, socket, head) {
    // req : http request
    // socket: 
    // head : upgrade data Buffer
    log('upgrade ');
});

// httpServer.on('listening', function());
httpServer.listen(8080, function () {
    log('http proxy on http://localhost:8080');
});
