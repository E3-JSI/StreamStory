var kafka = require('kafka-node');
var utils = require('./utils.js');
var config = require('../config.js');


//var BROKER_URL = '';
var ZOOKEPER_PORT = config.integration.zookeperPort;
var PRODUCER_PORT = config.integration.producerPort;
var BROKER_URL = config.integration.brokerUrl;

var topics = {
	// input topics 
	RAW_DATA_CONSUMER_TOPIC: 'si.ijs.internal.raw',
	CEP_DATA_CONSUMER_TOPIC: 'si.ijs.internal.cep',
	// output topics
	ENRICHED_DATA_PRODUCER_TOPIC: 'si.ijs.internal.enriched',
	PREDICTION_PRODUCER_TOPIC: 'si.ijs.internal.oa_output'
};

// comsumer port: 2181
// producer port: 9092

var client;
var producer;
var consumer;

function initConsumer() {
	log.info('Initializing consumer ...');
	
	var pauseCount = 0;
	
	var offset = new kafka.Offset(client);
	
	consumer = new kafka.Consumer(
			client, 
			[
			 	{topic: topics.RAW_DATA_CONSUMER_TOPIC, partition: 0},
			 	{topic: topics.CEP_DATA_CONSUMER_TOPIC, partition: 0}
			],
			{autoCommit: true}
	);
	
	function pauseConsumer() {
		if (pauseCount++ == 0) {
			consumer.pause();
			log.info('Consumer paused ...');
		}
	}
	
	function resumeConsumer() {
		if (--pauseCount == 0) {
			consumer.resume();
			log.info('Consumer resumed!');
		}
	}
	
	consumer.on('ready', function () {
		log.info('Consumer initialized!');
	})
	
	consumer.on('error', function (e) {
		log.error(e, 'Error while consuming message!');
	});
	
	consumer.on('offsetOutOfRange', function (e) {
		log.error(e, 'Offset out of range for topic %s! Pausing consumer ...', JSON.stringify(e));
		pauseConsumer();
		
		var topic = e.topic;
		var partition = e.partition;
		
		log.info('Fetching new offset ...');
		
		var offsetOpts = [{ topic: topic, partition: partition, time: Date.now(), maxNum: 1 }];
	    offset.fetch(offsetOpts, function (e1, data) {
	    	if (e1 != null) {
	    		log.error(e1, 'Failed to fetch offset! Resuming consumer anyway!');
	    		resumeConsumer();
	    		return;
	    	}
	    	
	    	var offset = data[topic][partition][0];
	    	
	    	log.info('Got new offset %d for topic %s ...', offset, topic);
	    	consumer.setOffset(topic, partition, offset);
	    	
	    	resumeConsumer();
	    });
	});
	
	{
		var nReceivedRaw = 0;
		var nReceivedCep = 0;
		
		consumer.on('message', function (msg) {
			try {
				var topic = msg.topic;
				var payload = JSON.parse(msg.value);
				
				if (msgCallback != null) {
					if (topic == topics.RAW_DATA_CONSUMER_TOPIC) {
						if (nReceivedRaw++ % config.BROKER_PRINT_INTERVAL == 0 && log.debug())
							log.debug('Received %d raw data messages ...', nReceivedRaw);
						
						msgCallback({type: 'raw', payload: payload})
					} else if (topic == topics.CEP_DATA_CONSUMER_TOPIC) {
						if (nReceivedCep++ % config.BROKER_PRINT_INTERVAL == 0 && log.debug())
							log.debug('Received %d CEP messages %s ...', nReceivedCep, JSON.stringify(payload));
						
						msgCallback({type: 'cep', payload: payload});
					} else {
						log.warn('Invalid topic: %s', topic);
					}
				}
			} catch (e) {
				log.error(e, 'Exception while receiving message!');
			}
		});
	}
	
	log.info('Consumer initialized!');
}

function initClient() {
	log.info('Initializing Kafka client ...');
	
	client = new kafka.Client(BROKER_URL + ':' + ZOOKEPER_PORT, 'AO_JSI');
	producer = new kafka.Producer(client);
	
	log.info('Initilizing producer ...');
	producer.on('ready', function () {
		log.info('Producer ready!');
		
		var createTopics = [];
		for (var topic in topics) {
			createTopics.push(topics[topic]);
		}
		
		producer.createTopics(createTopics, false, function (e, data) {
			if (e != null) {
				log.error(e, 'Failed to create producer topics!');
			} else {
				log.info('Producer topics ready!');
				log.info(data);
				initConsumer();
			}
		});
	});
	
	producer.on('error', function (e) {
		log.error(e, 'Exception in the producer!');
	})
}

var nsent = 0;

exports.send = function (topic, msg) {
	if (!config.USE_BROKER) return;
	
	if (nsent++ % config.BROKER_PRINT_INTERVAL == 0 && log.debug())
		log.debug('Sent %d messages: %s',nsent, JSON.stringify(msg));
	
	producer.send([{ topic: topic, messages: [msg], partition: 0 }], function (e1, data) {
		if (e1 != null) {
			log.error(e1, 'Failed to send message: %s', msg);
			return;
		}
	});
}

exports.onMessage = function (callback) {
	msgCallback = callback;
}

// export topics
for (var topic in topics) {
	exports[topic] = topics[topic];
}

exports.init = function () {
	if (!config.USE_BROKER) return;
	
	log.info('Initilizing Kafka ...');
	
	initClient();
}