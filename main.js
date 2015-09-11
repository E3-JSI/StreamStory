var config = require('./config.js');
var services = require('./src/services.js');
var pipeline = require('./src/pipeline.js');
var utils = require('./src/utils.js');
var fields = require('./fields.js');
var db = require('./src/dbaccess.js')();

try {
	var schema = fields.getQmSchema();
	
	log.info('Opening base with the following schema: %s', JSON.stringify(schema));
	
	var base = new qm.Base({
		dbPath: config.REAL_TIME_BASE_PATH,
		schema: schema,
		mode: config.QM_DATABASE_MODE
	});

	if (config.QM_CREATE_PIPELINE) {
		log.info('Initializing pipeline ...');
		pipeline.init({ base: base, db: db });
	}
	
	services.init({ base: base, pipeline: pipeline, db: db });
	
	log.info('Registering signal handlers ...');
	log.info('Registering SIGINT handler ...');
	process.on("SIGINT", function () {
		utils.exit(base);
	});
} catch (e) {
	log.error(e, 'Exception in main!');
	utils.exit(base);
}