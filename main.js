var fs = require('fs');
var config = require('./config.js');
var services = require('./src/services.js');
var pipeline = require('./src/pipeline.js');
var utils = require('./src/utils.js');
var fields = require('./fields.js');
var db = require('./src/dbaccess.js')();
var analytics = qm.analytics;

function initStreamStory(base) {
	if (fs.existsSync(config.STREAM_STORY_FNAME)) {
		log.info('Loading StreamStory ...');
		var result = analytics.StreamStory({base: base, fname: config.STREAM_STORY_FNAME});	
		return result;
	} 
	else {
		log.info('Initializing StreamStory ...');
		log.info('Reading store %s', fields.STREAM_STORY_STORE);
		
		var store = base.store(fields.STREAM_STORY_STORE);
		var recs = store.allRecords;
		
//		log.info('Storing CSV file ...');
//		recs.saveCsv({fname: '/mnt/raidM2T/data/test/mhwrith.csv'});
//		utils.exit(base);
		
		if (recs.length == 0) {
			log.warn('Tried to initialize StreamStory with 0 records!');
			return null;
		}
				
		log.info('Creating a model out of %d records ...', recs.length);
	
		var ftrSpaceParams = fields.getStreamStoryFtrSpaceFields();
		
		log.info('Building StreamStory with params: %s', JSON.stringify(config.STREAM_STORY_PARAMS));
		
		var model = analytics.StreamStory({
			base: base,
			config: config.STREAM_STORY_PARAMS,
			obsFields: ftrSpaceParams.obsFields,
			contrFields: ftrSpaceParams.contrFields
		});
		
		var opts = {recSet: recs, timeField: fields.SS_TIME_FIELD, batchEndV: null};
		model.fit(opts);
		
		model.save(config.STREAM_STORY_FNAME);
		
		log.info('Done!');
		
		return model;
	}
}

try {
	var schema = fields.getQmSchema();
	
	log.info('Opening base with the following schema: %s', JSON.stringify(schema));
	
	var base = new qm.Base({
		dbPath: config.QM_DATABASE_PATH,
		schema: schema,
		mode: config.QM_DATABASE_MODE
	});
	
	var ss = initStreamStory(base);

	if (config.QM_CREATE_PIPELINE) 
		pipeline.init({ base: base, db: db });
	
	services.init({ model: ss, base: base, pipeline: pipeline, db: db });
	
	if (config.REPLAY_DATA)
		require('./src/replay.js').replayHmc(ss, base);
	
	process.on("SIGINT", function () {
		utils.exit(base);
	});
} catch (e) {
	log.error(e, 'Exception in main!');
	utils.exit(base);
}