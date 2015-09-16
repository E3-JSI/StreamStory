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
	
	dateToQmDate: function (date) {
		return date.toISOString().split('Z')[0];
	},
	
	isFinite: function (num) {
		return !isNaN(num) && isFinite(num);
	},
	
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
	},
	
	createDirSync: function (dir) {
		if (!fs.existsSync(dir)) {
			log.info('Creating directory %s ...', dir);
			mkdirp.sync(dir);
		}
	},
	
	clone: function (obj) {
		return JSON.parse(JSON.stringify(obj));
	}
}