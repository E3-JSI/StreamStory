var fs = require('fs');
var bunyan = require('bunyan');
var logformat = require('bunyan-format');

var confFile = process.argv[2];

console.log('Reading configuration file: ' + confFile);
var configStr = fs.readFileSync(confFile);
var config = JSON.parse(configStr);

// set globals
// LOG
global.log = bunyan.createLogger({
	name: 'ProaSense',
	stream: logformat({ 
		outputMode: 'short',
		out: process.stdout
	}),
	level: config.logLevel
});

// SERVER
global.SERVER_PORT = config.port;
global.WWW_DIR = '../www';
global.PING_INTERVAL = config.pingInterval;

// QMINER
global.qmModulePath = config.qminerPath;

// MARKOV CHAIN
global.CTMC_STORE_NAME = 'drilling_resampled';
global.CTMC_DIR_NAME = '/media/lstopar/hdd/project-data/proasense-models/';
global.CTMC_NRECS = 100000;

global.CTMC_PARAMS = {
	transitions: {
		type: 'continuous',
		timeUnit: 'hour'
	},
	clustering: {
		type: 'dpmeans',
		lambda: .7,
		minClusts: 30,
		maxClusts: 30,
		rndseed: 1
	}
};

// print
log.info('================================================');
log.info('Working directory: %s', process.cwd());
log.info('Configuration file: %s', config.qmConfFile);
log.info('Module path: %s', global.qmModulePath);
log.info('Read only: ' + config.qmReadOnly);
log.info('================================================');

log.info('Configured!');

//set exports
exports.qmConfFile = config.qmConfFile;
exports.qmReadOnly = config.qmReadOnly;