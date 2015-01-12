var store = base.store(CTMC_STORE_NAME);

const PUSH_DELAY = 20;

log.info('Reading all records from store: %s', CTMC_STORE_NAME);
var recs = store.recs;
log.debug('Sorting %d records ...', recs.length);
recs.sortByField('time', true);

exports.replay = function () {
	log.info('Replaying records ...');
	
	var currIdx = 0;
	
	function pushRecord() {
		var rec = recs[currIdx++];
		
		hmc.update(rec);
		
		if (currIdx % 1000 == 0 && log.debug()) 
			log.debug('Pushed %d records ...', currIdx);
		
		setTimeout(pushRecord, PUSH_DELAY);
	}
	
	pushRecord();
}