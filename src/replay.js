var http = require('http');
var config = require('../config.js');
var fields = require('../fields.js');

const PUSH_DELAY = 100;

log.info('Reading all records from store: %s', fields.STREAM_STORY_STORE);

//log.debug('Sorting %d records ...', recs.length);
//recs.sortByField('time', true);

exports.replayHmc = function (hmc, base) {
	log.info('Replaying records ...');
	
	var store = base.store(fields.STREAM_STORY_STORE);
	var recs = store.allRecords;
	
	var currIdx = 0;
	
	function pushRecord() {
		var rec = recs[currIdx++];
		
		hmc.update(rec);
		
		if (currIdx % 1000 == 0 && log.debug()) 
			log.debug('Pushed %d records ...', currIdx);
		
		currIdx %= recs.length;
		
		setTimeout(pushRecord, PUSH_DELAY);
	}
	
	pushRecord();
}

//exports.replayStream = function () {
//	const DIR_NAME = '/media/lstopar/hdd/data/Aker/cleaned';
//	const DIR_SETPOINT = '';
//		
//	const BATCH_SIZE = 1000;
//	const DELAY = 1000;
//	
//	var currVals = [];
//	var currentBatch = [];
//	
//	function findLowestValIdx() {
//		var idx = -1;
//		var lowestTime = Number.MAX_VALUE;
//		
//		for (var i = 0; i < currVals.length; i++) {
//			if (currVals[i].timestamp < lowestTime) {
//				lowestTime = currVals[i].timestamp;
//				idx = i;
//			}
//		}
//		
//		return idx;
//	}
//	
//	function canInsert() {
//		if (pending.length == 0) return false;
//
//		var first = pending[0];
//		for (var i = 1; i < pending.length; i++) {
//			var current = pending[i];
//			
//			if (current.store != first.store || current.timestamp != first.timestamp)
//				return true;
//		}
//		
//		return false;
//	}
//	
//	function extractVal() {
//		if (pending.length == 0) return null;
//		
//		var first = pending[0];
//		var nEqual = 1;
//		
//		while (nEqual < pending.length) {
//			var curr = pending[nEqual];
//			
//			if (curr.store != first.store || curr.timestamp != first.timestamp)
//				break;
//			
//			nEqual++;
//		}
//		
//		var sum = 0;
//		for (var i = 0; i < nEqual; i++) {
//			var val = pending.shift();
//			sum += val.value;
//		}
//		
//		first.value = sum / nEqual;
//		
//		return first;
//	}
//	
//	function send(instance) {
//		currentBatch.push(instance);
//		
//		if (currentBatch.length >= BATCH_SIZE) {
//			totalSent += currentBatch.length;
//			
//			var url = "http://localhost:" + SERVER_PORT + "/api/push";
//			
//			if (log.debug())
//				log.debug('Pushing data ...');
//			
//			// post data
//			var opts = {
//				hostname: 'localhost',
//				port: SERVER_PORT,
//				path: '/api/push',
//				method: 'POST'
//			};
//			
//			var req = http.request(opts, function (resp) {
//				if (resp.statusCode < 200 || 300 <= resp.statusCode) {
//					log.warning('Failed to push data, status code: %d!', resp.statusCode);
//					return;
//				}
//				
//				resp.on('data', function (chunk) {
//					log.debug('BODY: ' + chunk);
//				});
//				resp.on('end', function () {
//					log.debug('Push ended!');
//				})
//			});
//			
//			req.on('error', function (e) {
//				log.error(e, 'Failed to send HTTP post!');
//			});
//			
//			req.end();
//			
//			// clear current batch
//			currentBatch = [];
//		}
//	}
//	
//	function replay() {
//		var dir1 = DIR_NAME + '/gearbox/';
//		var dir2 = DIR_NAME + '/setpoint/';
//		
//		var files1 = fs.readdirSync(dir1);
//		var files2 = fs.readdirSync(dir2);
//		
//		log.info('Reading directories ...');
//		
//		
//	}
//}