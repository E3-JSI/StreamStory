// read command line arguments
var confFile = process.argv[2];
global.qmModulePath = process.argv[3];

var readOnly = true;

console.log('================================================');
console.log('Environment: ' + JSON.stringify(process.env));
console.log('Working directory: ' + process.cwd());
console.log('QMiner configuration file: ' + confFile);
console.log('Module path: ' + global.qmModulePath);
console.log('Read only: ' + readOnly);
console.log('================================================\n\n');

// imports
require('./src/config.js');
var services = require('./src/services.js');
var mc = require('./src/init_mc.js');
var qm = require(qmModulePath + 'qm.node');

// global functions
global.closeBase = function () {
	console.log('Closing base ...');
	
	if (!readOnly && base != null)
		base.close();
	
	console.log('Done!');
};

try {
	console.log('Opening base with configuration: ' + confFile + ' ...');
	global.base = qm.open(confFile, readOnly);
	
	global.hmc = mc.init();
	services.init();
} catch (e) {
	console.log('Exception in main: ' + e);
	closeBase();
}