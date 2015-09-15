/*!
 * express-session
 * Copyright(c) 2010 Sencha Inc.
 * Copyright(c) 2011 TJ Holowaychuk
 * Copyright(c) 2015 Douglas Christopher Wilson
 * MIT Licensed
 */

/**
 * Module dependencies.
 * @private
 */

var MemoryStore = require('express-session').MemoryStore;
var util = require('util')

/**
 * Shim setImmediate for node.js < 0.10
 * @private
 */

/* istanbul ignore next */
var defer = typeof setImmediate === 'function'
	? setImmediate : function(fn){ process.nextTick(fn.bind.apply(fn, arguments)) }

/**
 * Module exports.
 */

module.exports = StreamStoryStore

function cleanup(store) {
	if (log.trace())
		log.trace('Cleaning up session store ...');
	var sessions = store.sessions;
	
	var now = Date.now();
	for (var sessionId in sessions) {
		(function() {
			var localSessionId = sessionId;
			var session = sessions[sessionId];
			var expires = typeof session.cookie.expires === 'string' ? new Date(session.cookie.expires) : session.cookie.expires;
			
			if (expires && expires <= Date.now()) {
				if (log.trace())
					log.trace('Session %s expired, destroying ...', sessionId);
				store.destroy(sessionId, function () {
					if (log.trace())
						log.trace('Destroyed session: %s', localSessionId);
		    	});
			}
		})();
	}
}

/**
 * A session store in memory.
 * @public
 */
function StreamStoryStore() {
	MemoryStore.call(this)
	this.sessions = Object.create(null)
	
	// cleanup the session store every 10 seconds
	var that = this;
	setInterval(function () { 
		cleanup(that);
	}, 30*1000);
}

/**
 * Inherit from Store.
 */

util.inherits(StreamStoryStore, MemoryStore)

/**
 * Get all active sessions.
 *
 * @param {function} callback
 * @public
 */

StreamStoryStore.prototype.all = function all(callback) {
	if (log.trace())
		log.trace('All called ...');
	
	var sessionIds = Object.keys(this.sessions)
	var sessions = Object.create(null)

	for (var i = 0; i < sessionIds.length; i++) {
		var sessionId = sessionIds[i]
		var session = getSession.call(this, sessionId)

		if (session) {
			sessions[sessionId] = session;
		}
	}

	callback && defer(callback, null, sessions)
}

/**
 * Clear all sessions.
 *
 * @param {function} callback
 * @public
 */

StreamStoryStore.prototype.clear = function clear(callback) {
	if (log.trace())
		log.trace('Clear called ...');
	this.sessions = Object.create(null)
	callback && defer(callback)
}

/**
 * Destroy the session associated with the given session ID.
 *
 * @param {string} sessionId
 * @public
 */

StreamStoryStore.prototype.destroy = function destroy(sessionId, callback) {
	if (log.trace())
		log.trace('Destroy called, sessionId: %s ...', sessionId);
	this.emit('preDestroy', sessionId, this.sessions[sessionId]);
	delete this.sessions[sessionId];
	this.emit('postDestroy', sessionId);
	callback && defer(callback)
}

/**
 * Fetch session by the given session ID.
 *
 * @param {string} sessionId
 * @param {function} callback
 * @public
 */

StreamStoryStore.prototype.get = function get(sessionId, callback) {
	if (log.trace())
		log.trace('Get called, sessionId: %s ...', sessionId);
	defer(callback, null, getSession.call(this, sessionId))
}

/**
 * Commit the given session associated with the given sessionId to the store.
 *
 * @param {string} sessionId
 * @param {object} session
 * @param {function} callback
 * @public
 */

/**
 * Get number of active sessions.
 *
 * @param {function} callback
 * @public
 */

StreamStoryStore.prototype.length = function length(callback) {
	if (log.trace())
		log.trace('Length called ...');
	this.all(function (err, sessions) {
		if (err) return callback(err)
		callback(null, Object.keys(sessions).length)
	})
}

StreamStoryStore.prototype.set = function set(sessionId, session, callback) {
	if (log.trace())
		log.trace('Set called, sessionId: %s, session: %s ...', sessionId, JSON.stringify(session));
	this.sessions[sessionId] = session;
	callback && defer(callback)
}

/**
 * Touch the given session object associated with the given session ID.
 *
 * @param {string} sessionId
 * @param {object} session
 * @param {function} callback
 * @public
 */

StreamStoryStore.prototype.touch = function touch(sessionId, session, callback) {
	if (log.trace())
		log.trace('StreamStoryStore.touch called for session %s ...', sessionId);
	
	var currentSession = getSession.call(this, sessionId)

	if (currentSession) {
		// update expiration
		currentSession.cookie = session.cookie
		this.sessions[sessionId] = currentSession
		
		if (log.trace())
			log.trace('New session cookie: %s', JSON.stringify(session.cookie));
	}

	callback && defer(callback)
}

StreamStoryStore.prototype.regenerate = function (req, fn) {
	if (log.trace())
		log.trace('StreamStoryStore.regenerate called ...');
	
	var self = this;
	this.destroy(req.sessionID, function(err){
		self.generate(req);
	    fn(err);
	});
}

/**
 * Get session from the store.
 * @private
 */
function getSession(sessionId) {
	if (log.trace())
		log.trace('getSession called for session: %s ...', sessionId);
	
	return this.sessions[sessionId];
}
