var crypto = require('crypto');
var randomstring = require('randomstring');
var nodemailer = require('nodemailer');
var dateformat = require('dateformat');
var fs = require('fs');
var mkdirp = require('mkdirp');
var config = require('../config.js');

var UI_DATE_FORMAT = 'dd/mm/yyyy';
var HASH_ALG = 'sha256';

var emailTransporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'sometestemail9@gmail.com',
        pass: 'testemailpassword'
    }
});

//=============================================
// EXIT FUNCTIONS
//=============================================

function closeBase(base) {
	log.info('Closing base ...');
	
	if (base != null) {
		log.info('Closing ...');
		base.garbageCollect()
		base.close();
	}
	
	log.info('Done!');
}

function exit(base) {
	log.info('Closing application ...');
	closeBase(base);
	process.exit(1);
}

//=============================================
// HELPER FUNCTIONS
//=============================================

function isValidDate(d) {
	if (Object.prototype.toString.call(d) === "[object Date]") {
		// it is a date
		if (isNaN(d.getTime())) {  // d.valueOf() could also work
			return false;
		}
		else {
			var currYear = new Date().getFullYear();
			var year = d.getFullYear();
			
			if (Math.abs(currYear - year) > 150)
				return false;
			else
				return true;
		}
	}
	else {
		return false;
	}
}

//=============================================
// EXPORTS
//=============================================

module.exports = {
	closeBase: closeBase,
	exit: exit,
	
	//=============================================
	// PASSWORDS
	//=============================================
	
	hashPassword: function (password) {
		var hash = crypto.createHash(HASH_ALG);
		
		if (hash == null)
			throw new Error('Algorithm ' + HASH_ALG + ' is not available!');
		
		hash.update(password, 'utf-8');
		return hash.digest('hex');
	},
	genPassword: function () {
		return randomstring.generate({ length: 8, readable: true });
	},
	
	sendEmail: function (opts, callback) {
		var text = 'Dear ' + opts.email + '\n\n' +
					'Your new password is: ' + opts.password + '\n\n' +
					'Best,\n' +
					'StreamStory team';
		
		var mailOptions = {
		    from: 'StreamStory <luka.stopar@ijs.si>', // sender address
		    to: opts.email, // list of receivers
		    subject: 'StreamStory', // Subject line
		    text: text, // plaintext body
//		    html: '<b>Hello world ✔</b>' // html body
		};
		
		emailTransporter.sendMail(mailOptions, function (e, info){
		    if (e != null) {
		    	callback(e);
		        return;
		    }
		    
		    log.info('Message sent: %s', JSON.stringify(info));
		    callback();
		});
	},
	
	//=============================================
	// DIRECTORIES
	//=============================================
	
	getUserDir: function (username) {
		return config.USER_BASES_PATH + username;
	},
	
	getBaseDir: function (username, timestamp) {
		return module.exports.getUserDir(username) + '/' + timestamp;
	},
	
	getDbDir: function (baseDir) {
		return baseDir + '/db';
	},
	
	getModelFName: function (baseDir) {
		return baseDir + '/StreamStory.bin';
	},
	
	//=============================================
	// HELPER FUNCTIONS
	//=============================================
	dateformat: function (date) {
		if (!isValidDate(date)) return "Invalid date!";
		return dateformat(date, UI_DATE_FORMAT);
	},
	
	dateToQmDate: function (date) {
		return date.toISOString().split('Z')[0];
	},
	
	isFinite: function (num) {
		return !isNaN(num) && isFinite(num);
	},
	
	createDirSync: function (dir) {
		if (!fs.existsSync(dir)) {
			log.info('Creating directory %s ...', dir);
			mkdirp.sync(dir);
		}
	},
	
	appendLine: function (fname, line) {
		try {
			var fd = fs.openSync(fname, 'a');
			fs.writeSync(fd, line + '\n');
			fs.closeSync(fd);
			
			if (log.trace())
				log.trace('Appended to file!');
			
		} catch (e) {
			log.error(e, 'Failed to append to file %s', fname);
		}
	},
	
	clone: function (obj) {
		if (obj == undefined) return undefined;
		if (obj == null) return null;
		return JSON.parse(JSON.stringify(obj));
	},

    //=============================================
    // WEB SERVER RESONSE HANDLERS
    //=============================================

    handleNoContent: function (req, res) {
        res.status(204);	// no content
        res.end();
    },
    
    handleNoPermission: function (req, res) {
        if (log.debug())
            log.debug('No permission, blocking page!');

        res.status(404);	// not found
        res.send('Cannot GET ' + req.path);
        res.end();
    },

    handleServerError: function (e, req, res) {
        log.error(e, 'Exception while processing request!');
        res.status(500);	// internal server error
        res.send(e.message);
        res.end();
    },

    handleBadInput: function (res, msg) {
        res.status(400);	// bad request
        res.send(msg);
        res.end();
    },

    handleBadRequest: function (req, res, msg) {
        if (log.debug())
            log.debug('Bad request, blocking page!');

        res.status(404);	// bad request
        res.send(msg != null ? msg : 'Bad request ' + req.path);
        res.end();
    },
	
	//=============================================
	// HELPER CLASSES
	//=============================================
	
	RecBuffer: function (size) {
		var buff = [];
		
		this.add = function (rec) {
			buff.unshift(rec);
			while (buff.length > size) 
				buff.pop();
		};
		
		this.getLast = function () {
			return buff.length > 0 ? buff[0] : null;
		}
		
		this.clear = function () {
			buff = [];
		};
	}
}
