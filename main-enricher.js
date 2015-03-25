var config = require('./config.js');
var pipeline = require('./src/pipeline.js');
var utils = require('./src/utils.js');

var qmConfFile = 'config/ProaSense/qm-enricher.conf';
var schemmaFile = 'config/ProaSense/enricher.def';

var base;

try {
	// create a new qminer DB
	log.info('Creating QMiner database using configuration %s ...', qmConfFile);
	base = qm.create(qmConfFile, schemmaFile, true);
	pipeline.initEnricher({ base: base, fields: config.getFieldConfig(base) });
} catch (e) {
	log.error(e, 'Exception in main!');
	utils.exit(base);
}