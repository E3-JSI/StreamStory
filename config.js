var fs = require('fs');
var bunyan = require('bunyan');
var logformat = require('bunyan-format');

var confFile = process.argv[2];

console.log('Reading configuration file: ' + confFile);
var configStr = fs.readFileSync(confFile);
var config = JSON.parse(configStr);

//================================================================
// LOG
//================================================================
global.log = bunyan.createLogger({
	name: 'ProaSense',
	stream: logformat({ 
		outputMode: 'short',
		out: process.stdout
	}),
	level: config.logLevel
});

//================================================================
// SERVER
//================================================================
global.SERVER_PORT = config.port;
global.WWW_DIR = '../ui';
global.PING_INTERVAL = config.pingInterval;

//================================================================
// QMINER
//================================================================
global.qmModulePath = config.qminerPath;

//================================================================
// MARKOV CHAIN
//================================================================
global.CTMC_STORE_NAME = 'drilling_resampled';
global.CTMC_DIR_NAME = config.modelDir;
global.CLUST_SAMPLE = 1;
global.CTMC_VERBOSE = config.modelVerbose;

global.CTMC_PARAMS = {
	transitions: {
		type: 'continuous',
		timeUnit: 'hour'
	},
	clustering: {
		type: 'dpmeans',
		lambda: 1.1,
		minClusts: 30,
//		maxClusts: 30,
		rndseed: 1,
		sample: CLUST_SAMPLE
	},
	verbose: CTMC_VERBOSE
};

global.FTR_SPACE_PARAMS = [
	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'hook_load', normalize: true},
	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'oil_temp_gearbox', normalize: true},
	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'oil_temp_swivel', normalize: true},
	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'pressure_gearbox', normalize: true},
	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'rpm', normalize: true},
	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'torque', normalize: true},
	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'wob', normalize: true},
	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'mru_pos', normalize: true},
	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'mru_vel', normalize: true},
	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'ram_pos_measured', normalize: true},
	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'ram_vel_measured', normalize: true}
]

//================================================================
// PRINT
//================================================================
log.info('================================================');
log.info('Working directory: %s', process.cwd());
log.info('Configuration file: %s', config.qmConfFile);
log.info('Module path: %s', global.qmModulePath);
log.info('Read only: ' + config.qmReadOnly);
log.info('Model verbose: ' + CTMC_VERBOSE);
log.info('Clustering sampling: %d', CLUST_SAMPLE);
log.info('================================================');

log.info('Configured!');

//set exports
exports.qmConfFile = config.qmConfFile;
exports.qmReadOnly = config.qmReadOnly;