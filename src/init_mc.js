var fs = require('fs');
var analytics = qm.analytics;

global.FNAME_MC = CTMC_DIR_NAME + 'ctmc-1.bin';

function getFieldConfig(fldDescV) {
	log.info('Creating feature space params ...');
	
	var config = [];
	fldDescV.forEach(function (field) {
		if (!field.inModel) return;
		
		var ftrSpaceField = {
			type: field.type,
			source: {store: CTMC_STORE_NAME},
			field: field.name,
			normalize: field.type == 'numeric'
		};
		
		if (log.info())
			log.info('Feature space field: %s', JSON.stringify(ftrSpaceField));
		
		config.push(ftrSpaceField);
	});
	
	return config;
}

function genFtrSpaceParams(fieldConfig) {
	log.info('Generating feature space parameters ...');
	return {
		obsFields: getFieldConfig(fieldConfig.obsFields),
		contrFields: getFieldConfig(fieldConfig.contrFields)
	}
}

exports.init = function (opts) {
	if (opts == null) opts = {};
	
	var base = opts.base;
	
	if (fs.existsSync(FNAME_MC)) {
		log.info('Loading HMC model ...');
		var result = analytics.HierarchMarkov({base: base, hmcFile: FNAME_MC});	
		return result;
	} 
	else {
		log.info('Initializing Markov chain ...');
	
		var store = base.store(CTMC_STORE_NAME);
		var recs = store.recs;
		
		var recs = store.recs.trunc(500000);	// TODO remove
		
		log.info('Creating a model out of %d records ...', recs.length);
	
		var ftrSpaceParams = genFtrSpaceParams(opts.fieldConfig);
		
		var result = analytics.HierarchMarkov({
			base: base,
			hmcConfig: CTMC_PARAMS,
			obsFields: ftrSpaceParams.obsFields,
			contrFields: ftrSpaceParams.contrFields
		});
		
		
		var opts = {recSet: recs, timeField: CTMC_TIME_FIELD_ID, batchEndV: opts.endsBatchV};
		result.fit(opts);
		
		result.save(FNAME_MC);
		
		log.info('Done!');
		
		return result;
	}
};