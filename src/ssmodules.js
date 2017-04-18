//==================================
// MODEL MANAGER
//==================================

class ModelManager {
    constructor(opts) {
        var self = this;

        if (opts.db == null) throw new Error('DB is missing!');
        if (opts.modelStore == null) throw new Error('Model store is missing!');

        self._db = opts.db;
        self._modelStore = opts.modelStore;

        self._handlers = {
            stateChanged: [],
            anomaly: [],
            outlier: [],
            prediction: [],
            activity: [],
        }
    }

    sendMessage(model, message, callback) {
        var self = this;
        self._modelStore.sendMsg(model.getId(), JSON.stringify(message));
        self.storeMessage(model, message, callback);
    }

    storeMessage(model, message, callback) {
        var self = this;
        var modelId = model.getId();
        self._db.storeMessage(modelId, message, callback);
    }

    /**
     * Fetches the latest messages for the given user.
     *
     * @param {object} user - the user
     * @param {number} limit - max number of messages
     * @param {funciton} callback - standard callback
     */
    getLatestMessages(model, limit, callback) {
        var self = this;

        if (model == null) return callback(new Error('Model missing!'));
        if (limit == null || limit <= 0) return callback(new Error('Invlid limit value: ' + limit)) ;

        var modelId = model.getId();
        var since = new Date(Date.now() - 1000*60*60*24*7);

        var opts = {
            mid: modelId,
            startTm: since,
            limit: limit
        }
        self._db.fetchLatestModelMessages(opts, function (e, messages) {
            if (e != null) return callback(e);
            callback(undefined, ModelManager._processOutputMessages(messages));
        });
    }

    /**
     * Returns the number of messages this model has received.
     *
     * @param {StreamStory} model - the model
     * @param {function} callback - standard callback
     */
    countMessages(model, callback) {
        var self = this;
        if (model == null) return callback(new Error('Model missing!'));
        var modelId = model.getId();
        self._db.countModelMessages(modelId, callback);
    }

    /**
     * Returns the count of all the active models in the system.
     *
     * @param {function} callback - standard callback
     */
    countTotalActive(callback) {
        var self = this;
        self._db.countActiveModels(function (e, result) {
            if (e != null) return callback(e);
            callback(undefined, result.count);
        });
    }

    /**
     * Returns the configuration which was used to create the model through the standard
     * callback.
     *
     * @param {number} modelId - the models identifier
     * @param {function} callback - standard callback
     */
    getModelConfiguration(modelId, callback) {
        if (modelId == null) return callback(new Error('Model ID missing!'));

        var self = this;

        self._db.fetchModelConfiguration(modelId, function (e, config) {
            if (e != null) return callback(e);
            if (config == null) return callback(new Error('Could not find configuration!'));
            callback(undefined, JSON.parse(config));
        })
    }

    activate(model) {
        let self = this;

        try {
            if (log.info()) {
                log.info('Activating an online model, ID: %s ...', model.getId());
            }

            self._modelStore.add(model);
            self._initModelHandlers(model, true);
            model.setActive(true);
        } catch (e) {
            log.error(e, 'Failed to activate real-time model!');
            throw e;
        }
    }

    deactivate(model) {
        let self = this;
        try {

            log.info('Deactivating an online model ...');
            self._modelStore.remove(model);
            self._initModelHandlers(model, false);
            model.setActive(false);
        } catch (e) {
            log.error(e, 'Failed to deactivate a model!');
        }
    }

    on(event, handler) {
        let self = this;
        if (!(event in self._handlers)) throw new Error('Invalid event: ' + event);
        self._handlers[event].push(handler);
    }

    _fireModelEvent(model, event, params) {
        let self = this;
        if (!(event in self._handlers)) throw new Error('Invalid event: ' + event);
        try {
            let handlers = self._handlers[event];
            for (let handler of handlers) {
                handler.apply(model, params);
            }
        } catch (e) {
            log.error(e, 'Exception while triggering model handlers!');
        }
    }

