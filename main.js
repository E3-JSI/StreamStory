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

function exit() {
	closeBase();
	process.exit(1);
}

function initServices(opts) {
	global.base = opts.base;
	
	try {
		global.QM_FIELDS = config.getFieldConfig(base);
		
		var hmc = mc.init({
			endsBatchV: opts.endsBatchV
		});
	
		if (QM_CREATE_PIPELINE) pipeline.init();
		
		services.init(hmc);
		
		if (REPLAY_DATA)
			require('./src/replay.js').replayHmc(hmc);
	} catch (e) {
		log.error(e, 'Failed to create services!');
		exit();
	}
}

try {
	if (QM_CREATE_DB) {
		config.createDb(function (e, result) {
			if (e != null) {
				log.error(e, 'Failed to create base object, exiting application ...');
				exit();
			}
			initServices(result);
		});
	} else {	
		// load qminer DB
		log.info('Opening base with configuration: %s ...', QM_CONF_FILE);
		var base = qm.open(QM_CONF_FILE, QM_READ_ONLY);
		initServices({base: base});
	}
} catch (e) {
	log.error(e, 'Exception in main!');
	closeBase();
	process.exit(1);
}