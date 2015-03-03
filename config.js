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

global.QM_IN_STORE = 'drilling';
global.QM_RESAMPLED_STORE = 'drilling_resampled';

global.qm = require(QM_MODULE_PATH);

//================================================================
// REPLAY
//================================================================
global.REPLAY_DATA = config.replay;

//================================================================
// MARKOV CHAIN
//================================================================
global.CTMC_STORE_NAME = 'drilling_resampled';
global.CTMC_DIR_NAME = config.models.dir;
global.CLUST_SAMPLE = 1;
global.CTMC_VERBOSE = config.models.verbose;

global.CTMC_PARAMS = {
	transitions: {
		type: 'continuous',
		timeUnit: 'second'
	},
	clustering: {
		type: 'dpmeans',
		lambda: 1.1,
		minClusts: 30,
//		maxClusts: 30,
		rndseed: 1,
		sample: CLUST_SAMPLE,
		histogramBins: 20
	},
	pastStates: 1,
	verbose: CTMC_VERBOSE
};

global.QM_FIELDS = [
    {name: 'hook_load', type: 'numeric', interpolator: 'previous'},
    {name: 'oil_temp_gearbox', type: 'numeric', interpolator: 'linear'},
    {name: 'oil_temp_swivel', type: 'numeric', interpolator: 'linear'},
    {name: 'pressure_gearbox', type: 'numeric', interpolator: 'linear'},
    {name: 'rpm', type: 'numeric', interpolator: 'linear'},
    {name: 'temp_ambient', type: 'numeric', interpolator: 'previous'},
    {name: 'torque', type: 'numeric', interpolator: 'linear'},
    {name: 'wob', type: 'numeric', interpolator: 'linear'},
    {name: 'mru_pos', type: 'numeric', interpolator: 'linear'},
    {name: 'mru_vel', type: 'numeric', interpolator: 'linear'},
    {name: 'ram_pos_measured', type: 'numeric', interpolator: 'linear'},
    {name: 'ram_pos_setpoint', type: 'numeric', interpolator: 'linear'},
    {name: 'ram_vel_measured', type: 'numeric', interpolator: 'linear'},
    {name: 'ram_vel_setpoint', type: 'numeric', interpolator: 'linear'}
]

//global.FTR_SPACE_PARAMS = [
//	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'hook_load', normalize: true},
//	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'oil_temp_gearbox', normalize: true},
//	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'oil_temp_swivel', normalize: true},
//	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'pressure_gearbox', normalize: true},
//	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'rpm', normalize: true},
//	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'torque', normalize: true},
//	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'wob', normalize: true},
//	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'mru_pos', normalize: true},
//	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'mru_vel', normalize: true},
//	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'ram_pos_measured', normalize: true},
//	{type: 'numeric', source: {store: 'drilling_resampled'}, field: 'ram_vel_measured', normalize: true}
//]

//================================================================
// PRINT
//================================================================
log.info('================================================');
log.info('Working directory: %s', process.cwd());
log.info('Configuration file: %s', QM_CONF_FILE);
log.info('Module path: %s', QM_MODULE_PATH);
log.info('Read only: ' + QM_READ_ONLY);
log.info('Model verbose: ' + CTMC_VERBOSE);
log.info('Clustering sampling: %d', CLUST_SAMPLE);
log.info('================================================');

log.info('Configured!');