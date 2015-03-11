var config = require('./config.js');
var services = require('./src/services.js');
var mc = require('./src/init_mc.js');
var pipeline = require('./src/pipeline.js');
var utils = require('./src/utils.js');

// global functions and variables
var base = null;

function initServices(opts) {
	base = opts.base;
	
	try {
		global.QM_FIELDS = config.getFieldConfig(base);
		
		var hmc = mc.init({
			base: base,
			endsBatchV: opts.endsBatchV
		});
	
		if (QM_CREATE_PIPELINE) pipeline.init(base);
		
		services.init(hmc, base);
		
		if (REPLAY_DATA)
			require('./src/replay.js').replayHmc(hmc);
	} catch (e) {
		log.error(e, 'Failed to create services!');
		exit();
	}
}

try {
	if (QM_CREATE_DB) {
		config.createDb(function (e, base) {
			if (e != null) {
				log.error(e, 'Failed to create base object, exiting application ...');
				exit();
			}
			initServices({base: base});
		});
	} else {	
		// load qminer DB
		log.info('Opening base with configuration: %s ...', QM_CONF_FILE);
		var base = qm.open(QM_CONF_FILE, QM_READ_ONLY);
		initServices({base: base});
	}
} catch (e) {
	log.error(e, 'Exception in main!');
	utils.exit(base);
}