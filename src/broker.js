var BROKER_URL = '89.216.116.44';
var CONSUMER_PORT = 2181;
var PRODUCER_PORT = 9092;

//var RAW_DATA_TOPIC = 'proasense.simpleevent.mhwirth.*'
var RAW_DATA_TOPIC = 'si.ijs.request.internal.raw'
var CEP_TOPIC = 'si.ijs.request.internal.cep';

// comsumer port: 2181
// producer port: 9092

exports.onMessage = function (callback) {
	msgCallback = callback;
}

exports.init = function () {
	log.info('Initilizing Kafka producer ...');

//	var producer = new kafka.Producer({
//	    host:         BROKER_URL,
//	    port:         9092,
//	    topic:		  RAW_DATA_TOPIC
//	});
//
//	producer.on('connecting', function(address) {
//	    log.info('Connecting to %s ...', address)
//	});
//
//	producer.on('disconnected', function(address) {
//	    log.error('Disconnected from %s', address);
//	});
//
//	producer.on('error', function (e) {
//		log.error(e, 'Exception in Kafka producer!');
//	})
//	
//	producer.on('connect', function () {
//		log.info('Kafka producer connected!');
//		
//		{
//			var nSent = 0;
//			setInterval(function () {
//				// send two messages to the testing topic
//				var timestamp = new Date().getTime();
//							
//				producer.send(JSON.stringify({
//							timestamp: timestamp,
//							value: 2,
//							sensorId: 'MHWirth.DDM.HookLoad',
//							type: 'raw'
//						})
//				);
//				
//				if (++nSent % 100 == 0)
//					log.debug('Sent %d messages ...', nSent);
//			}, 1000);
//		}
//	});
//
//	producer.connect();
	
	var kafka = require('kafka-node'),
    	Producer = kafka.Producer,
    	client = new kafka.Client(BROKER_URL + ':' + CONSUMER_PORT, 'AO_JSI'),
    	producer = new Producer(client);
	
	var payloads = {
		topic: RAW_DATA_TOPIC,
		messages: [JSON.stringify({
			timestamp: timestamp,
			value: 2,
			sensorId: 'MHWirth.DDM.HookLoad',
			type: 'raw'
		})]
	}
	
	producer.on('ready', function () {
	    producer.send(payloads, function (err, data) {
	    	if (err)
	    		log.error(err, 'Exception while sending to kafka!');
	        log.info(data);
	    });
	});
}