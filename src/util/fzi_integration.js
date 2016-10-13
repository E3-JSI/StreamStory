var async = require('async');

var utils = require('../utils.js');
var db = require('../db/mysqldb.js')

var ACTIVITY_OPERATION = 'ActivityDetection';
var PREDICTION_OPERATION = 'Prediction';

var STREAM_PIPES_PATH = '/streampipes';

var broker = null;
var modelstore = null;

var integrator = (function () {
    /*
     * var modelIdOptsH = {
     *		mid: {
     *			operation1: {
     *				pipelineId1: {
     *					topics: {
     *						input: '...',
     *						output: ''
     *					}
     *				},
     *				pipelineId1: {
     *					topics: {
     *						input: '...',
     *						output: ''
     *					}
     *				},
     *			}
     *			...
     *		}
     *	};
     */
    var modelConfigH = {};
    var topicCountH = {};

    function removeTopics(topics, callback) {
        var input = topics.input;
        var output = topics.output;

        if (!(input in topicCountH)) throw new Error('Topic ' + input + ' not present in hash!');
        if (!(output in topicCountH)) throw new Error('Topic ' + output + ' not present in hash!');

        if (topicCountH[input] == 0) throw new Error('Count for topic ' + input + ' is 0! Cannot remove!');
        if (topicCountH[output] == 0) throw new Error('Count for topic ' + output + ' is 0! Cannot remove!');

        async.parallel([
            function (cb) {
                topicCountH[input]--;
                if (topicCountH[input] == 0) {
                    log.info('Removing topic: %s', input);
                    delete topicCountH[input];
                    broker.removeInputTopic(input, cb);
                }
                else {
                    cb();
                }
            },
            function (cb) {
                topicCountH[output]--;
                if (topicCountH[output] == 0) {
                    log.info('Removing topic: %s', output);
                    delete topicCountH[output];
                    broker.removeOutputTopic(output, callback);
                }
                else {
                    cb();
                }
            }
        ], function (e) {
            if (e != null) {
                log.error(e, 'Exception while removing topics!');
                callback(e);
                return;
            }

            callback();
        });
    }

    function initTopics(topics, callback) {
        var input = topics.input;
        var output = topics.output;

        if (!(input in topicCountH)) { topicCountH[input] = 0; }
        if (!(output in topicCountH)) { topicCountH[output] = 0; }

        //=============================================
        // TODO is this safe???
        if (topicCountH[input] > 0) {
            log.warn('Topic %s already exists!', input);
        }

        if (topicCountH[output] > 0) {
            log.warn('Topic %s already exists!', output);
        }

        async.parallel([
            function (cb) {
                broker.initOutputTopic(output, cb);
            },
            function (cb) {
                broker.initInputTopic(input, cb);
            }
        ],
            function (e) {
                if (e != null) {
                    log.error(e, 'Exception while initializing topics!');
                    callback(e);
                    return;
                }

                topicCountH[input]++;
                topicCountH[output]++;

                callback();
            });

        //=============================================
    }

    var that = {
        // functions
        getTopics: function (mid, operation) {
            if (!(mid in modelConfigH)) return [];
            var operations = modelConfigH[mid];
            if (!(operation in operations)) return [];
            var pipelines = operations[operation];

            var result = [];
            for (var pipelineId in pipelines) {
                result.push(pipelines[pipelineId]);
            }

            return result;
        },

        hasTopic: function (topic) {
            return topic in topicCountH;
        },

        detachPipeline: function (mid, pipelineId, callback) {
            log.info('Deleting pipeline: %s, mid: %s', pipelineId, mid);

            var operations = modelConfigH[mid];

            var operation = null;
            for (var op in operations) {
                if (pipelineId in operations[op]) {
                    operation = op;
                    break;
                }
            }

            if (operation == null) {
                callback(new Error('Could not find operation for pipeline: ' + pipelineId));
                return;
            }

            var pipelines = operations[operation];
            var topics = pipelines[pipelineId];

            removeTopics(topics, function (e) {
                if (e != null) {
                    log.error(e, 'Exception while detaching pipeline: %s', pipelineId);
                    callback(e);
                    return;
                }

                delete pipelines[pipelineId];
                if (Object.keys(pipelines).length == 0) {
                    log.info('No pipeline configurations left, deleting ...');
                    delete operations[operation];

                    if (Object.keys(operations).length == 0) {
                        log.info('No operation configuration left, deleting ...');
                        delete modelConfigH[mid];
                    }
                }

                callback();
            });
        },

        attachPipeline: function (opts, callback) {
            var mid = opts.mid;
            var pipelineId = opts.pipelineId;
            var operation = opts.operation;
            var inputTopic = opts.topics.input;
            var outputTopic = opts.topics.output;

            log.info('Attaching new pipeline mid: %s, pipelineId: %s, inputTopic: %s, outputTopic: %s', mid, pipelineId, inputTopic, outputTopic);

            if (!(mid in modelConfigH)) {
                modelConfigH[mid] = {}
            }

            var operations = modelConfigH[mid];

            if (!(operation in operations)) {
                operations[operation] = {}
            }

            var pipelines = operations[operation];

            if (pipelineId in pipelines) {
                that.detachPipeline(mid, pipelineId, function (e) {
                    if (e != null) {
                        log.error(e, 'Exception while detaching a pipeline!');
                        callback(e);
                        return;
                    }

                    // initialize the topics
                    pipelines[pipelineId] = opts.topics;

                    initTopics(opts.topics, function (e) {
                        if (e != null) {
                            log.error(e, 'Exception while initializing topic for pipeline: %s', pipelineId);

                            delete pipelines[pipelineId];
                            if (Object.keys(pipelines).length == 0) {
                                log.info('No pipeline configurations left, deleting ...');
                                delete operations[operation];

                                if (Object.keys(operations).length == 0) {
                                    log.info('No operation configuration left, deleting ...');
                                    delete modelConfigH[mid];
                                }
                            }

                            callback(e);
                            return;
                        }

                        callback();
                    });
                });
            }
            else {
                // initialize the topics
                pipelines[pipelineId] = opts.topics;

                initTopics(opts.topics, function (e) {
                    if (e != null) {
                        log.error(e, 'Exception while initializing topic for pipeline: %s', pipelineId);

                        delete pipelines[pipelineId];
                        if (Object.keys(pipelines).length == 0) {
                            log.info('No pipeline configurations left, deleting ...');
                            delete operations[operation];

                            if (Object.keys(operations).length == 0) {
                                log.info('No operation configuration left, deleting ...');
                                delete modelConfigH[mid];
                            }
                        }

                        callback(e);
                        return;
                    }

                    callback();
                });
            }
        }
    };

    return that;
})();

