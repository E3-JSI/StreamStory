// SERVER
global.SERVER_PORT = 8888;
global.WWW_DIR = '../www';

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