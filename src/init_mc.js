var fs = require('fs');
var analytics = qm.analytics;

global.FNAME_MC = CTMC_DIR_NAME + 'ctmc-1.bin';
global.FNAME_FSPACE = CTMC_DIR_NAME + 'ctmc-ftr-1.bin';

function genFtrSpaceParams() {
	log.info('Generating feature space parameters ...');
	
	var ftrSpaceParams = [];
	for (var i = 0; i < QM_FIELDS.length; i++) {
		var field = QM_FIELDS[i];
		
		if (!field.inModel) continue;
		
		var ftrSpaceField = {
			type: field.type,
			source: {store: CTMC_STORE_NAME},
			field: field.name,
			normalize: field.type == 'numeric'
		};
		
		if (log.info())
			log.info('Field: %s', JSON.stringify(ftrSpaceField));
		
		ftrSpaceParams.push(ftrSpaceField);
	}
	
	log.info('Done!');
	
	return ftrSpaceParams;
}

exports.init = function (opts) {
	if (opts == null) opts = {};
	
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
//		var recs = store.recs.trunc(500000);	// TODO remove
		
		log.info('Creating a model out of %d records ...', recs.length);
	
		var result = analytics.HierarchMarkov({
			base: base,
			hmcConfig: CTMC_PARAMS,
			ftrSpaceConfig: genFtrSpaceParams()
		});
		
		var opts = {recSet: recs, timeField: CTMC_TIME_FIELD_ID, batchEndV: opts.endsBatchV};
		result.fit(opts);
		
		result.save(FNAME_MC, FNAME_FSPACE);
		
		log.info('Done!');
		
		return result;
	}
};