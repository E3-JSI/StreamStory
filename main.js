var config = require('./config.js');
var services = require('./src/services.js');
var mc = require('./src/init_mc.js');
var pipeline = require('./src/pipeline.js');
var qm = require(qmModulePath + 'qm.node');

var readOnly = config.qmReadOnly;
var qmConfFile = config.qmConfFile;

// global functions and variables
global.base = null;

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
	
	// initialize
	global.base = qm.open(qmConfFile, readOnly);
	
	pipeline.init();
	global.hmc = mc.init();
	
	services.init();
	
	require('./src/replay.js').replayHmc();
} catch (e) {
	log.error(e, 'Exception in main!');
	closeBase();
	process.exit(1);
}