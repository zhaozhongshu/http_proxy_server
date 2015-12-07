'use strict';
var fs = require('fs');

function Logger(filename){
	var fd;
	var pendings = [];
    try {
        if (filename) {
            fd = fs.openSync(filename, 'a+');
        }
	}
	catch(err){
		console.log(__filename + ' Logger open ' + err);
	}
	return function () {
        if (!fd) {
            process.stdout.write(Array.prototype.slice.apply(arguments).join() + '\r\n');
			return;
		}
		pendings.push(Array.prototype.slice.apply(arguments).join() + '\r\n');

		if( pendings.length > 1 ){
			return;
		}
		
		fs.write(fd, pendings[0], function  cb(err) {
			if( err ){
				console.log('fs.write ' + err);
				pendings = [];
				return;
			}
			pendings.shift();
			if(pendings.length != 0){
				fs.write(fd, pendings[0], cb);
			}
		});
	}
};

module.exports = Logger;