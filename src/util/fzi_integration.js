var async = require('async');

var utils = require('../utils.js');

var ACTIVITY_OPERATION = 'ActivityDetection';
var PREDICTION_OPERATION = 'Prediction';
var FRICTION_OPERATION = 'Friction';

var STREAM_PIPES_PATH = '/streampipes';

var broker = null;
var modelstore = null;
var db = null;

var integrator = (function () {
    /*
     * var modelConfigH = {
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
     *
     * var modelIndependentConfigH = {
     *     operation1: {
     *         pipelineId1: {
     *             topics: {
     *                 input: '...',
     *                 output: '...'
     *             }
     *         },
     *         pipelineId2: {
     *             topics: {
     *                 input: '...',
     *                 output: '...'
     *             }
     *         }
     *     }
     * }
     *
     */

    var modelConfigH = {};
    var modelIndependentConfigH = {};
    var topicCountH = {};

    function isModelIndependentOperation(operation) {
        return operation == FRICTION_OPERATION;
    }

    function isModelDependentOperation(operation) {
        return !isModelIndependentOperation(operation);
    }

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
                    broker.removeOutputTopic(output, cb);
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

    function attachPipelineInternal(opts, callback) {
        var pipelineId = opts.pipelineId;
        var operation = opts.operation;
        var inputTopic = opts.topics.input;
        var outputTopic = opts.topics.output;

        if (isModelDependentOperation(operation)) {
            var mid = opts.mid;

            if (log.debug())
                log.debug('Internally attaching new pipeline mid: %s, pipelineId: %s, inputTopic: %s, outputTopic: %s', mid, pipelineId, inputTopic, outputTopic);

            (function () {
                if (!(mid in modelConfigH)) {
                    modelConfigH[mid] = {}
                }

                var operations = modelConfigH[mid];

                if (!(operation in operations)) {
                    operations[operation] = {}
                }

                var pipelines = operations[operation];

                // initialize the topics
                pipelines[pipelineId] = opts.topics;

                initTopics(opts.topics, function (e) {
                    if (e != null) {
                        log.error(e, 'Exception while initializing topic for pipeline: %s', pipelineId);

                        delete pipelines[pipelineId];
                        if (Object.keys(pipelines).length == 0) {
                            if (log.debug())
                                log.debug('No pipeline configurations left, deleting ...');
                            delete operations[operation];

                            if (Object.keys(operations).length == 0) {
                                if (log.debug())
                                    log.debug('No operation configuration left, deleting ...');
                                delete modelConfigH[mid];
                            }
                        }

                        callback(e);
                        return;
                    }

                    callback();
                });
            })();
        }
        else {
            if (log.debug())
                log.debug('Internally attaching new pipeline: pipelineId: %s, inputTopic: %s, outputTopic: %s');

            (function () {
                var operations = modelIndependentConfigH;

                if (!(operation in operations)) {
                    operations[operation] = {}
                }

                var pipelines = operations[operation];

                // initialize the topics
                pipelines[pipelineId] = opts.topics;

                initTopics(opts.topics, function (e) {
                    if (e != null) {
                        log.error(e, 'Failed to initialize topics for pipeline: %s', pipelineId);
                        // need to clean up

                        delete pipelines[pipelineId];
                        if (Object.keys(pipelines).length == 0) {
                            if (log.debug())
                                log.debug('No pipeline configuration left, deleting ...');
                            delete operations[operation];
                        }

                        return callback(e);
                    }

                    return callback();
                })
            })();
        }
    }

    function cleanupDependent(mid, operation, pipelineId) {
        var operations = modelConfigH[mid];
        var pipelines = operations[operation];

        if (pipelines == null) throw new Error('Could not find dependent pipelines for modelId: ' + mid + ' operation: ' + operation);

        delete pipelines[pipelineId];
        if (Object.keys(pipelines).length == 0) {
            log.info('No pipeline configurations left, deleting ...');
            delete operations[operation];

            if (Object.keys(operations).length == 0) {
                log.info('No operation configuration left, deleting ...');
                delete modelConfigH[mid];
            }
        }
    }

    function cleanupIndependent(operation, pipelineId) {
        var operations = modelIndependentConfigH;
        var pipelines = operations[operation];

        if (pipelines == null) throw new Error('Could not find independent pipelines for operation: ' + operation);

        delete pipelines[pipelineId];
        if (Object.keys(pipelines).length == 0) {
            log.info('No pipeline configurations left, deleting ...');
            delete operations[operation];
        }
    }

    function detachDependentPipeline(mid, pipelineId, callback) {
        log.info('Detaching pipeline \'%s\' for model %s', pipelineId, mid);

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

        db.removePipeline(pipelineId, function (e) {
            if (e != null) {
                callback(e);
                return;
            }

            removeTopics(topics, function (e) {
                if (e != null) {
                    log.error(e, 'Exception while detaching pipeline: %s', pipelineId);
                    callback(e);
                    return;
                }

                cleanupDependent(mid, operation, pipelineId);
                callback();
            });
        })
    }

    function detachIndependentPipeline(pipelineId, callback) {
        if (log.info())
            log.info('Detaching independent pipeline \'%s\' ...', pipelineId);

        var operation = null;
        for (var op in modelIndependentConfigH) {
            if (pipelineId in modelIndependentConfigH[op]) {
                operation = op;
                break;
            }
        }

        if (operation == null) {
            callback(new Error('Could not find operation for pipeline: ' + pipelineId));
            return;
        }

        var pipelines = modelIndependentConfigH[operation];
        var topics = pipelines[pipelineId];

        db.removePipeline(pipelineId, function (e) {
            if (e != null) return callback(e);

            removeTopics(topics, function (e) {
                if (e != null) return callback(e);

                cleanupIndependent(operation, pipelineId);
                callback();
            })
        })
    }

    var that = {
        loadFromDb: function () {
            setTimeout(function () {    // TODO remove this delay, first initialize the broker and then initialize the integration
                log.info('Loading FZI pipelines from DB ...');

                function attachParallel(opts) {
                    return function (xcb) {
                        log.info('Initializing pipeline: %s', JSON.stringify(opts));
                        attachPipelineInternal(opts, xcb);
                    }
                }

                db.fetchAllPipelines(function (e, pipelines) {
                    if (e != null) {
                        log.error('Failed to load existing pipelines from the database!');
                        throw e;
                    }

                    var parallel = [];
                    for (var i = 0; i < pipelines.length; i++) {
                        parallel.push(attachParallel(pipelines[i].config));
                    }

                    async.parallel(parallel, function (e) {
                        if (e != null) {
                            log.fatal('Failed to load pre-exising FZI pipelines! Terminating!!!');
                            process.exit(10);
                        }
                    })
                })
            }, 10000);
        },

        // functions
        getTopics: function (operation, mid) {
            var result = [];

            if (mid != null) {
                (function () {
                    if (log.trace())
                        log.trace('Fetching model dependent topics for model with ID: %s with operation %s', mid, operation);

                    if (!(mid in modelConfigH)) return [];
                    var operations = modelConfigH[mid];
                    if (!(operation in operations)) return [];
                    var pipelines = operations[operation];

                    if (log.trace())
                        log.trace('Found pipelines: %s', JSON.stringify(pipelines));

                    for (var pipelineId in pipelines) {
                        result.push(pipelines[pipelineId]);
                    }
                })();
            }
            else {
                (function () {
                    if (log.trace())
                        log.trace('Fetching model dependent topics for operation: %s', operation);

                    var pipelines = modelIndependentConfigH[operation];

                    if (log.trace())
                        log.trace('Fount pipelines: %s', JSON.stringify(pipelines));

                    for (var pipelineId in pipelines) {
                        result.push(pipelines[pipelineId]);
                    }
                })();
            }

            return result;
        },

        hasTopic: function (topic) {
            return topic in topicCountH;
        },

        detachPipeline: function (pipelineId, callback) {
            log.info('Deleting pipeline: %s', pipelineId);

            var parallel = [];

            function detachDependentParallel(mid, pipelineId) {
                return function (xcb) {
                    detachDependentPipeline(mid, pipelineId, xcb);
                }
            }

            function detachIndependentParallel(pipelineId) {
                return function (xcb) {
                    detachIndependentPipeline(pipelineId, xcb);
                }
            }

            (function () {
                var mids = [];
                var usedMids = {};
                for (var mid in modelConfigH) {
                    var operations = modelConfigH[mid];
                    for (var operation in operations) {
                        var pipelines = operations[operation];
                        for (var pid in pipelines) {
                            if (pid == pipelineId && !(mid in usedMids)) {
                                mids.push(mid);
                                usedMids[mid] = true;
                            }
                        }
                    }
                }

                for (var i = 0; i < mids.length; i++) {
                    parallel.push(detachDependentParallel(mids[i], pipelineId));
                }
            })();

            (function () {
                for (var operation in modelIndependentConfigH) {
                    var pipelines = modelIndependentConfigH[operation];
                    for (var pid in pipelines) {
                        if (pid == pipelineId) {
                            parallel.push(detachIndependentParallel(pipelineId));
                        }
                    }
                }
            })();

            if (parallel.length > 0) {
                async.parallel(parallel, function (e) {
                    if (e != null) return callback(e);
                    callback();
                })
            } else {
                callback(new Error('Could not find any configuration corresponding to pipeline: ' + pipelineId));
            }
        },

        attachPipeline: function (opts, callback) {
            var pipelineId = opts.pipelineId;
            var operation = opts.operation;
            var inputTopic = opts.topics.input;
            var outputTopic = opts.topics.output;

            if (!isModelIndependentOperation(operation)) {
                var mid = opts.mid;

                if (log.info())
                    log.info('Attaching new pipeline mid: %s, pipelineId: %s, inputTopic: %s, outputTopic: %s', mid, pipelineId, inputTopic, outputTopic);

                if (!(mid in modelConfigH)) {
                    modelConfigH[mid] = {}
                }

                (function () {
                    var operations = modelConfigH[mid];

                    if (!(operation in operations)) {
                        operations[operation] = {}
                    }

                    var pipelines = operations[operation];

                    if (pipelineId in pipelines) {
                        log.info('Pipeline already exists, will delete pipeline and make a recursive call ...');

                        that.detachPipeline(pipelineId, function (e) {
                            if (e != null) {
                                log.error(e, 'Exception while detaching a pipeline!');
                                callback(e);
                                return;
                            }

                            log.info('Pipeline deleted, making recursive call ...');
                            that.attachPipeline(opts, callback);
                        });
                    }
                    else {
                        db.insertPipeline(pipelineId, opts, function (e) {
                            if (e != null) {
                                callback(e);
                                return;
                            }

                            try {
                                attachPipelineInternal(opts, callback);
                            } catch (e) {
                                log.error(e, 'Exception while inserting pipeline!');
                                callback(e);
                            }
                        })
                    }
                })();
            }
            else {
                if (log.info())
                    log.info('Attaching new pipeline independent of a model: pipelineId: %s, inputTopic: %s, outputTopic: %s', pipelineId, inputTopic, outputTopic);

                (function () {
                    var operations = modelIndependentConfigH;

                    if (!(operation in operations)) {
                        operations[operation] = {};
                    }

                    var pipelines = operations[operation];

                    if (pipelineId in pipelines) {
                        log.info('Pipeline already exists, will delete pipeline and make recursive call ...');

                        that.detachPipeline(pipelineId, function (e) {
                            if (e != null) {
                                callback(e);
                                return;
                            }

                            if (log.debug())
                                log.debug('Pipeline deleted, making recursive call ...');

                            that.attachPipeline(opts, callback);
                        })
                    }
                    else {
                        db.insertPipeline(pipelineId, opts, function (e) {
                            if (e != null) {
                                callback(e);
                                return;
                            }

                            try {
                                attachPipelineInternal(opts, callback);
                            } catch (e) {
                                log.error(e, 'Exception while attaching model independent pipeline!');
                                callback(e);
                            }
                        })
                    }
                })();
            }
        }
    };

    return that;
})();

exports.STREAM_PIPES_PATH = STREAM_PIPES_PATH;
exports.ACTIVITY_OPERATION = ACTIVITY_OPERATION;
exports.PREDICTION_OPERATION = PREDICTION_OPERATION;
exports.FRICTION_OPERATION = FRICTION_OPERATION;

exports.getTopics = function (operation, mid) {
    return integrator.getTopics(operation, mid);
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

            integrator.detachPipeline(pipelineId, function (e) {
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
    if (opts.db == null) throw new Error('DB missing when initializing integration!');

    broker = opts.broker;
    modelstore = opts.modelStore;
    db = opts.db;

    broker.setFzi(exports);

    integrator.loadFromDb();
}
