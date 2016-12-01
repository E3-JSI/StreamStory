/* jshint node: true */
/* globals log */

var kafka = require('kafka-node');
var config = require('../config.js');

// var RECONNECT_INTERVAL = 10000;

//var BROKER_URL = '';
var ZOOKEPER_PORT = config.integration.zookeperPort;
// var PRODUCER_PORT = config.integration.producerPort;
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
    PREDICTION_PRODUCER_TOPIC: 'si.ijs.internal.oa_output',
    // friction coefficient output topics
    // TOPIC_PUBLISH_COEFFICIENT_SWIVEL: 'eu.proasense.internal.sp.internal.outgoing.10002',
    // TOPIC_PUBLISH_COEFFICIENT_GEARBOX: 'eu.proasense.internal.sp.internal.outgoing.10002'
    TOPIC_PUBLISH_COEFFICIENT_SWIVEL: 'eu.proasense.streamstory.output.coefficient.gearbox',
    TOPIC_PUBLISH_COEFFICIENT_GEARBOX: 'eu.proasense.streamstory.output.coefficient.swivel',

    TOPIC_REPLAY_START: 'replay.start'
};

var client;
var producer;
var consumer;

var msgCallback = null;

var fzi = null;

function initConsumer(callback) {
    log.info('Initializing consumer ...');

    var pauseCount = 0;

    var offset = new kafka.Offset(client);

    consumer = new kafka.Consumer(
        client,
        [
            {topic: topics.RAW_DATA_CONSUMER_TOPIC, partition: 0},
            {topic: topics.CEP_DATA_CONSUMER_TOPIC, partition: 0},
            {topic: topics.TOPIC_REPLAY_START, partition: 0}
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

        // var nFromDominik = 0;

        consumer.on('message', function (msg) {
            try {
                var topic = msg.topic;

                // check if we got any messages that are not JSON
                if (topic == topics.TOPIC_REPLAY_START) {
                    log.info('Received replay start message: %s', msg.value);
                    if (config.RESTART_ON_REPLAY) {
                        log.info('Restarting component ...');
                        process.exit(0);
                    } else {
                        log.info('Will not restart, not configured to do so!');
                        return;
                    }
                }

                var payload = JSON.parse(msg.value);

                if (msgCallback != null) {
                    if (topic == topics.RAW_DATA_CONSUMER_TOPIC) {
                        if (nReceivedRaw++ % config.BROKER_PRINT_INTERVAL == 0 && log.debug())
                            log.debug('Received %d raw data messages ...', nReceivedRaw);

                        msgCallback({type: 'raw', payload: payload});
                    } else if (topic == topics.CEP_DATA_CONSUMER_TOPIC) {
                        if (nReceivedCep++ % config.BROKER_PRINT_INTERVAL == 0 && log.debug())
                            log.debug('Received %d CEP messages %s ...', nReceivedCep, JSON.stringify(payload));

                        msgCallback({type: 'cep', payload: payload});
                    } else {
                        //						if (fzi.hasTopic(topic)) {
                        //							if (++nFromDominik % 100 == 0)
                        //								log.info("Received %d messages from dominik ...", nFromDominik);
                        //							msgCallback({type: 'enriched', payload: payload});
                        //							// TODO
                        //						}
                        //						else {
                        //							log.warn('Invalid topic: %s, message: %s', topic, msg.value);
                        //						}
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

(function () {
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

            if (log.trace())
                log.trace('Message sent through the broker: %s', JSON.stringify(data));
        });
    }
})();

exports.onMessage = function (callback) {
    msgCallback = callback;
}

// export topics
for (var topic in topics) {
    exports[topic] = topics[topic];
}

exports.initInputTopic = function (topic, callback) {
    //	if (callback == null) throw new Error('Callback undefined!');
    //
    //	log.info('Adding input topic: ' + topic);
    //
    //	if (topic in topics) {
    //		log.info('Cannot add a system topic: %s', topic);
    //		return;
    //	}
    //
    //	consumer.addTopics([topic], function (e, added) {
    //		if (e != null) {
    //			callback(e);
    //			return;
    //		}
    //
    //		if (added) {
    //			log.info('Input topic added!');
    //			callback();
    //		} else {
    //			callback(new Error('Topic ' + topic + ' not added!'));
    //		}
    //	});

    callback();
}

exports.initOutputTopic = function (topic, callback) {
    if (!config.USE_BROKER) return;
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
    if (!config.USE_BROKER) return;
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
    if (!config.USE_BROKER) return;
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
