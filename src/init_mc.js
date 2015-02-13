var fs = require('fs');
var analytics = qm.analytics;

global.FNAME_MC = CTMC_DIR_NAME + 'ctmc-' + CLUST_SAMPLE + '.bin';
global.FNAME_FSPACE = CTMC_DIR_NAME + 'ctmc-ftr-' + CLUST_SAMPLE + '.bin';

function genFtrSpaceParams() {
	log.info('Generating feature space parameters ...');
	
	var ftrSpaceParams = [];
	for (var i = 0; i < QM_FIELDS.length; i++) {
		var field = QM_FIELDS[i];
		
		var ftrSpaceField = {
			type: field.type,
			source: {store: QM_RESAMPLED_STORE},
			field: field.name,
			normalize: true
		};
		
		if (log.info())
			log.info('Field: %s', JSON.stringify(ftrSpaceField));
		
		ftrSpaceParams.push(ftrSpaceField);
	}
	
	log.info('Done!');
	
	return ftrSpaceParams;
}

exports.init = function () {
	if (fs.existsSync(FNAME_MC) && fs.existsSync(FNAME_FSPACE)) {
		log.info('Loading HMC model ...');
		var result = analytics.HierarchMarkov({base: base, hmcFile: FNAME_MC, ftrSpaceFile: FNAME_FSPACE});
		
//		log.info('Rebuilding histograms ...');
//		var store = base.store(CTMC_STORE_NAME);
//		var model = result.getModel();
//		var ftrSpace = result.getFtrSpace();
//		
//		var colMat = ftrSpace.ftrColMat(store.recs);
//		
//		model.rebuildHistograms(colMat);
//		log.info('Finished rebuilding! Saving ...');
//		result.save(FNAME_MC, FNAME_FSPACE);
//		log.info('Done!');
		
		return result;
	} 
	else {
		log.info('Initializing Markov chain ...');
		
		var store = base.store(CTMC_STORE_NAME);
		var recs = store.recs;
		
		log.info('Creating a store out of %d records ...', recs.length);
	
		var result = analytics.HierarchMarkov({
			base: base,
			hmcConfig: CTMC_PARAMS,
			ftrSpaceConfig: genFtrSpaceParams()
		}).fit(recs);
		
		result.save(FNAME_MC, FNAME_FSPACE);
		
		log.info('Done!');
		
		return result;
	}
};