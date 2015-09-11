var fs = require('fs');
var bunyan = require('bunyan');
var logformat = require('bunyan-format');
var fields = require('./fields.js');
var utils = require('./src/utils.js');

// read the configuration file
var confFile = process.argv[2];

console.log('Reading configuration file: ' + confFile);
var configStr = fs.readFileSync(confFile);
var config = JSON.parse(configStr);

//================================================================
// LOG
//================================================================

var loggerConfig = config.log.logger;
var stream;
if (loggerConfig.stream.type == 'stdout') {
	console.log('Using stdout as log stream ...');
	stream = process.stdout;
} else {	// TODO file stream doesn't work
	console.log('Using file \'' + loggerConfig.stream.file + '\' as log stream ...');
	stream = fs.createWriteStream(loggerConfig.stream.file);
}
var logStream = {
	outputMode: loggerConfig.outputMode,
	out: stream
};

global.log = bunyan.createLogger({
	name: 'StreamStory',
	stream: logformat(logStream),
	level: config.log.logger.level
});

//================================================================
// INITIALIZATION
//================================================================
exports.INITIALIZE_ZERO = config.qminer.initializeZeros;
exports.INTERPOLATION = config.interpolation;

//================================================================
// SERVER
//================================================================
exports.SERVER_PORT = config.server.port;
exports.WWW_DIR = '../ui';
exports.PING_INTERVAL = config.server.pingInterval;

//================================================================
// QMINER
//================================================================
global.QM_MODULE_PATH = config.qminer.path;
exports.QM_CREATE_PIPELINE = config.qminer.createPipeline;
exports.QM_DATABASE_MODE = config.qminer.mode;

//================================================================
// STORAGE STRUCTURE
//================================================================
var dataPath = config.dataPath + (config.dataPath[config.dataPath.length - 1] == '/' ? '' : '/');
exports.REAL_TIME_BASE_PATH = dataPath + 'online-db/';
exports.REAL_TIME_MODELS_PATH = dataPath + 'models/';
exports.USER_BASES_PATH = dataPath + 'offline-db/';

//================================================================
// QMINER - multiple users
//================================================================
exports.QM_USER_DEFAULT_STORE_NAME = 'default';

//================================================================
// MYSQL
//================================================================
exports.database = config.database;

//================================================================
// STREAM STORY
//================================================================
exports.STREAM_STORY_FNAME = config.models.SSFName;
exports.STREAM_STORY_PARAMS = config.models.StreamStoryParams;

//================================================================
// INTEGRATION
//================================================================
exports.USE_BROKER = config.integration.type == 'broker';
exports.integration = config.integration;

//================================================================
// PIPELINE
//================================================================
exports.GC_INTERVAL = 1000000

//================================================================
// PRINT
//================================================================
exports.RAW_PRINT_INTERVAL = config.log.print.rawData;
exports.STREAM_STORY_PRINT_INTERVAL = config.log.print.streamStory;
exports.STORE_PRINT_INTERVAL = config.log.print.stores;
exports.BROKER_PRINT_INTERVAL = config.log.print.broker;
exports.COEFF_PRINT_INTERVAL = config.log.print.coeff;

// set the global qm object
global.qm = require(QM_MODULE_PATH);

//create the directories if they don't exist
try {
	utils.createDirSync(exports.REAL_TIME_BASE_PATH);
	utils.createDirSync(exports.REAL_TIME_MODELS_PATH);
	utils.createDirSync(exports.USER_BASES_PATH);
} catch (e) {
	log.error(e, 'Failed to create directories!');
	process.exit(3);
}

log.info('Configured!');
log.info('================================================');
log.info('Working directory: %s', process.cwd());
log.info('Module path: %s', QM_MODULE_PATH);
log.info('Mode: ' + config.qminer.mode);
log.info('StreamStory params: %s', JSON.stringify(exports.STREAM_STORY_PARAMS));
log.info('Data path: %s', dataPath);
log.info('================================================');
