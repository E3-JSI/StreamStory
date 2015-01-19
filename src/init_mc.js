var fs = require('fs');
var hmc = require('./hmc.js');

const FNAME_MC = CTMC_DIR_NAME + 'ctmc-' + CLUST_SAMPLE + '.bin';
const FNAME_FSPACE = CTMC_DIR_NAME + 'ctmc-ftr-' + CLUST_SAMPLE + '.bin';

exports.init = function () {
	if (fs.existsSync(FNAME_MC) && fs.existsSync(FNAME_FSPACE)) {
		log.info('Loading HMC model ...');
		var result = hmc.HMC({base: base, hmcFile: FNAME_MC, ftrSpaceFile: FNAME_FSPACE});
		return result;
	} 
	else {
		log.info('Initializing Markov chain ...');
		
		var store = base.store(CTMC_STORE_NAME);
		var recs = store.recs;
		
		log.info('Creating a store out of %d records ...', recs.length);
		
		var result = hmc.HMC({
			base: base,
			hmcConfig: CTMC_PARAMS,
			ftrSpaceConfig: FTR_SPACE_PARAMS
		}).fit(recs);
		
		result.save(FNAME_MC, FNAME_FSPACE);
		
		log.info('Done!');
		
		return result;
	}
};