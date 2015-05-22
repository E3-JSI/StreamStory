var fs = require('fs');
var bunyan = require('bunyan');
var logformat = require('bunyan-format');

var confFile = process.argv[2];

console.log('Reading configuration file: ' + confFile);
var configStr = fs.readFileSync(confFile);
var config = JSON.parse(configStr);

var projectConfig = require(config.config.jsFile)

//================================================================
// LOG
//================================================================
global.log = bunyan.createLogger({
	name: 'ProaSense',
	stream: logformat({ 
		outputMode: 'short',
		out: process.stdout
	}),
	level: config.log.level
});

//================================================================
// SERVER
//================================================================
global.SERVER_PORT = config.server.port;
global.WWW_DIR = '../ui';
global.PING_INTERVAL = config.server.pingInterval;

//================================================================
// QMINER
//================================================================
global.QM_MODULE_PATH = config.qminer.path;
global.QM_READ_ONLY = config.qminer.readOnly;
global.QM_CONF_FILE = config.qminer.confFile;
global.QM_SCHEMA_FILE = config.qminer.schemaFile;
global.QM_CREATE_DB = config.qminer.createDb;
global.QM_CREATE_PIPELINE = config.qminer.createPipeline;

global.qm = require(QM_MODULE_PATH);

//================================================================
// REPLAY
//================================================================
global.REPLAY_DATA = config.replay;

//================================================================
// STREAM STORY
//================================================================
exports.STREAM_STORY_STORE = projectConfig.hmcStoreName;
exports.STREAM_STORY_FNAME = config.models.SSFName;

//global.CTMC_DIR_NAME = config.models.dir;
global.CTMC_TIME_FIELD_ID = projectConfig.hmcTimeField;
global.CTMC_SEQUENCE_CATEGORY = projectConfig.hmcSequenceCategory;

global.CTMC_PARAMS = projectConfig.hmcParams;

//================================================================
// INTEGRATION
//================================================================

exports.useBroker = config.integration == 'broker';

//================================================================
// STORES
//================================================================

exports.ENRICHER_OUT_STORE = 'enriched';
exports.OA_IN_STORE = 'oa_in';

//================================================================
// PRINT
//================================================================
log.info('================================================');
log.info('Working directory: %s', process.cwd());
log.info('Configuration file: %s', QM_CONF_FILE);
log.info('Module path: %s', QM_MODULE_PATH);
log.info('Read only: ' + QM_READ_ONLY);
log.info('================================================');

log.info('Configured!');

exports.createDb = function (callback) {
	var base = projectConfig.createDb(qm, function (e, result) {
		if (e != null) {
			log.error(e, 'Failed to create base!');
			callback(e);
			return;
		}
		callback(null, result);
	});
}

exports.getFieldConfig = function (base) {
	return projectConfig.getFieldConfig(base);
}