var config = require('./config.js');
var services = require('./src/services.js');
var mc = require('./src/init_mc.js');
var pipeline = require('./src/pipeline.js');

// global functions and variables
global.base = null;

global.closeBase = function () {
	log.info('Closing base ...');
	
	if (!QM_READ_ONLY && base != null) {
		base.gc();
		base.close();
	}
	
	log.info('Done!');
};

try {
	if (QM_CREATE_DB) {	
		// create a new qminer DB
		log.info('Creating QMiner database using configuration %s ...', QM_CONF_FILE);
		global.base = qm.create(QM_CONF_FILE, QM_SCHEMA_FILE, true);
	} else {	
		// load qminer DB
		log.info('Opening base with configuration: %s ...', QM_CONF_FILE);
		global.base = qm.open(QM_CONF_FILE, QM_READ_ONLY);
	}
	
	global.hmc = mc.init();

	pipeline.init();
	services.init();
	
	if (REPLAY_DATA)
		require('./src/replay.js').replayHmc();
} catch (e) {
	log.error(e, 'Exception in main!');
	closeBase();
	process.exit(1);
}