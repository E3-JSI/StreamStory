var fs = require('fs');
var config = require('../config.js');
var analytics = qm.analytics;


function getFieldConfig(fldDescV) {
	log.info('Creating feature space params ...');
	
	var fldConfig = [];
	fldDescV.forEach(function (field) {
		if (!field.inModel) return;
		
		var ftrSpaceField = {
			type: field.type,
			source: {store: config.STREAM_STORY_STORE},
			field: field.name,
			normalize: field.type == 'numeric'
		};
		
		if (log.info())
			log.info('Feature space field: %s', JSON.stringify(ftrSpaceField));
		
		fldConfig.push(ftrSpaceField);
	});
	
	return fldConfig;
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
	
	if (fs.existsSync(config.STREAM_STORY_FNAME)) {
		log.info('Loading StreamStory ...');
		var result = analytics.HierarchMarkov({base: base, hmcFile: config.STREAM_STORY_FNAME});	
		return result;
	} 
	else {
		log.info('Initializing StreamStory ...');
	
		var store = base.store(config.STREAM_STORY_STORE);
		var recs = store.recs;
		
//		var recs = store.recs.trunc(10000);	// TODO remove
		
		log.info('Creating a model out of %d records ...', recs.length);
	
		var ftrSpaceParams = genFtrSpaceParams(opts.fieldConfig);
		
		var result = analytics.HierarchMarkov({
			base: base,
			hmcConfig: CTMC_PARAMS,
			obsFields: ftrSpaceParams.obsFields,
			contrFields: ftrSpaceParams.contrFields
		});
		
		if (recs.length == 0) {
			log.warn('Tried to initialize StreamStory with 0 records!');
			return result;
		}
		
		var opts = {recSet: recs, timeField: CTMC_TIME_FIELD_ID, batchEndV: opts.endsBatchV};
		result.fit(opts);
		
		result.save(config.STREAM_STORY_FNAME);
		
		log.info('Done!');
		
		return result;
	}
};