//==================================
// USER MANAGER
//==================================

/**
 * StreamStory user manager. Manages all user related stuff.
 *
 * @param {object} opts
 * @property [StreamStoryDatabase] opts.db - the database interface
 */
// function UserManager(opts) {
//     var self = this;

//     self._db = opts.db;
// }


//==================================
// MODEL MANAGER
//==================================

function ModelManager(opts) {
    var self = this;
    self._db = opts.db;
    self._modelStore = opts.modelStore;
}

ModelManager.prototype.sendMessage = function (model, message, callback) {
    var self = this;
    self._modelStore.sendMsg(model.getId(), JSON.stringify(message));
    self.storeMessage(model, message, callback);
}

ModelManager.prototype.storeMessage = function (model, message, callback) {
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
ModelManager.prototype.getLatestMessages = function (model, limit, callback) {
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
        callback(undefined, self._processOutputMessages(messages));
    });
}

ModelManager.prototype.countMessages = function (model, callback) {
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
ModelManager.prototype.countTotalActive = function (callback) {
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
ModelManager.prototype.getModelConfiguration = function (modelId, callback) {
    if (modelId == null) return callback(new Error('Model ID missing!'));

    var self = this;

    self._db.fetchModelConfiguration(modelId, function (e, config) {
        if (e != null) return callback(e);
        if (config == null) return callback(new Error('Could not find configuration!'));
        callback(undefined, JSON.parse(config));
    })
}

ModelManager.prototype._processOutputMessages = function (messages) {
    var result = [];
    for (var i = 0; i < messages.length; i++) {
        result.push(messages[i].content);
    }
    return result;
}

//==================================
// EXPORTS
//==================================

exports.ModelManager = ModelManager;
