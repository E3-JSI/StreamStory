var fs = require('fs');
var hmcLib = require('./mc.js');

const FNAME_MC = CTMC_DIR_NAME + 'ctmc-' + CTMC_NRECS + '.bin';
const FNAME_FSPACE = CTMC_DIR_NAME + 'ctmc-ftr-' + CTMC_NRECS + '.bin';

exports.init = function () {
	if (fs.existsSync(FNAME_MC) && fs.existsSync(FNAME_FSPACE)) {
		return hmcLib.load(FNAME_MC, FNAME_FSPACE);
	} 
	else {
		console.log('Initializing Markov chain ...');
		
		var store = base.store(CTMC_STORE_NAME);
		
		var recs = store.recs.sample(CTMC_NRECS);
		recs.sortByField('time', true);
		
		console.log('Creating a store out of ' + recs.length + ' records ...');
		
		var result = hmcLib.create(recs, CTMC_PARAMS);
		result.save(FNAME_MC, FNAME_FSPACE);
		
		console.log('Done!');
		
		return result;
	}
};