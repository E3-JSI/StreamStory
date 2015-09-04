var fs = require('fs');
var bunyan = require('bunyan');
var logformat = require('bunyan-format');
var fields = require('./fields.js');

var confFile = process.argv[2];

console.log('Reading configuration file: ' + confFile);
var configStr = fs.readFileSync(confFile);
var config = JSON.parse(configStr);

//================================================================
// LOG
//================================================================

var loggerConfig = config.log.logger;
var logStream = {
	outputMode: loggerConfig.outputMode,
	out: loggerConfig.stream.type == 'stdout' ? process.stdout : fs.createWriteStream(loggerConfig.stream.file)
};

global.log = bunyan.createLogger({
	name: 'ProaSense',
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
exports.QM_DATABASE_PATH = config.qminer.dbPath;
exports.QM_DATABASE_MODE = config.qminer.mode;

//================================================================
// QMINER - multiple users
//================================================================
exports.QM_USER_BASES_PATH = config.qminer.basesPath;
exports.QM_USER_DEFAULT_STORE_NAME = 'default';

//================================================================
// MYSQL
//================================================================
exports.database = config.database;

global.qm = require(QM_MODULE_PATH);

// configure the stores

//================================================================
// REPLAY
//================================================================
exports.REPLAY_DATA = config.replay;

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
exports.RAW_PRINT_INTERVAL = config.log.print.rawData;//100000;
exports.STREAM_STORY_PRINT_INTERVAL = config.log.print.streamStory;//10000;
exports.STORE_PRINT_INTERVAL = config.log.print.stores;//100000;
exports.BROKER_PRINT_INTERVAL = config.log.print.broker;//10000;
exports.COEFF_PRINT_INTERVAL = config.log.print.coeff;//1000;


log.info('Configured!');
log.info('================================================');
log.info('Working directory: %s', process.cwd());
log.info('Module path: %s', QM_MODULE_PATH);
log.info('Mode: ' + config.qminer.mode);
log.info('StreamStory params: %s', JSON.stringify(exports.STREAM_STORY_PARAMS));
log.info('================================================');
