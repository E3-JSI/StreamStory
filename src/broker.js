var kafka = require('kafka-node');
var utils = require('./utils.js');
var config = require('../config.js');

var RECONNECT_INTERVAL = 10000;

//var BROKER_URL = '';
var ZOOKEPER_PORT = config.integration.zookeperPort;
var PRODUCER_PORT = config.integration.producerPort;
var BROKER_URL = config.integration.brokerUrl;

var CLIENT_OPTS = {
	sessionTimeout: 1000*60*60*24*7,
	retries: 100000,
	spinDelay: 10000
};

var topics = {
	// input topics 
	RAW_DATA_CONSUMER_TOPIC: 'si.ijs.internal.raw',
	CEP_DATA_CONSUMER_TOPIC: 'si.ijs.internal.cep',
	// output topics
	ENRICHED_DATA_PRODUCER_TOPIC: 'si.ijs.internal.enriched',
	PREDICTION_PRODUCER_TOPIC: 'si.ijs.internal.oa_output'
};

var client;
var producer;
var consumer;

var fzi = null;

var reconnectId = null;

function reconnect() {
	if (reconnectId != null)  {
		log.warn('Tried to reconnect while timeout already set!');
		return;
	}
	
	return;	// TODO remove
	
	log.debug('Setting timeout for reconnect ...');
	reconnectId = setTimeout(function () {
		log.debug('Reconnecting ...');
		
		reconnectId = null;
		
		initClient(function (e) {
			if (e != null) {
				log.error(e, 'Failed to initialize client!');
				reconnect();
			} else {
				log.info('Client successfully initialized!');
			}
		});
	}, RECONNECT_INTERVAL);
}

function reconnectCb(e) {
	if (e != null) {
		log.error(e, 'Failed to close client!');
		callback(e);
		return;
	}
	
	reconnect();
}

function closeClient(callback) {
	if (client.zk.closed) {
		log.info('Client already closed!');
		callback();
	} else if (!client.ready) {
		log.info('Client is not ready, so it cannot be closed!');
		callback();
	} else {
		log.debug('Closing the client ...');
		client.close(function (e) {
			if (e != null) {
				log.error(e, 'Failed to close client!');
				callback(e);
				return;
			}
			
			log.info('Client closed!');
			callback();
		});
	}
}

function initConsumer(callback) {
	log.info('Initializing consumer ...');
	
	var pauseCount = 0;
	
	var offset = new kafka.Offset(client);
	
	consumer = new kafka.Consumer(
			client, 
			[
			 	{topic: topics.RAW_DATA_CONSUMER_TOPIC, partition: 0},
			 	{topic: topics.CEP_DATA_CONSUMER_TOPIC, partition: 0}
			],
			{
				autoCommit: true
			}
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
		callback();
	})
	
	consumer.on('error', function (e) {
		log.error(e, 'Exception in consumer!');
		
//		if (!consumer.ready) {
//			log.info('Consumer already closed!')
//		} else {
//			log.debug('Closing the consumer!');
//			consumer.close(function (e1) {
//				if (e1 != null) {
//					log.error(e1, 'Exception while closing the consumer!');
//					reconnectCb(e1);
//				}
//				
//				log.debug('Consumer closed!');
//				reconnectCb();
//			});
//		}
	});
	
	consumer.on('offsetOutOfRange', function (e) {
		log.error(e, 'Offset out of range for topic %s!', JSON.stringify(e));
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
		log.info('Adding broker message handler ...');
		
		var nReceivedRaw = 0;
		var nReceivedCep = 0;
		
		var nFromDominik = 0;
		
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
						if (fzi.hasTopic(topic)) {
							if (++nFromDominik % 100 == 0)
								log.info("Received %d messages from dominik ...", nFromDominik);
							// TODO
						}
						else {
							log.warn('Invalid topic: %s, message: %s', topic, msg.value);
						}
					}
				}
			} catch (e) {
				log.error(e, 'Exception while receiving message!');
			}
		});
	}
	
	log.info('Consumer initialized!');
}

