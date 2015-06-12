var fs = require('fs');
var config = require('./config.js');
var services = require('./src/services.js');
var pipeline = require('./src/pipeline.js');
var utils = require('./src/utils.js');
var fields = require('./fields.js');
var analytics = qm.analytics;

function initStreamStory(base) {
	if (fs.existsSync(config.STREAM_STORY_FNAME)) {
		log.info('Loading StreamStory ...');
		var result = analytics.HierarchMarkov({base: base, hmcFile: config.STREAM_STORY_FNAME});	
		return result;
	} 
	else {
		log.info('Initializing StreamStory ...');
		log.info('Reading store %s', fields.STREAM_STORY_STORE);
		
		var store = base.store(fields.STREAM_STORY_STORE);
		var recs = store.allRecords;
		
		if (recs.length == 0) {
			log.warn('Tried to initialize StreamStory with 0 records!');
			return null;
		}
		
//		var recs = store.recs.trunc(10000);	// TODO remove
		
		log.info('Creating a model out of %d records ...', recs.length);
	
		var ftrSpaceParams = fields.getStreamStoryFtrSpaceFields();
		
		var result = analytics.HierarchMarkov({
			base: base,
			hmcConfig: config.STREAM_STORY_PARAMS,
			obsFields: ftrSpaceParams.obsFields,
			contrFields: ftrSpaceParams.contrFields
		});
		
		var opts = {recSet: recs, timeField: fields.SS_TIME_FIELD, batchEndV: null};
		result.fit(opts);
		
		result.save(config.STREAM_STORY_FNAME);
		
		log.info('Done!');
		
		return result;
	}
}

try {
	var base = new qm.Base({
		dbPath: config.QM_DATABASE_PATH,
		schema: fields.getQmSchema(),
		mode: config.QM_DATABASE_MODE
	});
	
	var hmc = initStreamStory(base);

	if (config.QM_CREATE_PIPELINE) 
		pipeline.init({ base: base, hmc: hmc });
	
	services.init(hmc, base);
	
	if (config.REPLAY_DATA)
		require('./src/replay.js').replayHmc(hmc, base);
} catch (e) {
	log.error(e, 'Exception in main!');
	utils.exit(base);
}