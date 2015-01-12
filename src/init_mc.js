var fs = require('fs');
var hmcLib = require('./hmc.js');

const FNAME_MC = CTMC_DIR_NAME + 'ctmc-' + CTMC_NRECS + '.bin';
const FNAME_FSPACE = CTMC_DIR_NAME + 'ctmc-ftr-' + CTMC_NRECS + '.bin';

exports.init = function () {
	if (fs.existsSync(FNAME_MC) && fs.existsSync(FNAME_FSPACE)) {
		log.info('Loading HMC model ...');
		return hmcLib.load(FNAME_MC, FNAME_FSPACE);
	} 
	else {
		log.info('Initializing Markov chain ...');
		
		var store = base.store(CTMC_STORE_NAME);
		
		var recs = store.recs.sample(CTMC_NRECS);
		recs.sortByField('time', true);
		
		log.info('Creating a store out of %d records ...', recs.length);
		
		var result = hmcLib.create(recs, CTMC_PARAMS);
		result.save(FNAME_MC, FNAME_FSPACE);
		
		log.info('Done!');
		
		return result;
	}
};