function initClient(callback) {
	log.info('Initializing Kafka client ...');
	
	client = new kafka.Client(BROKER_URL + ':' + ZOOKEPER_PORT, 'StreamStory', CLIENT_OPTS);
	producer = new kafka.Producer(client);
	
	log.info('Initilizing producer ...');
	producer.on('ready', function () {
		log.info('Producer ready, creating topics ...');
		
		var createTopics = [];
		for (var topic in topics) {
			createTopics.push(topics[topic]);
		}
		
		producer.createTopics(createTopics, false, function (e, data) {
			if (e != null) {
				callback(e);
			} else {
				log.info('Producer topics ready: %s!', JSON.stringify(data));
				initConsumer(callback);
			}
		});
	});
	
	producer.on('error', function (e) {
		log.error(e, 'Exception in the producer!');
//		closeClient(reconnectCb);
	});
	
	client.on('error', function (e) {
		log.error(e, 'Error in client!');
//		closeClient(reconnectCb);
	});
}

var nsent = 0;

exports.send = function (topic, msg) {
	if (!config.USE_BROKER) return;
	
	if (nsent++ % config.BROKER_PRINT_INTERVAL == 0 && log.debug())
		log.debug('Sent %d messages: %s',nsent, JSON.stringify(msg));
	
	if (!producer.ready) {
		log.warn('Cannot send to broker, the producer is not ready!');
		return;
	}
	
	if (!client.ready) {
		log.warn('Cannot send to broker, the client is not ready!');
		return;
	}
	
	if (client.zk.closed) {
		log.warn('Cannot send to broker, the zookeper is not ready!');
		return;
	}
	
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

exports.initInputTopic = function (topic, callback) {
	if (callback == null) throw new Error('Callback undefined!');
	
	log.info('Adding input topic: ' + topic);
	
	if (topic in topics) {
		log.info('Cannot add a system topic: %s', topic);
		return;
	}
	
	consumer.addTopics([topic], function (e, added) {
		if (e != null) {
			callback(e);
			return;
		}
		
		if (added) {
			log.info('Input topic added!');
			callback();
		} else {
			callback(new Error('Topic ' + topic + ' not added!'));
		}
	});
}

exports.initOutputTopic = function (topic, callback) {
	if (callback == null) throw new Error('Callback undefined!');
	
	log.info('Adding output topic: ' + topic);
	
	if (topic in topics) {
		log.info('Cannot add a system topic: %s', topic);
		callback();
		return;
	}
	
	producer.createTopics([topic], false, function (e, data) {
		if (e != null) {
			callback(e);
		} else {
			log.info('Producer topics ready: %s!', JSON.stringify(data));
			callback();
		}
	});
}

exports.removeInputTopic = function (topic, callback) {
	if (callback == null) throw new Error('Callback not defined!');
	
	log.info('Removing input topic: ' + topic);
	
	if (topic in topics) {
		log.info('Cannot remove a system topic: %s', topic);
		return;
	}
	
	consumer.removeTopics([topic], function (e, removed) {
		if (e != null) {
			log.error(e, 'Error while removing topic: %s', topic);
			callback(e);
			return;
		}
		
		if (removed) {
			callback();
		} else {
			callback(new Error('Topic not removed!'));
		}
	});
}

exports.removeOutputTopic = function (topic, callback) {
	if (callback == null) throw new Error('Callback not defined!');
	
	log.info('Removing output topic: ' + topic);
	
	if (topic in topics) {
		log.info('Cannot remove a system topic: %s', topic);
		return;
	}
	
	log.warn('Output topic cannot be removed, API missing!');
	callback();
}

exports.init = function () {
	if (!config.USE_BROKER) return;
	
	log.info('Initilizing Kafka ...');
	
	initClient(function () {
		log.info('Broker initialized!');
	});
}

exports.setFzi = function(_fzi) {
	fzi = _fzi;
}