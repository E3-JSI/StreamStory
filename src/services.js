let async = require('async');
let path = require('path');
let fs = require('fs');
let mkdirp = require('mkdirp');

let express = require('express');
let bodyParser = require("body-parser");
let multer = require('multer');
let session = require('express-session');
let cookieParser = require('cookie-parser');

let SessionStore = require('./util/sessionstore.js');
let utils = require('./utils.js');
let consts = require('./util/consts.js');
let config = require('../config.js');
let fields = require('../fields.js');
let transform = require('./util/transform.js');
let fzi = require('./util/fzi_integration.js');
let routers = require('./util/routers.js');

let ModelStore = require('./util/modelstore.js');
let WebSocketWrapper = require('./util/servicesutil.js');

let ssmodules = require('./ssmodules.js');

let perf = require('./util/perf_tools.js');

// CLASSES
let HttpUtils = ssmodules.HttpUtils;

let throughput = perf.throughput();
// let latency = perf.latency();
// let toc = function () {};

let qmutil = qm.qm_util;

let LOGIN_API = 'login';
let GENERAL_API = 'api';

let UI_PATH = '/';
let LOGIN_PATH = '/' + LOGIN_API;
let API_PATH = '/' + GENERAL_API;
let DATA_PATH = '/data';
let WS_PATH = '/ws';

let LONG_REQUEST_TIMEOUT = 1000*60*60*24;   // 24 hours

let app = express();

let fileBuffH = {}; // if I store the file buffer directly into the session, the request takes forever to complete

let titles = {};
titles[consts.pages.INDEX] = 'Index';
titles[consts.pages.LOGIN] = 'Login';
titles[consts.pages.REGISTER] = 'Register';
titles[consts.pages.RESET_PASSWORD] = 'Reset Password';
titles[consts.pages.DASHBOARD] = 'Dashboard';
titles[consts.pages.MODEL] = 'View Model';
titles[consts.pages.PROFILE] = 'Profile';

let base;

let db;
let pipeline;
let modelStore;
let modelManager;

let counts = {};
let storeLastTm = {};
let totalCounts = 0;

let lastRawTime = -1;
let intensConfig = {};

//=====================================================
// UTILITY METHODS
//=====================================================

// function getRequestedPage(req) {
//     return req.path.split('/').pop();
// }

function redirect(res, page) {
    if (log.debug())
        log.debug('Redirecting to %s ...', page);
    res.redirect(page);
}

function addRawMeasurement(val) {
    if (log.trace())
        log.trace('Received raw measurememnt %s ...', JSON.stringify(val));

    var insertVals = transform.transform(val);

    for (var i = 0; i < insertVals.length; i++) {
        var transformed = insertVals[i];

        var storeNm = transformed.store;
        var timestamp = transformed.timestamp;

        if (!(storeNm in counts)) counts[storeNm] = 0;
        if (!(storeNm in storeLastTm)) storeLastTm[storeNm] = 0;

        counts[storeNm]++;
        var prevTimestamp = storeLastTm[storeNm];

        if (totalCounts++ % config.RAW_PRINT_INTERVAL == 0 && log.debug())
            log.debug('Received raw data, inserting into store %s, time: %s ...', storeNm, new Date(timestamp).toString());
        if (timestamp <= prevTimestamp)
            throw new Error('Invalid time for a single measurement: ' + timestamp + ' <= ' + prevTimestamp);
        if (timestamp < lastRawTime)
            throw new Error('Invalid time! Current: ' + timestamp + ', prev: ' + lastRawTime);

        var insertVal = transformed.value;


        if (log.trace())
            log.trace('Inserting raw measurement %s', JSON.stringify(insertVal));

        // toc = latency.tic();

        pipeline.insertRaw(storeNm, insertVal);
        storeLastTm[storeNm] = timestamp;
        lastRawTime = timestamp;
    }
}

/**
 * Sends a prediction event to the user interface and to other components
 * listening on the broker.
 */
function sendPrediction(msg, timestamp, eventProps) {
    var perMonth = msg.content.pdf.lambda;
    var perHour = perMonth / (30*24);

    var brokerMsg = transform.genExpPrediction(perHour, 'hour', timestamp, eventProps);

    var modelMsgStr = (function () {
        var msgCpy = utils.clone(msg);
        msgCpy.time = timestamp instanceof Date ? timestamp.getTime() : timestamp;
        msgCpy.content.time = msg.content.time instanceof Date ? msg.content.time.getTime() : msg.content.time;
        return JSON.stringify(msgCpy);
    })();
    // var modelMsgStr = JSON.stringify(msg);
    var brokerMsgStr = JSON.stringify(brokerMsg);

    if (log.debug()) {
        log.debug('Sending exponential prediction to broker: %s', brokerMsgStr);
        log.debug('Sending exponential prediciton to all the models: %s', modelMsgStr)
    }

    // broker.send(broker.PREDICTION_PRODUCER_TOPIC, brokerMsgStr);
    modelStore.distributeMsg(modelMsgStr);
}

