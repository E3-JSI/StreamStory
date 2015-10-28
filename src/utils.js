var fs = require('fs');
var mkdirp = require('mkdirp');
var config = require('../config.js');

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
// EXPORTS
//=============================================

module.exports = {
	closeBase: closeBase,
	exit: exit,
	
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
	
	clone: function (obj) {
		return JSON.parse(JSON.stringify(obj));
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