    _initModelHandlers(model, enable) {
        if (model == null) {
            log.warn('StreamStory is NULL, cannot register callbacks ...');
            return;
        }

        let self = this;

        log.info('Registering StreamStory callbacks for model %s ...', model.getId());

        if (enable) {
            let eventHandler = function (event) {
                if (log.debug())
                    log.debug('Registering \'' + event + '\' handler for model: ' + model.getId());
                return function () {
                    self._fireModelEvent(model, event, arguments);
                }
            }

            model.onStateChanged(eventHandler('stateChanged'));
            model.onAnomaly(eventHandler('anomaly'));
            model.onOutlier(eventHandler('outlier'));
            model.onPrediction(eventHandler('prediction'));
            model.getModel().onActivity(eventHandler('activity'));
        } else {
            log.debug('Removing StreamStory handlers for model %s ...', model.getId());
            log.debug('Removing state changed callback ...');
            model.onStateChanged(null);
            log.debug('Removing anomaly callback ...');
            model.onAnomaly(null);
            log.debug('Removing outlier callback ...');
            model.onOutlier(null);
            log.debug('Removing prediction callback ...');
            model.onPrediction(null);
            log.debug('Removing activity callback ...');
            model.getModel().onActivity(null);
        }
    }

    static _processOutputMessages(messages) {
        var result = [];
        for (var i = 0; i < messages.length; i++) {
            result.push(messages[i].content);
        }
        return result;
    }
}

class HttpUtils {
    static getRequestedPage(req) {
        return req.path.split('/').pop();
    }
    static getRequestedPath(req) {
        let path = req.path;
        if (path.includes('//')) {
            path = path.split('//').pop();
        }
        var spl = path.split('/');
        spl.pop();
        let result = spl.length > 1 ? spl.pop() : '';
        return result;
    }
    static extractModel(sessionId, session) {
        return session.model;
    }
    static extractModelFile(session) {
        return session.modelFile;
    }
    static loginUser(session, opts) {
        if (opts.username == null) throw new Error('Usetname missing when logging in!');
        if (opts.theme == null) throw new Error('Theme missing when logging in!');

        session.username = opts.username;
        session.theme = opts.theme;
    }
    static clearSession(sessionId, session, defaultBase) {
        if (defaultBase == null) throw new Error('Did not set default base!');
        HttpUtils.clearModelFromSession(sessionId, session, defaultBase);
        delete session.username;
        delete session.theme;
    }
    static isLoggedIn(session) {
        return session.username != null;
    }
    static clearModelFromSession(sessionId, session, globalBase) {
        if (log.debug())
            log.debug('Cleaning up session %s ...', sessionId);

        // close the base
        if (session.base == null)
            return;

        if (log.debug())
            log.debug('Closing base ...');

        if (session.base != null) {
            if (session.base == globalBase) {
                log.debug('Will not close base as it is the real-time base ...');
            } else {
                if (log.debug())
                    log.debug('Closing base for user %s ...', session.username);

                if (!session.base.isClosed()) {
                    session.base.close();
                    log.debug('Base closed!');
                } else {
                    log.debug('Base already closed, no need to close again!');
                }
            }
        }

        delete session.base;
        delete session.model;
        delete session.modelId;
        delete session.modelFile;
    }
    static saveModelToSession(sessionId, session, userBase, model, modelId, fname) {
        if (session.base != null)
            HttpUtils.clearModelFromSession(sessionId, session);

        if (log.debug())
            log.debug('Saving new data to session %s ...', sessionId);

        if (userBase.isClosed())
            throw new Error('Tried to save a closed base to session!');

        session.base = userBase;
        session.model = model;
        session.modelId = modelId;
        session.modelFile = fname;

        if (log.debug())
            log.debug('Saved to session!');
    }
}

//==================================
// EXPORTS
//==================================

exports.ModelManager = ModelManager;
exports.HttpUtils = HttpUtils;
