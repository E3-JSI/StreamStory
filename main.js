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
		var fieldConfig = config.getFieldConfig(base);
		
		var hmc = mc.init({
			base: base,
			endsBatchV: opts.endsBatchV,
			fieldConfig: fieldConfig
		});
	
		if (QM_CREATE_PIPELINE) 
			pipeline.init({ base: base, fieldConfig: fieldConfig });
		
		services.init(hmc, base);
		
		if (REPLAY_DATA)
			require('./src/replay.js').replayHmc(hmc);
	} catch (e) {
		log.error(e, 'Failed to create services!');
		utils.exit(base);
	}
}

try {
	if (QM_CREATE_DB) {
		config.createDb(function (e, result) {
			if (e != null) {
				log.error(e, 'Failed to create base object, exiting application ...');
				exit();
			}
			initServices({base: result.base, endsBatchV: result.endsBatchV});
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