function initModelManagerHandlers() {
    modelManager.on('stateChanged', function (date, states) {
        let model = this;
        // toc();
        // latency.print();

        if (log.debug())
            log.debug('State changed: %s', JSON.stringify(states));

        modelStore.sendMsg(model.getId(), JSON.stringify({
            type: 'stateChanged',
            content: states
        }));

        if (config.SAVE_STATES) {
            utils.appendLine('states.txt', JSON.stringify({
                time: date.getTime(),
                states: states
            }));
        }
    })

    modelManager.on('anomaly', function (desc) {
        if (log.warn())
            log.warn('Anomaly detected: %s TODO: currently ignoring!', desc);

        // TODO not notifying anyone!
    })

    modelManager.on('outlier', function (ftrV) {
        let model = this;

        if (log.debug())
            log.debug('Outlier detected!');

        // send to broker
        // var brokerMsg = transform.genExpPrediction(100.1, 'minute', new Date().getTime());
        // broker.send(broker.PREDICTION_PRODUCER_TOPIC, JSON.stringify(brokerMsg));

        // send to UI
        let msg = {
            type: 'outlier',
            content: ftrV
        }
        modelManager.sendMessage(model, msg, function (e) {
            if (e != null) {
                log.error(e, 'Failed to send message to model: ' + model.getId());
                return;
            }
        })
        // modelStore.sendMsg(model.getId(), JSON.stringify(msg));
    })

    modelManager.on('prediction', function (date, currState, targetState, prob, probV, timeV) {
        let model = this;

        if (log.debug())
            log.debug('Sending prediction, with PDF length: %d', probV.length);

        try {
            // get the number of updates from the model store
            // if we are just initializing (number of updates <= 2) then
            // do not send any predictions
            if (modelStore.getNumberOfUpdates() <= 2) {
                log.info('Blocking prediction, still initializing!');
                return;
            }

            var _model = model.getModel();

            var currStateNm = _model.getStateName(currState);
            var targetStateNm = _model.getStateName(targetState);

            db.fetchStateProperty(model.getId(), targetState, 'eventId', function (e, eventId) {
                if (e != null) {
                    log.error(e, 'Failed to fetch event ID from the database!');
                    return;
                }

                if (currStateNm == null || currStateNm.length == 0) currStateNm = currState;
                if (targetStateNm == null || targetStateNm.length == 0) targetStateNm = targetState;

                var uiMsg = {
                    type: 'statePrediction',
                    content: {
                        time: date.getTime(),
                        currState: currStateNm,
                        targetState: targetStateNm,
                        eventId: eventId,
                        probability: prob,
                        pdf: {
                            type: 'histogram',
                            probV: probV,
                            timeV: timeV
                        }
                    }
                };

                var currStateIds = _model.currState();
                var stateId = currStateIds[0].id;
                var level = currStateIds[0].height;

                var details = model.stateDetails(stateId, level);
                var metadata = {};

                var obs = details.features.observations;
                var contr = details.features.controls;
                for (var i = 0; i < obs.length; i++) {
                    var ftr = obs[i];
                    metadata[ftr.name] = ftr.value;
                }
                for (i = 0; i < contr.length; i++) {
                    var contrFtr = contr[i];
                    metadata[contrFtr.name] = contrFtr.value;
                }

                async.parallel([
                    function sendUiMsg(xcb) {
                        try {
                            // var mid = model.getId();
                            // modelStore.sendMsg(model.getId(), JSON.stringify(uiMsg));
                            modelManager.sendMessage(model, uiMsg, xcb);
                        } catch (e) {
                            xcb(e);
                        }
                    }
                ], function (e) {
                    if (e != null) {
                        log.error('Failed to send target state prediction!');
                    }
                })
            });
        } catch (e) {
            log.error(e, 'Failed to send target state prediction!');
        }
    })

    modelManager.on('activity', function (startTm, endTm, activityName) {
        let model = this;

        if (log.debug())
            log.debug('Detected activity %s at time %s to %s!', activityName, startTm.toString(), endTm.toString());

        var start = startTm.getTime();
        var end = endTm.getTime();

        async.parallel([
            function sendUiMsg(xcb) {
                var uiMsg = {
                    type: 'activity',
                    content: {
                        start: start,
                        end: end,
                        name: activityName
                    }
                };

                // modelStore.sendMsg(model.getId(), JSON.stringify(uiMsg));
                modelManager.sendMessage(model, uiMsg, xcb);
            },
            function saveToFile(xcb) {
                if (config.SAVE_ACTIVITIES) {
                    utils.appendLine('activities-' + model.getId() + '.csv',  startTm.getTime() + ',' + endTm.getTime() + ',"' + activityName.replace(/\"/g, '\\"') + '"');
                }
                xcb();
            }
        ], function (e) {
            if (e != null) {
                log.error(e, 'Failed to send activity message!');
                return;
            }
        })
    })
}

function initPipelineHandlers() {
    log.info('Initializing pipeline callbacks ...');

    pipeline.onValue(function (val) {
        if (log.trace())
            log.trace('Inserting value into StreamStories ...');
        modelStore.updateModels(val);

        if (config.SAVE_STATES) {
            var models = modelStore.getActiveModels();
            for (var modelN = 0; modelN < models.length; modelN++) {
                var model = models[modelN];
                var ftrPred = model.getModel().predictNextState({
                    useFtrV: true,
                    futureStateN: -1
                });
                var mcPred = model.getModel().predictNextState({
                    useFtrV: false,
                    futureStateN: -1
                });

                var baseFName = 'predictions-' + model.getId();

                utils.appendLine(baseFName + '-pred.json', JSON.stringify(ftrPred));
                utils.appendLine(baseFName + '-nopred.json', JSON.stringify(mcPred));
            }
        }
    });

    // configure coefficient callback
    (function () {
        log.info('Fetching intensities from DB ...');
        var lambdaProps = [
            'deviation_extreme_lambda',
            'deviation_major_lambda',
            'deviation_significant_lambda',
            'deviation_minor_lambda'
        ];

        db.getMultipleConfig({properties: lambdaProps}, function (e, result) {
            if (e != null) {
                log.error(e, 'Failed to fetch intensities from DB!');
                return;
            }

            for (var i = 0; i < result.length; i++) {
                var entry = result[i];
                var property = entry.property;
                var val = parseFloat(entry.value);

                intensConfig[property] = val;
            }

            // friction coefficient
            log.debug('Creating coefficient callback ...');
            pipeline.onCoefficient(function (opts) {
                var pdf = null;

                log.info('coefficient callback called with options:\n' + JSON.stringify(opts));

                // check if the coefficient is out of the ordinary
                var zscore = opts.zScore;
                if (zscore >= 2) {
                    if (zscore >= 5) {
                        pdf = {
                            type: 'exponential',
                            lambda: intensConfig.deviation_extreme_lambda       // degradation occurs once per month
                        };
                    } else if (zscore >= 4) {                                   // major deviation
                        pdf = {
                            type: 'exponential',
                            lambda: intensConfig.deviation_major_lambda         // degradation occurs once per two months
                        };
                    } else if (zscore >= 3) {                                   // significant deviation
                        pdf = {
                            type: 'exponential',
                            lambda: intensConfig.deviation_significant_lambda   // degradation occurs once per year
                        };
                    } else {                                                    // (zscore >= 2) minor deviation
                        pdf = {
                            type: 'exponential',
                            lambda: intensConfig.deviation_minor_lambda         // degradation occurs once per two years
                        };
                    }

                    // send a coefficient event to the UI
                    (function () {
                        var timestamp = opts.time.getTime();
                        var optsCpy = utils.clone(opts);
                        optsCpy.time = timestamp;
                        modelStore.distributeMsg(JSON.stringify({
                            type: 'coeff',
                            content: optsCpy
                        }));
                    })();

                    // send the prediction event
                    if (pdf != null) {
                        if (log.debug())
                            log.debug('Sending prediction message based on the friction coefficient ...')

                        // the prediction message
                        var msg = {
                            type: 'prediction',
                            content: {
                                time: opts.time,
                                eventId: opts.eventId,
                                pdf: pdf
                            }
                        };

                        var proasenseEventProps = {
                            coeff: opts.value,
                            std: opts.std,
                            zScore: opts.zScore
                        }

                        sendPrediction(msg, opts.time.getTime(), proasenseEventProps);
                    }
                }
            });
        });
    })();
}

function initLoginRestApi(router) {
    log.info('Initializing Login REST services ...');

    router.register('login', 'post', function (req, res) {
        var session = req.session;

        var username = req.body.email;
        var password = req.body.password;

        if (log.debug())
            log.debug('Loggin in user: %s', username);

        if (username == null || username == '') {
            session.warning = 'Email missing!';
            redirect(res, '../login.html');
            return;
        }

        if (password == null || password == '') {
            session.warning = 'Password missing!';
            redirect(res, '../login.html');
            return;
        }

        db.fetchUserByEmail(username, function (e, user) {
            if (e != null) {
                log.error(e, 'Exception while checking if user exists!');
                utils.handleServerError(e, req, res);
                return;
            }

            if (user == null) {
                session.warning = 'Invalid email or password!';
                redirect(res, '../login.html');
                return;
            }

            var hash = utils.hashPassword(password);

            if (hash != user.passwd) {
                session.warning = 'Invalid email or password!';
                redirect(res, '../login.html');
                return;
            } else {
                HttpUtils.loginUser(session, {
                    username: user.email,
                    theme: user.theme
                });
                redirect(res, '../dashboard.html');
            }
        });
    });

    router.register('register', 'post', function (req, res) {
        var session = req.session;

        var username = req.body.email;
        var password = req.body.password;
        var password1 = req.body.password1;

        if (log.debug())
            log.debug('Registering user: %s', username);

        if (username == null || username == '') {
            session.warning = 'Email missing!';
            redirect(res, '../register.html');
            return;
        }

        if (password == null || password == '') {
            session.warning = 'Password missing!';
            redirect(res, '../register.html');
            return;
        }

        if (password.length < 4) {
            session.warning = 'The password must be at least 6 characters long!';
            redirect(res, '../register.html');
            return;
        }

        if (password1 == null || password1 == '') {
            session.warning = 'Please repeat password!';
            redirect(res, '../register.html');
            return;
        }

        if (password != password1) {
            session.warning = 'Passwords don\'t match!';
            redirect(res, '../register.html');
            return;
        }

        db.userExists(username, function (e, exists) {
            if (e != null) {
                log.error(e, 'Exception while checking if user exists!');
                utils.handleServerError(e, req, res);
                return;
            }

            if (exists) {
                session.warning = 'Email "' + username + '" already taken!';
                redirect(res, '../register.html');
                return;
            } else {
                var hash = utils.hashPassword(password);
                db.createUser(username, hash, function (e1) {
                    if (e1 != null) {
                        log.error(e1, 'Exception while creating a new user!');
                        utils.handleServerError(e1, req, res);
                        return;
                    }

                    HttpUtils.loginUser(session, { username: username, theme: 'dark' });
                    redirect(res, '../dashboard.html');
                });
            }
        });
    });

    router.register('resetPassword', 'post', function (req, res) {
        var session = req.session;
        var email = req.body.email;

        var password = utils.genPassword();
        var hash = utils.hashPassword(password);

        db.userExists(email, function (e, exists) {
            if (e != null) {
                utils.handleServerError(e, req, res);
                return;
            }

            if (!exists) {
                session.error = 'Invalid email address!';
                redirect(res, '../resetpassword.html');
            } else {
                db.updatePassword(email, hash, function (e1) {
                    if (e1 != null) {
                        log.error(e, 'Failed to update password!');
                        utils.handleServerError(e1, req, res);
                        return;
                    }

                    var opts = {
                        password: password,
                        email: email
                    }

                    utils.sendEmail(opts, function (e2) {
                        if (e2 != null) {
                            log.error(e2, 'Failed to send email!');
                            utils.handleServerError(e2, req, res);
                            return;
                        }

                        session.message = 'Your new password has been sent to ' + email + '!';
                        redirect(res, '../resetpassword.html');
                    })
                });
            }
        })
    });
}

function initServerApi(router) {
    log.info('Initializing general server REST API ...');

    router.register('changePassword', 'post', function (req, res) {
        var session = req.session;

        var email = session.username;

        var old = req.body.old;
        var password = req.body.newP;
        var password1 = req.body.repeat;

        if (password == null || password == '') {
            utils.handleBadInput(res, 'Password missing!');
            return;
        }

        if (password.length < 4) {
            utils.handleBadInput(res, 'The password must be at least 6 characters long!');
            return;
        }

        if (password1 == null || password1 == '') {
            utils.handleBadInput(res, 'Please repeat password!');
            return;
        }

        if (password != password1) {
            utils.handleBadInput(res, 'Passwords don\'t match!');
            return;
        }

        var hashOld = utils.hashPassword(old);

        db.fetchUserPassword(email, function (e, storedHash) {
            if (e != null) {
                log.error(e, 'Exception while fetching user password!');
                utils.handleServerError(e, req, res);
                return;
            }

            if (hashOld != storedHash) {
                utils.handleBadInput(res, 'Passwords don\'t match!');
                return;
            }

            var hash = utils.hashPassword(password);

            db.updatePassword(email, hash, function (e1) {
                if (e1 != null) {
                    log.error(e, 'Failed to update password!');
                    utils.handleServerError(e1, req, res);
                    return;
                }

                res.status(204);    // no content
                res.end();
            });
        });
    });

    router.register('logout', 'post', function (req, res) {
        HttpUtils.clearSession(req.sessionID, req.session, base);
        redirect(res, '../login.html');
    });

    router.register('exit', 'get', function (req, res) {
        log.info(API_PATH + '/exit called. Exiting qminer and closing server ...');
        utils.exit(base);
        res.status(204);
        res.end();
    });

    router.register('theme', 'get', function (req, res) {
        var session = req.session;
        res.send({ theme: session.theme });
        res.end();
    })

    router.register('theme', 'post', function (req, res) {
        var session = req.session;
        var username = session.username;

        var theme = req.body.theme;

        db.updateTheme(username, theme, function (e) {
            if (e != null) {
                log.error(e, 'Exception while setting theme!');
                utils.handleServerError(e, req, res);
                return;
            }

            session.theme = theme;
            res.status(204);
            res.end();
        });
    });

    (function () {
        log.debug('Registering push data service ...');

        var batchN = 0;

        router.register('push', 'post', function (req, res) {
            var batch = req.body;

            if (batchN == 1) {
                throughput.init();
            }

            for (var i = 0; i < batch.length; i++) {
                addRawMeasurement(batch[i]);
            }

            if (batchN >= 1) {
                throughput.update(batch.length);
                if (batchN % 100 == 0) {
                    throughput.print();
                }
            }

            batchN++;

            res.status(204);
            res.end();
        });
    })();

    router.register('countActiveModels', 'get', function (req, res) {
        log.debug('Fetching the number of active models from the DB ...');

        db.countActiveModels(function (e, result) {
            if (e != null) {
                log.error(e, 'Failed to count the number of active models!');
                utils.handleServerError(e, req, res);
                return;
            }

            res.send(result);
            res.end();
        });
    });

    (function () {
        log.debug('Registering activate model service ...');

        function activateModelById(req, res, modelId, activate, isFromUi) {
            if (log.debug())
                log.debug('Activating model %s: ' + activate, modelId);

            var session = req.session;

            db.activateModel({modelId: modelId, activate: activate}, function (e1) {
                if (e1 != null) {
                    log.error(e1, 'Failed to activate model %s!', modelId);
                    utils.handleServerError(e1, req, res);
                    return;
                }

                try {
                    if (activate) {
                        db.fetchModel(modelId, function (e2, modelConfig) {
                            if (e2 != null) {
                                log.error(e2, 'Failed to fetch a model from the DB!');
                                utils.handleServerError(e2, req, res);
                                return;
                            }

                            modelStore.loadOnlineModel(modelConfig.model_file, function (e, model) {
                                if (e != null) {
                                    log.error(e, 'Exception while loading online model!');
                                    return;
                                }

                                if (log.debug())
                                    log.debug('Activating model with id %s', model.getId());

                                if (isFromUi) {
                                    //                                  var currModel = HttpUtils.extractModel(sessionId, session);
                                    //                                  modelManager.deactivate(currModel);
                                    session.model = model;
                                }

                                modelManager.activate(model);

                                res.status(204);
                                res.end();
                            });
                        });
                    } else {
                        // deactivate, the model is currently active
                        var model = modelStore.getModel(modelId);
                        modelManager.deactivate(model);

                        res.status(204);
                        res.end();
                    }
                } catch (e2) {
                    log.error(e2, 'Model activated in the DB, but failed to activate it in the app!');
                    utils.handleServerError(e2, req, res);
                }
            });
        }

        router.register('removeModel', 'post', function (req, res) {
            var modelId = req.body.modelId;

            log.debug('Removing model %d', modelId);

            db.deleteModel(modelId, function (e) {
                if (e != null) {
                    return utils.handleServerError(e, req, res);
                }

                res.status(204);
                res.end();
            });
        });

        router.register('activateModel', 'post', function (req, res) {
            var modelId = req.body.modelId;
            var activate = req.body.activate;

            if (activate == null) throw new Error('Missing parameter activate!');
            if (modelId == null) throw new Error('WTF?! Tried to activate a model that doesn\'t have an ID!');

            activateModelById(req, res, modelId, activate, false);
        });

        router.register('activateModelViz', 'post', function (req, res) {
            var session = req.session;
            var activate = req.body.activate == 'true';

            if (activate == null) throw new Error('Missing parameter activate!');

            var model = HttpUtils.extractModel(req.sessionID, session);

            activateModelById(req, res, model.getId(), activate, true);
        });
    })();

    router.register('modelMode', 'get', function (req, res) {
        log.debug('Fetching model mode from the db DB ...');

        var model = HttpUtils.extractModel(req.sessionID, req.session);

        db.fetchModel(model.getId(), function (e, modelConfig) {
            if (e != null) {
                log.error(e, 'Failed to get model mode from the DB!');
                utils.handleServerError(e, req, res);
                return;
            }

            res.send({
                isRealtime: modelConfig.is_realtime == 1,
                isActive: modelConfig.is_active == 1
            });
            res.end();
        });
    });

    router.register('shareModel', 'post', function (req, res) {
        var mid = req.body.modelId;
        var share = req.body.share;

        if (log.debug())
            log.debug('Sharing model %s: ', mid);

        db.makeModelPublic(mid, share, function (e) {
            if (e != null) {
                log.error(e, 'Failed to activate model %s!', mid);
                utils.handleServerError(e, req, res);
                return;
            }

            res.status(204);
            res.end();
        });
    });
}

function initStreamStoryRestApi(router) {
    log.info('Initializing StreamStory REST services ...');

    router.register('save', 'post', function (req, res) {
        var session = req.session;
        var sessionId = req.sessionID;

        var model = HttpUtils.extractModel(sessionId, session);
        var positions = req.body.positions != null ? JSON.parse(req.body.positions) : null;

        if (model == null) {
            res.status(401);    // unauthorized
            res.end();
            return;
        }

        if (positions != null) {
            if (log.debug())
                log.debug('Saving node positions ...');
            model.getModel().setStateCoords(positions);
        }

        var modelFile = HttpUtils.extractModelFile(session);

        if (modelFile == null)
            throw new Error('Model file missing when saving!');

        model.save(modelFile);
        res.status(204);
        res.end();
    });


    router.register('param', 'post', function (req, res) {
        var paramName = req.body.paramName;
        var paramVal = parseFloat(req.body.paramVal);

        if (log.debug())
            log.debug('Setting parameter %s to value %d ...', paramName, paramVal);

        var model = HttpUtils.extractModel(req.sessionID, req.session);

        var paramObj = {};
        paramObj[paramName] = paramVal;

        model.getModel().setParams(paramObj);
        res.status(204);    // no content
        res.end();
    });

    router.register('param', 'get', function (req, res) {
        var param = req.query.paramName;
        var model = HttpUtils.extractModel(req.sessionID, req.session);

        var val = model.getModel().getParam(param);
        res.send({ parameter: param, value: val });
        res.end();
    });

    router.register('timeUnit', 'get', function (req, res) {
        var model = HttpUtils.extractModel(req.sessionID, req.session);
        res.send({ value: model.getModel().getTimeUnit() });
        res.end();
    });

    router.register('modelId', 'get', function (req, res) {
        var model = HttpUtils.extractModel(req.sessionID, req.session);

        if (model == null || model.getId() == null) throw new Error('No model present!');

        res.send({ modelId: model.getId() });
        res.end();
    });

    // get the StreamStory model
    router.register('model', 'get', function (req, res) {
        var model = HttpUtils.extractModel(req.sessionID, req.session);

        log.debug('Querying MHWirth multilevel model ...');
        res.send(model.getVizState());
        res.end();
    });

    // submodel
    router.register('subModel', 'get', function (req, res) {
        var model = HttpUtils.extractModel(req.sessionID, req.session);
        var stateId = parseInt(req.query.stateId);

        if (log.debug())
            log.debug('Fetching sub model for state: %d ...', stateId);

        res.send(model.getSubModelJson(stateId));
        res.end();
    });

    // path from state
    router.register('path', 'get', function (req, res) {
        var model = HttpUtils.extractModel(req.sessionID, req.session);
        var stateId = parseInt(req.query.stateId);
        var height = parseFloat(req.query.height);
        var length = parseInt(req.query.length);
        var probThreshold = parseFloat(req.query.probThreshold);

        if (log.debug())
            log.debug('Fetching state path for state: %d on height %d ...', stateId, height);

        res.send(model.getStatePath(stateId, height, length, probThreshold));
        res.end();
    });

    // multilevel analysis
    router.register('features', 'get', function (req, res) {
        var model = HttpUtils.extractModel(req.sessionID, req.session);
        log.debug('Fetching all the features ...');
        res.send(model.getFtrDesc());
        res.end();
    });

    // multilevel analysis
    router.register('transitionModel', 'get', function (req, res) {
        var level = parseFloat(req.query.level);
        var model = HttpUtils.extractModel(req.sessionID, req.session);

        if (log.debug())
            log.debug('Fetching transition model for level: %.3f', level);

        res.send(model.getModel().getTransitionModel(level));
        res.end();
    });

    // multilevel analysis
    router.register('currentState', 'get', function (req, res) {
        var level = parseFloat(req.query.level);
        var model = HttpUtils.extractModel(req.sessionID, req.session);

        if (log.debug())
            log.debug('Fetching current state for level ' + level);

        var result = model.currState(level);

        if (log.debug())
            log.debug("Current state: %s", JSON.stringify(result));

        res.send(result);
        res.end();
    });

    router.register('futureStates', 'get', function (req, res) {
        var level = parseFloat(req.query.level);
        var currState = parseInt(req.query.state);

        var model = HttpUtils.extractModel(req.sessionID, req.session);

        if (req.query.time == null) {
            log.debug('Fetching future states currState: %d, height: %d', currState, level);
            res.send(model.futureStates(level, currState));
            res.end();
        } else {
            var time = parseFloat(req.query.time);
            log.debug('Fetching future states, currState: %d, level: %d, time: %d', currState, level, time);
            res.send(model.futureStates(level, currState, time));
            res.end();
        }
    });

    router.register('pastStates', 'get', function (req, res) {
        var level = parseFloat(req.query.level);
        var currState = parseInt(req.query.state);

        var model = HttpUtils.extractModel(req.sessionID, req.session);

        if (req.query.time == null) {
            log.debug('Fetching past states currState: %d, height: %d', currState, level);
            res.send(model.pastStates(level, currState));
            res.end();
        } else {
            var time = parseFloat(req.query.time);
            log.debug('Fetching past states, currState: %d, level: %d, time: %d', currState, level, time);
            res.send(model.pastStates(level, currState, time));
            res.end();
        }
    });

    router.register('timeDist', 'get', function (req, res) {
        var stateId = parseInt(req.query.stateId);
        var time = parseFloat(req.query.time);
        var height = parseFloat(req.query.level);

        var model = HttpUtils.extractModel(req.sessionID, req.session);

        if (log.debug())
            log.debug('Fetching probability distribution of states at height %d from state %d at time %d ...', height, stateId, time);

        res.send(model.getModel().probsAtTime(stateId, height, time));
        res.end();
    });

    router.register('history', 'get', function (req, res) {
        var level = parseFloat(req.query.level);
        var model = HttpUtils.extractModel(req.sessionID, req.session);

        if (log.debug())
            log.debug('Fetching history for level %d', level);

        res.send(model.getModel().histStates(level));
        res.end();
    });

    (function () {
        log.info('Registering state details service ...');

        // state details
        router.register('stateDetails', 'get', function (req, res) {
            var stateId = parseInt(req.query.stateId);
            var height = parseFloat(req.query.level);

            var model = HttpUtils.extractModel(req.sessionID, req.session);

            if (log.debug())
                log.debug('Fetching details for state: %d', stateId);

            var details = model.stateDetails(stateId, height);

            db.fetchStateProperties(model.getId(), stateId, ['eventId', 'description'], function (e, stateProps) {
                if (e != null) {
                    utils.handleServerError(e, req, res);
                    return;
                }

                details.undesiredEventId = stateProps.eventId;
                details.description = stateProps.description;

                res.send(details);
                res.end();
            });
        });

        router.register('stateHistory', 'get', function (req, res) {
            log.debug('Querying state history ...');

            var offset = req.query.offset != null ? parseFloat(req.query.offset) : undefined;
            var range = req.query.range != null ? parseFloat(req.query.range) : undefined;
            var maxStates = req.query.n != null ? parseInt(req.query.n) : undefined;

            if (offset == null) {
                utils.handleBadInput(res, "Missing parameter offset!");
                return;
            }
            if (range == null) {
                utils.handleBadInput(res, "Missing parameter range!");
                return;
            }
            if (maxStates == null) {
                utils.handleBadInput(res, 'Missing parameter maxStates!');
                return;
            }

            if (log.debug())
                log.debug('Using parameters offset: %d, relWindowLen: %d', offset, range);

            var model = HttpUtils.extractModel(req.sessionID, req.session);

            var result = model.getHistoricalStates(offset, range, maxStates);

            if (log.debug())
                log.debug('Writing to output stream ...');

            // I have to write the objects to the stream manually, otherwise I can get
            // an out of memory error
            var key;
            res.write('{');
            for (key in result) {
                if (key != 'window' && result.hasOwnProperty(key)) {
                    res.write('"' + key + '":');
                    res.write(typeof result[key] == 'string' ? ('"' + result[key] + '"') : (result[key] + ''));
                    res.write(',');
                }
            }
            res.write('"window": [')
            for (var i = 0; i < result.window.length; i++) {
                res.write('{');
                var scaleObj = result.window[i];
                for (key in scaleObj) {
                    if (key != 'states' && scaleObj.hasOwnProperty(key)) {
                        res.write('"' + key + '":');
                        res.write(typeof scaleObj[key] == 'string' ? ('"' + scaleObj[key] + '"') : (scaleObj[key] + ''));
                        res.write(',');
                    }
                }
                res.write('"states":[');
                var states = scaleObj.states;
                for (var stateN = 0; stateN < states.length; stateN++) {
                    res.write(JSON.stringify(states[stateN]));
                    if (stateN < states.length-1) {
                        res.write(',');
                    }
                }
                res.write(']');
                res.write('}');
                if (i < result.window.length-1) {
                    res.write(',');
                }
            }
            res.write(']}');
            res.end();
        });

        router.register('modelDetails', 'get', function (req, res) {
            var session = req.session;
            var username = session.username;
            var modelId = parseInt(req.query.modelId);

            if (log.debug())
                log.debug('Fetching model details for model: %d', modelId);

            db.fetchModel(modelId, function (e, modelConfig) {
                if (e != null) {
                    log.error(e, 'Failed to fetch model details!');
                    utils.handleServerError(e, req, res);
                    return;
                }

                res.send({
                    mid: modelConfig.mid,
                    name: modelConfig.name,
                    description: modelConfig.description,
                    dataset: modelConfig.dataset,
                    isOnline: modelConfig.is_realtime == 1,
                    creator: modelConfig.username,
                    creationDate: modelConfig.date_created,
                    isPublic: modelConfig.is_public == 1,
                    isActive: modelConfig.is_active == 1,
                    isOwner: modelConfig.username == username
                });
                res.end();
            });
        });

        router.register('modelDescription', 'post', function (req, res) {
            var mid = req.body.modelId;
            var desc = req.body.description;

            if (log.debug())
                log.debug('Setting description for model %s', mid);

            if (desc == '') desc = null;

            db.setModelDescription(mid, desc, function (e) {
                if (e != null) {
                    log.error(e, 'Failed to update model description!');
                    utils.handleServerError(e, req, res);
                    return;
                }

                res.status(204);    // no content
                res.end();
            });
        });

        router.register('modelDescription', 'post', function (req, res) {
            var session = req.session;

            var model = HttpUtils.extractModel(req.sessionID, req.session);
            var name = req.body.name;
            var sequence = JSON.parse(req.body.sequence);

            if (log.debug())
                log.debug('Setting activity %s for model %d with transitions %s', name, model.getId(), JSON.stringify(sequence));

            // perform checks
            if (name == null || name == '') {
                utils.handleBadInput(res, 'Activity name missing!');
                return;
            }
            if (sequence == null || sequence.length == 0) {
                utils.handleBadInput(res, 'Missing the sequence of states!');
                return;
            }
            for (var i = 0; i < sequence.length; i++) {
                var stateIds = sequence[i];
                if (stateIds == null || stateIds.length == 0) {
                    utils.handleBadInput(res, 'Empty states in sequence!');
                    return;
                }
            }

            // set the activity
            model.getModel().setActivity(name, sequence);
            // save the model
            var fname = HttpUtils.extractModelFile(session);
            if (log.debug())
                log.debug('Saving model to file: %s', fname);
            model.save(fname);

            res.status(204);    // no content
            res.end();
        });

        router.register('removeActivity', 'post', function (req, res) {
            var session = req.session;
            var model = HttpUtils.extractModel(req.sessionID, session);
            var name = req.body.name;

            if (log.debug())
                log.debug('Removing activity %s for model %d ...', name, model.getId());

            if (name == null || name == '') {
                utils.handleBadInput(res, 'Activity name missing!');
                return;
            }

            model.getModel().removeActivity(name);
            var fname = HttpUtils.extractModelFile(session);
            if (log.debug())
                log.debug('Saving model to file: %s', fname);
            model.save(fname);

            res.status(204);    // no content
            res.end();
        });

        router.register('targetProperties', 'get', function (req, res) {
            var stateId = parseInt(req.query.stateId);

            var model = HttpUtils.extractModel(req.sessionID, req.session);

            if (log.debug())
                log.debug('Fetching target details for state: %d', stateId);

            var isUndesired = model.getModel().isTarget(stateId);

            if (isUndesired) {
                db.fetchStateProperty(model.getId(), stateId, 'eventId', function (e, eventId) {
                    if (e != null) {
                        utils.handleServerError(e, req, res);
                        return;
                    }

                    res.send({ isUndesired: isUndesired, eventId: eventId });
                    res.end();
                });
            } else {
                res.send({ isUndesired: isUndesired });
                res.end();
            }
        });

        // state explanation
        router.register('explanation', 'get', function (req, res) {
            var stateId = parseInt(req.query.stateId);

            var model = HttpUtils.extractModel(req.sessionID, req.session);

            if (log.debug())
                log.debug('Fetching explanation for state: %d', stateId);

            res.send(model.explainState(stateId));
            res.end();
        });

        router.register('stateNarration', 'get', function (req, res) {
            var model = HttpUtils.extractModel(req.sessionID, req.session);
            var stateId = parseInt(req.query.stateId);

            if (log.trace())
                log.trace('Fetching time explanation for state %d ...', stateId);

            res.send(model.narrateState(stateId));
            res.end();
        });

        // histograms
        router.register('histogram', 'get', function (req, res) {
            var stateId = parseInt(req.query.stateId);
            var ftrIdx = parseInt(req.query.feature);

            var model = HttpUtils.extractModel(req.sessionID, req.session);

            if (log.trace())
                log.trace('Fetching histogram for state %d, feature %d ...', stateId, ftrIdx);

            res.send(model.histogram(ftrIdx, stateId));
            res.end();
        });

        router.register('transitionHistogram', 'get', function (req, res) {
            var sourceId = parseInt(req.query.sourceId);
            var targetId = parseInt(req.query.targetId);
            var ftrId = parseInt(req.query.feature);

            var model = HttpUtils.extractModel(req.sessionID, req.session);

            if (log.trace())
                log.trace('Fetching transition histogram for transition %d -> %d, feature %d ...', sourceId, targetId, ftrId);

            res.send(model.transitionHistogram(sourceId, targetId, ftrId));
            res.end();
        });

        router.register('timeHistogram', 'get', function (req, res) {
            var model = HttpUtils.extractModel(req.sessionID, req.session);
            var stateId = parseInt(req.query.stateId);

            if (log.trace())
                log.trace('Fetching time histogram for state %d ...', stateId);

            res.send(model.getModel().timeHistogram(stateId));
            res.end();
        });

        router.register('timeExplain', 'get', function (req, res) {
            var model = HttpUtils.extractModel(req.sessionID, req.session);
            var stateId = parseInt(req.query.stateId);

            if (log.trace())
                log.trace('Fetching time explanation for state %d ...', stateId);

            res.send(model.getModel().getStateTypTimes(stateId));
            res.end();
        });

        router.register('targetFeature', 'get', function (req, res) {
            var height = parseFloat(req.query.height);
            var ftrIdx = parseInt(req.query.ftr);

            var model = HttpUtils.extractModel(req.sessionID, req.session);

            if (log.debug())
                log.debug('Fetching distribution for feature "%d" for height %d ...', ftrIdx, height);

            res.send(model.getFtrDist(height, ftrIdx));
            res.end();
        });

        router.register('stateProperties', 'post', function (req, res) {
            var stateId, stateNm;

            var session = req.session;

            var model = HttpUtils.extractModel(req.sessionID, session);
            var mid = session.modelId;

            stateId = parseInt(req.body.id);
            stateNm = req.body.name;
            var description = req.body.description;

            if (stateNm != null) {
                if (log.debug())
                    log.debug('Setting name of state %d to %s ...', stateId, stateNm);

                model.getModel().setStateName(stateId, stateNm);
            }
            else {
                if (log.debug())
                    log.debug('Clearing name of state %d ...', stateId);

                model.getModel().clearStateName(stateId);
            }

            var fname;
            var props;
            if (!model.isOnline()) {
                fname = HttpUtils.extractModelFile(session);
                if (log.debug())
                    log.debug('Saving model to file: %s', fname);
                model.save(fname);

                props = {
                    description: description
                };

                db.setStateProperties(mid, stateId, props, function (e) {
                    if (e != null) {
                        utils.handleServerError(e, req, res);
                        return;
                    }

                    res.status(204);    // no content
                    res.end();
                });
            }
            else {
                var isUndesired = JSON.parse(req.body.isUndesired);
                var eventId = req.body.eventId;

                if (isUndesired && (eventId == null || eventId == '')) {
                    log.warn('The state is marked undesired, but the eventId is missing!');
                    utils.handleBadInput(res, 'Undesired event without an event id!');
                    return;
                }

                if (log.debug())
                    log.debug('Setting undesired state: %d, isUndesired: ' + isUndesired, stateId);

                if (model.getModel().isTarget(stateId) != isUndesired)
                    model.getModel().setTarget(stateId, isUndesired);
                fname = HttpUtils.extractModelFile(session);

                if (log.debug())
                    log.debug('Saving model to file: %s', fname);

                fname = HttpUtils.extractModelFile(session);
                model.save(fname);

                props = {
                    eventId: isUndesired ? eventId : undefined,
                    description: description
                }
                db.setStateProperties(mid, stateId, props, function (e) {
                    if (e != null) {
                        utils.handleServerError(e, req, res);
                        return;
                    }

                    res.status(204);    // no content
                    res.end();
                });
            }
        });

        router.register('setControl', 'post', function (req, res) {
            let ftrId = parseInt(req.body.ftrIdx);
            let val = parseFloat(req.body.val);
            let stateId = req.body.stateId != null ? parseInt(req.body.stateId) : null;

            let model = HttpUtils.extractModel(req.sessionID, req.session);

            if (log.debug())
                log.debug('Changing control %d to value %d ...', ftrId, val);

            model.setControlVal({ ftrId: ftrId, val: val, stateId: stateId});
            res.send(model.getVizState());
            res.end();
        });

        router.register('resetControl', 'post', function (req, res) {
            var ftrId = req.body.ftrIdx != null ? parseInt(req.body.ftrIdx) : null;
            var stateId = req.body.stateId != null ? parseInt(req.body.stateId) : null;

            var model = HttpUtils.extractModel(req.sessionID, req.session);

            if (model == null) throw new Error('Model is null, has the session expired?');

            if (log.debug())
                log.debug('Reseting control ...');

            model.resetControlVal({ ftrId: ftrId, stateId: stateId});
            res.send(model.getVizState());
            res.end();
        });

        router.register('controlsSet', 'get', function (req, res) {
            var model = HttpUtils.extractModel(req.sessionID, req.session);

            if (log.debug())
                log.debug('Fetching the state of any control features ...');

            res.send({ active: model.getModel().isAnyControlFtrSet() });
            res.end();
        });
    })();
}

function initDataUploadApi(router) {
    log.info('Initializing data upload API ...');

    var upload = multer({
        storage: multer.memoryStorage(),                // will have file.buffer
        fileFilter: function (req, file, callback) {    // only accept csv files
            var passes = qmutil.stringEndsWith(file.originalname, '.csv');
            log.debug('Filtering uploaded file %s. File passess filter: ' + passes, JSON.stringify(file));
            callback(undefined, passes);
        }
    });

    /* jshint unused: vars */
    app.post('/upload', upload.single('dataset'), function (req, res, next) {
        var sessionId = req.sessionID;
        var session = req.session;

        if (req.file == null) {
            utils.handleServerError(new Error('File not uploaded in the upload request!'), req, res);
            return;
        }

        var fileBuff = req.file.buffer;

        session.datasetName = req.file.originalname;
        fileBuffH[sessionId] = fileBuff;

        var headers = [];
        var attrTypes = [];
        qm.fs.readCsvAsync(fileBuff, { offset: 0, limit: 11 },
            function onBatch(lines) {
                if (lines.length == 0) throw new Error('No lines in the uploaded CSV!');
                var lineArr = lines[0];
                // read the header and create the store
                for (var i = 0; i < lineArr.length; i++) {
                    var name = lineArr[i];

                    // remove double quotes
                    if (name.startsWith('"') && name.endsWith('"'))
                        name = name.substring(1, name.length-1);

                    headers.push({ name: name });
                    attrTypes.push('numeric');
                }

                // try guessing the field types
                for (i = 1; i < lines.length; i++) {
                    var lineV = lines[i];
                    for (var j = 0; j < lineV.length; j++) {
                        var val = lineV[j];

                        if (val == '' || isNaN(val)) {
                            attrTypes[j] = 'categorical';
                        }
                    }
                }

                log.debug('Fields read!');
            },
            function onEnd(e) {
                if (e != null) {
                    log.error(e, 'Exception while reading CSV headers!');
                    utils.handleServerError(e, req, res);
                    return;
                }

                log.debug('Headers read, sending them back to the UI ...');
                if (log.trace())
                    log.trace('Read headers: %s', JSON.stringify(headers));

                session.headerFields = headers;
                res.send({ headers: headers, types: attrTypes });
                res.end();
            });
    });

    function createModel(req, res) {
        try {
            req.connection.setTimeout(LONG_REQUEST_TIMEOUT);    // set long timeout since the processing can take quite long

            var session = req.session;
            var sessionId = req.sessionID;

            var username = session.username;

            var modelConfig = req.body;

            var timeAttr = modelConfig.time;
            var modelName = modelConfig.name;
            var description = modelConfig.description;
            var timeUnit = modelConfig.timeUnit;
            var attrs = modelConfig.attrs;
            var controlAttrs = modelConfig.controlAttrs;
            var ignoredAttrs = modelConfig.ignoredAttrs;
            var isRealTime = modelConfig.isRealTime;
            var hierarchy = modelConfig.hierarchyType;
            var clustConfig = modelConfig.clust;
            var derivAttrs = modelConfig.derivAttrs;

            var fileBuff = fileBuffH[sessionId];
            var datasetName = session.datasetName;
            var headers = session.headerFields;

            if (fileBuff == null)
                throw new Error('File is not defined while building a new model!');

            delete fileBuffH[sessionId];
            delete session.datasetName;
            delete session.headerFields;

            if (description != null && description.length > 300)
                description = description.substring(0, 300);

            log.debug('Creating a new base for the current user ...');
            var baseDir = utils.getBaseDir(username, new Date().getTime());
            var dbDir = utils.getDbDir(baseDir);

            mkdirp(dbDir, function (e) {
                if (e != null) {
                    log.error(e, 'Failed to create base directory!');
                    utils.handleServerError(e, req, res);
                    return;
                }

                try {
                    // create the store and base, depending on wether the model will be
                    // applied in real-time
                    var storeNm;
                    var userBase;
                    var store;

                    if (isRealTime) {
                        log.debug('Using real-time base and store ...');
                        storeNm = fields.STREAM_STORY_STORE;
                        userBase = base;
                        store = base.store(storeNm);
                    } else {    // not real-time => create a new base and store
                        if (log.debug())
                            log.debug('Creating new base and store ...');

                        var storeFields = [];
                        for (var i = 0; i < attrs.length; i++) {
                            var attr = attrs[i];

                            var fieldConf = {
                                name: attr.name,
                                'null': false
                            };

                            if (attr.type == 'time') {
                                fieldConf.type = 'datetime';
                            } else if (attr.type == 'numeric') {
                                fieldConf.type = 'float';
                            } else if (attr.type == 'nominal') {
                                fieldConf.type = 'string';
                                fieldConf.codebook = true;
                            } else {
                                throw new Error('Invalid attribute type: ' + attr.type);
                            }

                            storeFields.push(fieldConf);
                        }

                        storeNm = config.QM_USER_DEFAULT_STORE_NAME;
                        userBase = new qm.Base({
                            mode: 'create',
                            dbPath: dbDir,
                            strictNames: false
                        });

                        log.debug('Creating default store ...');
                        store = userBase.createStore({
                            name: storeNm,
                            fields: storeFields
                        });
                    }

                    var opts = {
                        username: username,
                        datasetName: datasetName,
                        modelName: modelName,
                        description: description,
                        base: userBase,
                        store: store,
                        storeNm: storeNm,
                        isRealTime: isRealTime,
                        timeUnit: timeUnit,
                        headers: headers,
                        timeAttr: timeAttr,
                        hierarchyType: hierarchy,
                        attrs: attrs,
                        controlAttrs: controlAttrs,
                        ignoredAttrs: ignoredAttrs,
                        fileBuff: fileBuff,
                        clustConfig: clustConfig,
                        baseDir: baseDir,
                        derivAttrs: derivAttrs
                    }

                    // finish the request
                    res.status(204);    // no content
                    res.end();

                    // build the model
                    modelStore.buildModel(opts, modelConfig, function (e, mid, model) {  // TODO check if the user is currently viewing a model before saving the new one to session???
                        if (e != null) {
                            log.error('Exception while building model!');
                            return;
                        }

                        if (isRealTime) {
                            if (log.debug())
                                log.debug('Online model created!');

                            modelManager.activate(model);
                        }
                    });
                } catch (e) {
                    log.error(e, 'Exception while uploading a new dataset!');
                    utils.handleServerError(e, req, res);
                }
            });
        } catch (e) {
            log.error(e, 'Exception while building model!');
            utils.handleServerError(e, req, res);
        }
    }

    function handleGotProgress(req, res, e, isFinished, progress, msg) {
        try {
            var session = req.session;
            var username = session.username;

            if (e != null) {
                log.error(e, 'Failed to build model!');
                modelStore.confirmModelBuilt(username);
                res.send({
                    isFinished: true,
                    progress: 100,
                    message: e.message,
                    error: e.message
                });
            } else if (isFinished) {
                var mid = modelStore.getBuildingModelId(username);
                modelStore.confirmModelBuilt(username);

                res.send({
                    isFinished: true,
                    progress: progress,
                    message: msg,
                    mid: mid
                });
            } else {
                res.send({
                    isFinished: false,
                    message: msg,
                    progress: progress
                });
            }

            res.end();
        } catch (e) {
            log.error(e, 'Failed to send progress to the UI!');
            utils.handleServerError(e, req, res);
        }
    }

    router.register('pingProgress', 'get', function (req, res) {
        if (log.trace())
            log.trace('Checking model progress ...');

        var session = req.session;
        var username = session.username;

        if (!modelStore.isBuildingModel(username)) throw new Error('The user is not building a model!');

        if (modelStore.hasProgress(username)) {
            if (log.trace())
                log.trace('Already have progress, returning result ...');

            var progress = modelStore.popProgress(username);
            handleGotProgress(req, res, progress.error, progress.isFinished, progress.progress, progress.message);
        }
        else {
            var timeoutId = setTimeout(function () {
                if (log.trace())
                    log.trace('Progress request expired, sending no content ...');

                if (modelStore.isBuildingModel(username) && modelStore.hasProgress(username))
                    modelStore.clearProgressCallback(username);

                if (!res.finished) {
                    res.status(204);    // no content
                    res.end();
                }
            }, 30000);

            modelStore.setProgressCallback(username, function (e, isFinished, progress, message) {
                if (log.trace())
                    log.trace('Progress callback called ...');

                clearTimeout(timeoutId);
                modelStore.clearProgressCallback(username);

                handleGotProgress(req, res, e, isFinished, progress, message);
            });
        }
    });

    router.register('buildModel', 'post', function (req, res) {
        var session = req.session;
        var username = session.username;

        if (username == null) throw new Error('Username is not defined when building a model!');

        log.debug('Building the model ...');

        // create new base with the default store
        log.debug('Creating users directory ...');
        var userDirNm = utils.getUserDir(username);

        fs.exists(userDirNm, function (exists) {
            if (exists) {
                log.debug('Reusing directory %s ...', userDirNm);
                createModel(req, res);
            } else {
                fs.mkdir(userDirNm, function (e) {
                    if (e != null) {
                        log.error(e, 'Failed to create directory!');
                        utils.handleServerError(e, req, res);
                        return;
                    }
                    createModel(req, res);
                });
            }
        });
    });

    router.register('selectDataset', 'post', function (req, res) {
        var session = req.session;
        var sessionId = req.sessionID;
        var username = session.username;

        var modelId = req.body.modelId;

        if (log.debug())
            log.debug('User %s selected model %s ...', username, modelId);

        db.fetchModel(modelId, function (e, modelConfig) {
            if (e != null) {
                log.error(e, 'Failed to get base info for user: %s', username);
                utils.handleServerError(e, req, res);
                return;
            }

            try {
                var fname;
                if (modelConfig.is_realtime == 1) {
                    fname = modelConfig.model_file;
                    var isActive = modelConfig.is_active == 1;

                    if (isActive) {
                        if (log.debug())
                            log.debug('Adding an already active model to the session ...');

                        var model = modelStore.getModel(modelId);
                        HttpUtils.saveModelToSession(sessionId, session, base, model, modelId, fname);
                        res.status(204);    // no content
                        res.end();
                    } else {
                        if (log.debug())
                            log.debug('Adding an inactive model to the session ...');

                        modelStore.loadOnlineModel(modelConfig.model_file, function (e, model) {
                            if (e != null) {
                                log.error(e, 'Exception while loading online model!');
                                utils.handleServerError(e, req, res);
                                return;
                            }

                            HttpUtils.saveModelToSession(sessionId, session, base, model, modelId, fname);
                            res.status(204);    // no content
                            res.end();
                        });
                    }
                } else {
                    fname = utils.getModelFName(modelConfig.base_dir);

                    modelStore.loadOfflineModel(modelConfig.base_dir, function (e, baseConfig) {
                        if (e != null) {
                            log.error(e, 'Exception while loading offline model!');
                            utils.handleServerError(e, req, res);
                            return;
                        }

                        HttpUtils.saveModelToSession(sessionId, session, baseConfig.base, baseConfig.model, modelId, fname);
                        res.status(204);    // no content
                        res.end();
                    });
                }
            } catch (e1) {
                log.error(e1, 'Failed to initialize model!');
                utils.handleServerError(e1, req, res);
            }
        });
    });

    router.register('modelConfig', 'get', function (req, res) {
        var mid = req.query.mid;

        modelManager.getModelConfiguration(mid, function (e, config) {
            if (e != null) {
                utils.handleServerError(e, req, res);
                return;
            }
            res.send(config);
            res.end();
        })
    });
}

function initConfigRestApi(router) {
    log.info('Initializing configuration REST API ...');

    router.register('config', 'get', function (req, res) {
        var properties = req.query.properties;

        if (log.debug())
            log.debug('Fetching property %s', JSON.stringify(properties));

        log.debug('Fetching intensities from DB ...');
        db.getMultipleConfig({properties: properties}, function (e, result) {
            if (e != null) {
                log.error(e, 'Failed to fetch properties from DB!');
                utils.handleServerError(e, req, res);
                return;
            }

            res.send(result);
            res.end();
        });
    });

    router.register('config', 'post', function (req, res) {
        var config = req.body;

        if (log.debug())
            log.debug('Setting configuration %s', JSON.stringify(config));

        db.setConfig(config, function (e) {
            if (e != null) {
                log.error(e, 'Failed to update settings!');
                utils.handleServerError(e, req, res);
                return;
            }

            if ('calc_coeff' in config) {
                if (log.debug())
                    log.debug('Found calc_coeff in the new configuration. Setting ...')
                pipeline.setCalcCoeff(config.calc_coeff == 'true');
            }

            res.status(204);    // no content
            res.end();
        });
    });
}

function initMessageRestApi(router) {
    router.register('modelMessages', 'get', function (req, res) {
        var limit = req.query.limit;
        var model = HttpUtils.extractModel(req.sessionID, req.session);

        if (limit != null) limit = parseInt(limit);

        modelManager.getLatestMessages(model, limit, function (e, messages) {
            if (e != null) {
                utils.handleServerError(e, req, res);
                return;
            }

            res.send(messages);
            res.end();
        })
    });

    router.register('modelMessagesCount', 'get', function (req, res) {
        var model = HttpUtils.extractModel(req.sessionID, req.session);
        modelManager.countMessages(model, function (e, count) {
            if (e != null) {
                utils.handleServerError(e, req, res);
                return;
            }

            res.send({ count: count });
            res.end();
        })
    });
}

function loadSaveModels() {
    db.fetchAllModels(function (e, models) {
        if (e != null) {
            log.error(e, 'Failed to fetch all models for saving!');
            return;
        }

        if (log.debug())
            log.debug('There is a total of %d models ...', models.length);

        for (let i = 0; i < models.length; i++) {
            let model = models[i];
            log.debug('Resaving model %s', model.name);
            modelStore.loadSaveModel(models[i]);
        }
    });
}

function loadActiveModels() {
    log.info('Loading active models ...');

    db.fetchActiveModels(function (e, models) {
        if (e != null) {
            log.error(e, 'Failed to load active models!');
            return;
        }

        if (log.debug())
            log.debug('There are %d active models on startup ...', models.length);

        var loadCb = function (e, model) {
            if (e != null) {
                log.error(e, 'Exception while loading online model!');
                return;
            }

            if (log.debug())
                log.debug('Activating model with id %s', model.getId());

            modelManager.activate(model);
        }

        for (var i = 0; i < models.length; i++) {
            var modelConfig = models[i];

            try {
                if (log.debug())
                    log.debug('Initializing model %s ...', modelConfig.name);

                modelStore.loadOnlineModel(modelConfig.model_file, loadCb);
            } catch (e1) {
                log.error(e1, 'Exception while initializing model %s', JSON.stringify(modelConfig));
            }
        }
    });
}

function excludeDirs(dirs, middleware) {
    function isInDirs(path) {
        for (var i = 0; i < dirs.length; i++) {
            if (path.startsWith(dirs[i]))
                return true;
        }
        return false;
    }

    return function (req, res, next) {
        var path = req.path;
        if (log.trace())
            log.trace('Request to path %s', path);

        if (isInDirs(path)) {
            if (log.trace())
                log.trace('Will not use middleware!')
            return next();
        } else {
            if (log.trace())
                log.trace('Will use middleware!')
            return middleware(req, res, next);
        }
    }
}

function excludeFiles(files, middleware) {
    return function (req, res, next) {
        let path = req.path;

        if (path == '/') path = '/index.html';

        if (log.trace())
            log.trace('Request to path %s', path);

        let isExcluded = false;

        for (let i = 0; i < files.length; i++) {
            let fname = files[i];
            if (path.endsWith(fname)) {
                isExcluded = true;
            }
        }

        if (isExcluded) {
            if (log.trace())
                log.trace('Will not use middleware!')
            return next();
        } else {
            if (log.trace())
                log.trace('Will use middleware!')
            return middleware(req, res, next);
        }
    }
}

function getPageOpts(req, next) {
    void next;

    let session = req.session;
    let page = HttpUtils.getRequestedPage(req);

    let opts = {
        utils: utils,
        username: null,
        theme: session.theme,
        model: session.model,
        modelConfig: null,
        models: null,
        modelStore: modelStore,
        error: null,
        warning: null,
        message: null,
        page: page,
        subtitle: titles[page],
        useCase: config.USE_CASE_NAME
    };

    if (HttpUtils.isLoggedIn(session)) {
        opts.username = session.username;
    }

    if (session.error != null) {
        opts.error = session.error;
        delete session.error;
    }

    if (session.warning != null) {
        opts.warning = session.warning;
        delete session.warning;
    }

    if (session.message != null) {
        opts.message = session.message;
        delete session.message;
    }

    return opts;
}

function prepPage(page) {
    return function(req, res) {
        res.render(page, getPageOpts(req, res));
    }
}

function addUseCaseOpts(opts, callback) {
    if (config.USE_CASE == config.USE_CASE_MHWIRTH) {
        let properties = [
            'calc_coeff',
            'deviation_extreme_lambda',
            'deviation_major_lambda',
            'deviation_minor_lambda',
            'deviation_significant_lambda'
        ];

        db.getMultipleConfig({properties: properties}, function (e, result) {
            if (e != null) {
                log.error(e, 'Failed to fetch properties from DB!');
                callback(e);
                return;
            }

            let props = {};
            for (let i = 0; i < result.length; i++) {
                props[result[i].property] = result[i].value;
            }

            opts.config = props;

            callback(undefined, opts);
        });
    } else {
        callback(undefined, opts);
    }
}

function prepDashboard() {
    return function (req, res) {
        var opts = getPageOpts(req, res);
        var session = req.session;

        var username = session.username;

        db.fetchUserModels(username, function (e, dbModels) {
            if (e != null) {
                log.error(e, 'Failed to fetch user models!');
                utils.handleServerError(e, req, res);
                return;
            }

            var models = {
                online: {
                    active: [],
                    inactive: [],
                },
                offline: [],
                publicModels: []
            };
            for (var i = 0; i < dbModels.length; i++) {
                var model = dbModels[i];

                var isOnline = model.is_active != null;
                var isPublic = model.is_public == 1;

                if (isPublic) {
                    models.publicModels.push(model);
                }
                else if (isOnline) {
                    if (model.is_active == 1) {
                        models.online.active.push(model);
                    } else {
                        models.online.inactive.push(model);
                    }
                }
                else {
                    models.offline.push(model);
                }
            }

            addUseCaseOpts(opts, function (e, opts) {
                if (e != null) {
                    utils.handleServerError(e, req, res);
                    return;
                }
                opts.models = models;
                res.render('dashboard', opts);
            });
        });
    }
}

function prepMainUi() {
    return function (req, res) {
        var opts = getPageOpts(req, res);
        var session = req.session;

        var model = session.model;

        opts.MEAN_STATE_LABEL = config.MEAN_STATE_LABEL;

        db.fetchModel(model.getId(), function (e, modelConfig) {
            if (e != null) {
                log.error(e, 'Failed to fetch model configuration from the DB!');
                utils.handleServerError(e, req, res);
                return;
            }

            opts.modelConfig = modelConfig;

            if (model.isOnline()) {
                opts.predictionThreshold = model.getModel().getParam('predictionThreshold');
                opts.timeHorizon = model.getModel().getParam('timeHorizon');
                opts.pdfBins = model.getModel().getParam('pdfBins');

                async.parallel([
                    function (xcb) {
                        modelManager.countTotalActive(xcb);
                    },
                    function (xcb) {
                        modelManager.getLatestMessages(model, 10, xcb);
                    }
                ], function (e, results) {
                    if (e != null) {
                        log.error(e, 'Failed to pred page for an online model!');
                        utils.handleServerError(e, req, res);
                        return;
                    }

                    var activeCount = results[0];
                    var messages = results[1];

                    opts.activeModelCount = activeCount;
                    opts.messages = messages;

                    res.render('ui', opts);
                })
            } else {
                res.render('ui', opts);
            }
        });
    }
}

function accessControl(req, res, next) {
    var session = req.session;

    var page = HttpUtils.getRequestedPage(req);
    var dir = HttpUtils.getRequestedPath(req);

    // if the user is not logged in => redirect them to login
    // login is exempted from the access control
    if (!HttpUtils.isLoggedIn(session)) {
        if (log.debug())
            log.debug('Session data missing for page %s, dir %s ...', page, dir);

        var isAjax = req.xhr;
        if (isAjax) {
            if (log.debug())
                log.debug('Session data missing for AJAX API call, blocking!');
            utils.handleNoPermission(req, res);
        } else {
            redirect(res, 'login.html');
        }
    } else {
        next();
    }
}

function getHackedSessionStore() {
    var store =  new SessionStore();
    store.on('preDestroy', function (sessionId, session) {
        HttpUtils.clearModelFromSession(sessionId, session, base);
        if (sessionId in fileBuffH)
            delete fileBuffH[sessionId];
    });
    return store;
}

function initServer(sessionStore, parseCookie) {
    log.info('Initializing web server ...');

    var sess = session({
        unset: 'destroy',
        store: sessionStore,
        cookie: { maxAge: 1000*60*60*24 },  // the cookie will last for 1 day
        resave: true,
        saveUninitialized: true
    });

    // the paths which will be excluded from the session
    var sessionExcludePaths = (function () {
        var paths = [ DATA_PATH ];
        return paths
    })();

    app.set('view engine', 'ejs');
    app.use(parseCookie);
    app.use(excludeDirs(sessionExcludePaths, sess));
    // automatically parse body on the API path
    app.use(LOGIN_PATH + '/', bodyParser.urlencoded({ extended: false, limit: '50Mb' }));
    app.use(LOGIN_PATH + '/', bodyParser.json({limit: '50Mb'}));
    app.use(API_PATH + '/', bodyParser.urlencoded({ extended: false, limit: '50Mb' }));
    app.use(API_PATH + '/', bodyParser.json({limit: '50Mb'}));
    app.use(DATA_PATH + '/', bodyParser.json({limit: '50Mb'}));
    app.use(fzi.STREAM_PIPES_PATH + '/', bodyParser.json({limit: '50Mb'}));
    app.use(fzi.STREAM_PIPES_PATH + '/', bodyParser.urlencoded({ extended: false, limit: '50Mb' }));

    // when a session expires, redirect to index
    app.use('/ui.html', function (req, res, next) {
        var model = HttpUtils.extractModel(req.sessionID, req.session);
        // check if we need to redirect to the index page
        if (model == null) {
            log.debug('Session data missing, redirecting to index ...');
            res.redirect('dashboard.html');
        } else {
            next();
        }
    });

    // initialize the routing system
    (function () {
        let extractAction = function (req) {
            return req.params.action;
        }
        let handleError = function (e, req, res) {
            utils.handleServerError(e, req, res);
        }

        // routers for specific APIs
        let loginRouter = new routers.HttpRequestRouter({
            extractRoute: extractAction,
            onError: handleError
        })
        let actionRouter = new routers.HttpRequestRouter({
            extractRoute: extractAction,
            onError: handleError
        })

        let routeLogin = function (req, res) { loginRouter.route(req, res); }
        let routeApi = function (req, res) { actionRouter.route(req, res); }

        app.get(LOGIN_PATH + '/:action', routeLogin);
        app.post(LOGIN_PATH + '/:action', routeLogin);
        app.get(API_PATH + '/:action', routeApi);
        app.post(API_PATH + '/:action', routeApi);

        initLoginRestApi(loginRouter);
        initServerApi(actionRouter);
        initStreamStoryRestApi(actionRouter);
        initConfigRestApi(actionRouter);
        initMessageRestApi(actionRouter);
        initDataUploadApi(actionRouter);
    })();

    var sessionExcludeDirs = [
        '/login',
        '/js',
        '/css',
        '/img',
        '/lib',
        '/popups',
        '/material',
        '/landing',
        '/streampipes',
        '/data'
    ];
    var sessionExcludeFiles = [
        'index.html',
        'login.html',
        'register.html',
        'resetpassword.html'
    ];

    app.use(excludeDirs(sessionExcludeDirs, excludeFiles(sessionExcludeFiles, accessControl)));

    // the index page
    app.get('/', prepPage('landing'));
    app.get('/index.html', prepPage('landing'));
    // the other pages
    app.get('/login.html', prepPage('login'));
    app.get('/register.html', prepPage('register'));
    app.get('/resetpassword.html', prepPage('resetpassword'));
    app.get('/profile.html', prepPage('profile'));
    app.get('/dashboard.html', prepDashboard('dashboard'));
    app.get('/ui.html', prepMainUi('ui'));

    // serve static directories on the UI path
    app.use(UI_PATH, express.static(path.join(__dirname, '../ui')));

    // start server
    var server = app.listen(config.SERVER_PORT);

    log.info('================================================');
    log.info('Server running at http://localhost:%d', config.SERVER_PORT);
    log.info('Serving UI at: %s', UI_PATH);
    log.info('Serving API at: %s', API_PATH);
    log.info('Data API: %s', DATA_PATH);
    log.info('Web socket listening at: %s', WS_PATH);
    log.info('================================================');

    return server;
}

exports.init = function (opts) {
    log.info('Initializing server ...');

    base = opts.base;
    db = opts.db;
    pipeline = opts.pipeline;

    var sessionStore = getHackedSessionStore();
    var parseCookie = cookieParser('somesecret_TODO make config');

    // serve static files at www
    var server = initServer(sessionStore, parseCookie);

    var ws = WebSocketWrapper({
        server: server,
        sessionStore: sessionStore,
        parseCookie: parseCookie,
        webSocketPath: WS_PATH,
        onConnected: function (socketId, sessionId, session) {
            try {
                var model = HttpUtils.extractModel(sessionId, session);

                if (model.getId() == null)
                    log.warn('Model ID not set when opening a new web socket connection!');
                if (model.isActive())
                    modelStore.addWebSocketId(model.getId(), socketId);
            } catch (e) {
                log.error(e, 'Exception on web socket connection callback!');
            }
        },
        onDisconnected: function (socketId) {
            if (log.debug())
                log.debug('Socket %d disconnected, removing from model store ...', socketId);
            modelStore.removeWebSocketId(socketId);
        }
    });

    modelStore = ModelStore({
        base: base,
        ws: ws,
        db: db,
        onAdd: function (model) {
            if (log.debug())
                log.debug('Model %s added to the model store, activating handlers ...', model.getId());

        },
        onRemove: function (model) {
            if (log.debug())
                log.debug('Model %s removed from the model store! Deactivating handlers ...', model.getId());
        }
    });

    modelManager = new ssmodules.ModelManager({
        db: db,
        modelStore: modelStore,
        base: base
    })

    loadSaveModels();
    loadActiveModels();
    initModelManagerHandlers();
    initPipelineHandlers();

    log.info('Done!');
};
