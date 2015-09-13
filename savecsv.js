var config = require('./config.js');
var utils = require('./src/utils.js');
var fields = require('./fields.js');

var base;

try {
	var schema = fields.getQmSchema();
	
	base = new qm.Base({
		dbPath: config.REAL_TIME_BASE_PATH,
		schema: schema,
		mode: 'openReadOnly'
	});
	
	var store = base.store(fields.STREAM_STORY_STORE);
	var recSet = store.allRecords;
	
	log.info('Storing %d records ...', recSet.length);
	
	recSet.saveCsv({
		fname: '/mnt/raidM2T/data/test/mhwirth-4m.csv'
	});
	
	utils.exit(base);
	
} catch (e) {
	log.error(e, 'Failed to save CSV file!');
	utils.exit(base);
}