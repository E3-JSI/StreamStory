var config = require('./config.js');
var utils = require('./src/utils.js');
var fields = require('./fields.js');

var base;

if (process.argv.length < 4)
	throw new Error('Missing last argument!')

try {
	var fname = process.argv[3];
	var schema = fields.getQmSchema();
	
	base = new qm.Base({
		dbPath: config.REAL_TIME_BASE_PATH,
		schema: schema,
		mode: 'openReadOnly'
	});
	
	var store = base.store(fields.STREAM_STORY_STORE);
	var recSet = store.allRecords;
	
	log.info('Saving %d records to %s ...', recSet.length, fname);
	
	recSet.saveCsv({
		fname: fname
	});
	
	utils.exit(base);
	
} catch (e) {
	log.error(e, 'Failed to save CSV file!');
	utils.exit(base);
}