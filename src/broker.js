var kafka = require('kafka-node');
var utils = require('./utils.js');

var BROKER_URL = '89.216.116.44';
var CONSUMER_PORT = 2181;
var PRODUCER_PORT = 9092;

//var RAW_DATA_TOPIC = 'proasense.simpleevent.mhwirth.*'
var RAW_DATA_TOPIC = 'si.ijs.request.internal.raw'
var CEP_TOPIC = 'si.ijs.request.internal.cep';

// comsumer port: 2181
// producer port: 9092

var client;
var producer;
var consumer;

function initClient() {
	log.info('Initializing client ...');
	
	client = new kafka.Client(BROKER_URL + ':' + CONSUMER_PORT, 'AO_JSI');
	producer = new kafka.Producer(client);
	consumer = new kafka.Consumer(
			client, 
			[{topic: RAW_DATA_TOPIC, partition: 0}],
			{autoCommit: true}
	);
	
	producer.on('ready', function () {
		log.info('Producer ready!');
		
		//================================================================
		var payloads = [{
			topic: RAW_DATA_TOPIC,
			messages: [JSON.stringify({
				timestamp: new Date().getTime(),
				value: 2,
				sensorId: 'MHWirth.DDM.HookLoad',
				type: 'raw'
			})]
		}]
		
		var nSent = 0;
		
		setInterval(function () {
			 producer.send(payloads, function (e, data) {
		    	if (e != null) {
		    		log.error(e, 'Exception while sending to kafka!');
		    		return;
		    	}
		    	if (++nSent % 100 == 0)
		    		log.debug('Sent %d messages', nSent);
		    });
		}, 20);
		//================================================================
	});
	
	consumer.on('error', function (e) {
		log.error(e, 'Error while consuming message!');
	});
	
	consumer.on('offsetOutOfRange', function (e) {
		log.error(e, 'Consumer offset out of range!');
	});
}

exports.onMessage = function (callback) {
	msgCallback = callback;
}

exports.init = function () {
	log.info('Initilizing Kafka ...');
	
	initClient();
	
	{
		var nReceived = 0;
		
		consumer.on('message', function (msg) {
			if (++nReceived % 100 == 0 && log.debug())
				log.debug('Received %d messages ...', nReceived);
			
			var topic = msg.topic;
			var payload = JSON.parse(msg.value);
			
			if (msgCallback != null) {
				if (topic == RAW_DATA_TOPIC) {
					var value = {
						timestamp: payload.timestamp,
						store: utils.getStoreId(payload.sensorId),
						value: payload.value
					}
					msgCallback({type: 'raw', payload: value})
				} else if (topic == CEP_TOPIC) {
					// TODO
					log.debug('Received CEP message!');
				} else {
					log.warn('Invalid topic: %s', topic);
				}
			}
		});
	}
}