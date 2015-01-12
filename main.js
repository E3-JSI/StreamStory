var config = require('./config.js');
var services = require('./src/services.js');
var mc = require('./src/init_mc.js');
var qm = require(qmModulePath + 'qm.node');

var readOnly = config.qmReadOnly;
var qmConfFile = config.qmConfFile;

// global functions
global.closeBase = function () {
	log.info('Closing base ...');
	
	if (!readOnly && base != null) {
		base.gc();
		base.close();
	}
		
	
	log.info('Done!');
};

try {
	log.info('Opening base with configuration: %s ...', qmConfFile);
	
	// global variables
	global.base = qm.open(qmConfFile, true/*readOnly*/);
	
//	base.store('drilling').clear();
//	log.info('Store cleared :) !');
//	closeBase();
//	log.info('Done!');
//	return;
	
	global.hmc = mc.init();
	
	services.init();
	
	require('./src/replay.js').replay();
} catch (e) {
	log.error(e, 'Exception in main!');
	closeBase();
	process.exit(1);
}