exports.STREAM_PIPES_PATH = STREAM_PIPES_PATH;
exports.ACTIVITY_OPERATION = ACTIVITY_OPERATION;
exports.PREDICTION_OPERATION = PREDICTION_OPERATION;

exports.getTopics = function (mid, operation) {
    return integrator.getTopics(mid, operation);
}

exports.hasTopic = function (topic) {
    return integrator.hasTopic(topic);
}

exports.initWs = function (app) {
    app.get(STREAM_PIPES_PATH + '/models', function (req, res) {
        try {
            var username = req.query.username;
            var operation = req.query.analyticsOperation;

            log.info('Received StreamPipes request for models for user: %s', username);

            if (username == null || username == '') {
                utils.handleBadInput(res, 'User field missing!');
                return;
            }

            if (operation != ACTIVITY_OPERATION &&
                operation != PREDICTION_OPERATION) {
                    utils.handleBadInput(res, 'Field analyticsOperation should be either "activity" or "prediction"!');
                    return;
                }

            var activeModels = modelstore.getActiveModels();

            if (log.debug())
                log.debug('%d active models in total', activeModels.length);

            var mids = [];

            if (operation  == integrator.ACTIVITY_OPERATION) {
                (function () {
                    if (log.debug())
                        log.debug('Requested activities ...');

                    for (var i = 0; i < activeModels.length; i++) {
                        var model = activeModels[i];

                        if (model.getModel().isActivityDetector()) {
                            mids.push(model.getId());
                        }
                    }
                })();
            }
            else {	// prediction
                (function () {
                    if (log.debug())
                        log.debug('Requested predictive models ...');
                    for (var i = 0; i < activeModels.length; i++) {
                        var model = activeModels[i];

                        if (model.getModel().isPredictor()) {
                            mids.push(model.getId());
                        }
                        mids.push()
                    }
                })();
            }

            db.fetchModelsByIds(mids, function (e, models) {
                if (e != null) {
                    utils.handleServerError(e, req, res);
                    return;
                }

                var result = [];

                for (var i = 0; i < models.length; i++) {
                    var model = models[i];

                    if (model.username != username) continue;

                    result.push({
                        id: model.mid,
                        name: model.name,
                        description: model.description
                    })
                }

                if (log.debug())
                    log.debug('Found %d activity models for user %s', result.length, username);

                res.send(result);
                res.end();
            });
        } catch (e) {
            log.error(e, 'Failed to process StreamPipes models request!');
            utils.handleServerError(e, req, res);
        }
    });

    app.post(STREAM_PIPES_PATH + '/invoke', function (req, res) {
        try {
            var config = req.body;

            log.info('Processing invoke request ...');

            var pipelineId = config.pipelineId;
            var modelId = config.modelId;
            var operation = config.analyticsOperation;
            var zookeeperHost = config.input.zookeeperHost;
            var zookeeperPort = config.input.zookeeperPort;
            var inputTopic = config.input.inputTopic;
            var kafkaHost = config.output.kafkaHost;
            var kafkaPort = config.output.kafkaPort;
            var outputTopic = config.output.outputTopic;

            if (pipelineId == null || pipelineId == '') {
                log.debug('Invalid pipeline ID!');
                utils.handleBadInput(res, 'Pipeline ID required!');
                return;
            }
            if (modelId == null || modelId == '') {
                log.debug('Invalid model ID!');
                utils.handleBadInput(res, 'Model ID required!');
                // TODO also check if the model ID is valid!
                return;
            }
            if (operation != ACTIVITY_OPERATION && operation != PREDICTION_OPERATION) {
                log.debug('Invalid operation ID!');
                utils.handleBadInput(res, 'Field analyticsOperation should be either "activity" or "prediction"!');
                // TODO check if the model can handle this operation
                return;
            }
            if (zookeeperHost == null || zookeeperHost == '') {
                log.debug('Invalid zookeper host!');
                utils.handleBadInput(res, 'Zookeper host missing!');
                return;
            }
            if (zookeeperPort == null || zookeeperPort == '') {
                log.debug('Invalid zookeper port!');
                utils.handleBadInput(res, 'Zookeper port missing!');
                return;
            }
            if (inputTopic == null || inputTopic == '') {
                log.debug('Invalid input topic!');
                utils.handleBadInput(res, 'Input topic missing!');
                return;
            }
            if (kafkaHost == null || kafkaHost == '') {
                log.debug('Invalid Kafka host!');
                utils.handleBadInput(res, 'Kafka host missing!');
                return;
            }
            if (kafkaPort == null || kafkaPort == '') {
                log.debug('Invalid Kafka port!');
                utils.handleBadInput(res, 'Kafka port missing!');
                return;
            }
            if (outputTopic == null || outputTopic == '') {
                log.debug('Invalid output topic!');
                utils.handleBadInput(res, 'Input topic missing!');
                return;
            }

            integrator.attachPipeline({
                mid: modelId,
                pipelineId: pipelineId,
                operation: operation,
                topics: {
                    input: inputTopic,
                    output: outputTopic
                }
            }, function (e) {
                if (e != null) {
                    utils.handleServerError(e, req, res);
                    return;
                }

                res.status(204);	// no content
                res.end();
            });
        } catch (e) {
            log.error(e, 'Failed to attach model to StreamPipes!');
            utils.handleServerError(e, req, res);
        }
    });

    app.post(STREAM_PIPES_PATH + '/detach', function (req, res) {
        try {
            var pipelineId = req.body.pipelineId;
            var modelId = req.body.modelId;

            integrator.detachPipeline(modelId, pipelineId, function (e) {
                if (e != null) {
                    utils.handleServerError(e, req, res);
                    return;
                }

                res.status(204);	// no content
                res.end();
            });
        } catch (e) {
            log.error(e, 'Failed to detach a model from StreamPipes!');
            utils.handleServerError(e, req, res);
        }
    });
}

exports.init = function (opts) {
    if (opts.broker == null) throw new Error('Broker missing when initializing integration!');
    if (opts.modelStore == null) throw new Error('Model store missing when initializing integration!');

    broker = opts.broker;
    modelstore = opts.modelStore;

    broker.setFzi(exports);
}
