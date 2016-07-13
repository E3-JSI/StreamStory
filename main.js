var config = require('./config.js');
var services = require('./src/services.js');
var pipeline = require('./src/pipeline.js');
var utils = require('./src/utils.js');
var fields = require('./fields.js');
var db = require('./src/db/mysqldb.js')();

function hackClasses() {
	if (!String.prototype.startsWith) {
		String.prototype.startsWith = function(searchString, position) {
			position = position || 0;
	    	return this.indexOf(searchString, position) === position;
	  	};
	}
	if (!String.prototype.endsWith) {
		String.prototype.endsWith = function(searchString, position) {
			var subjectString = this.toString();
			if (position === undefined || position > subjectString.length) {
				position = subjectString.length;
			}
			position -= searchString.length;
			var lastIndex = subjectString.indexOf(searchString, position);
			return lastIndex !== -1 && lastIndex === position;
		};
	}
}

var base;

try {
	hackClasses();
	
	var schema = fields.getQmSchema();
	
	log.info('Opening database ...');
	if (log.trace())
		log.trace('Using the following schema: %s', JSON.stringify(schema));
	
	base = new qm.Base({
		dbPath: config.REAL_TIME_BASE_PATH,
		schema: schema,
		mode: config.QM_DATABASE_MODE,
		strictNames: false
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