var WebSocket = require('ws');
var chproc = require('child_process');

var utils = require('../utils.js');
var config = require('../../config.js');

//=============================================================
// MODEL STORE
//=============================================================

exports.RealTimeModelStore = function (opts) {
	log.info('Initializing model store ...');
	
	if (opts.base == null) throw new Error('Missing base for online models!');
	if (opts.ws == null) throw new Error('Missing web sockets!');
	
	var store = {};
	
	var base = opts.base;
	var ws = opts.ws;
	var onAddCb = opts.onAdd;
	var onRemoveBc = opts.onRemove;
	
	function getModel(modelId) {
		if (!(modelId in store)) {
			log.warn('Tried to get a model that is not in the model store!');
			return null;
		}
		
		return store[modelId].model;
	}
	
	function getWebSocketIds(modelId) {
		if (!(modelId in store)) {
			log.warn('Tried to get web socket IDs of a non-existing model: %s!', modelId);
			return {};
		}
		
		return store[modelId].socketIds;
	}
	
	function saveModel(model) {
		var modelId = model.getId();
		
		if (modelId in store)
			log.warn('Model %s already in the model store!');
		
		store[modelId] = {
			model: model,
			socketIds: {}
		}
	}
	
	function removeModel(model) {
		var modelId = model.getId();
		
		if (!(modelId in store)) {
			log.warn('Tried to remove a model that is not in the store!');
			return;
		}
		
		delete store[modelId];
	}
	
	function addWebSocketId(modelId, socketId) {
		if (log.debug())
			log.debug('Adding new socket id %d to model %s', socketId, modelId);
		if (!(modelId in store))
			log.warn('Tried to register a new web socket ID to an unexisting model!');
		
		store[modelId].socketIds[socketId] = socketId;
	}
	
	function loadModel(modelBase, fname) {
		if (log.debug())
			log.debug('Loading model from file %s ...', fname);
		
		var model = qm.analytics.StreamStory({ 
			base: modelBase, 
			fname: fname
		});
		
		model.setId(fname);
		return model;
	}
	
	var that = {
		//====================================================
		// MODEL MANAGEMENT
		//====================================================
			
		getModel: getModel,
		add: function (model) {
			if (model.getId() == null) throw new Error('Tried to add a model with no ID to the real-time model store!');
			
			if (log.debug())
				log.debug('Adding a new model to the store with id: %s ...', model.getId());
			
			saveModel(model);
			if (onAddCb != null)
				onAddCb(model);
		},
		remove: function (model) {
			if (model.getId() == null) throw new Error('Tried to add a model with no ID to the real-time model store!');
			
			if (log.debug())
				log.debug('Removing model with id %s from the store ...', model.getId());
			
			removeModel(model);
			if (onRemoveBc != null)
				onRemoveBc(model);
		},
		updateModels: function (val) {
			for (var modelId in store) {
				var model = getModel(modelId);
				model.update(val);
			}
		},
		
		//====================================================
		// MESSAGES
		//====================================================
		
		sendMsg: function (modelId, msgStr) {
			var socketIds = getWebSocketIds(modelId);
			for (var socketId in socketIds) {
				ws.send(socketId, msgStr);
			}
		},
		distributeMsg: function (msgStr) {
			for (var modelId in store) {
				that.sendMsg(modelId, msgStr);
			}
		},
		addWebSocketId: function (modelId, socketId) {
			addWebSocketId(modelId, socketId);
		},
		removeWebSocketId: function (socketId) {
			for (var modelId in store) {
				var modelConf = store[modelId];
				if (socketId in modelConf.socketIds)
					delete modelConf.socketIds[socketId];
			}
		},
		
		//====================================================
		// CREATING AND LOADING MODELS
		//====================================================
		
		loadOfflineModel: function (baseDir) {
			if (log.debug())
				log.debug('Loading offline model from base: %s', baseDir);
			
			try {
				var dbDir = utils.getDbDir(baseDir);
				var modelFName = utils.getModelFName(baseDir);
				
				if (log.debug())
					log.debug('Opening new base: %s', dbDir);
				
				var userBase = new qm.Base({
					mode: 'openReadOnly',
					dbPath: utils.getDbDir(baseDir)
				});
				
				if (log.debug())
					log.debug('Loading model from file: %s', modelFName)
				
				var model = loadModel(userBase, modelFName);
				
				model.setOnline(false);
				
				return {base: userBase, model: model};
			} catch (e) {
				log.error(e, 'Failed to open base!');
				throw e;
			}
		},
		loadOnlineModel: function (fname) {
			var model = loadModel(base, fname);
			
			model.setOnline(true);
			
			return model;
		},
		buildModel: function (opts, callback) {
			if (callback == null) callback = function (e) { log.error(e, 'Exception while buillding model!'); }
			
			try {
				var userBase = opts.base;
				var store = opts.store;
				var storeNm = opts.storeNm;
				var timeUnit = opts.timeUnit;
				var headers = opts.headers;
				var timeAttr = opts.timeAttr;
				var attrs = opts.attrs;
				var controlAttrs = opts.controlAttrs;
				var isRealTime = opts.isRealTime;
				var fileBuff = opts.fileBuff;
				var clustConfig = opts.clustConfig;
				var baseDir = opts.baseDir;
				
				var attrSet = {};
				for (var i = 0; i < attrs.length; i++) {
					attrSet[attrs[i]] = true;
				}
				
				// initialize the feature spaces
	    		var obsFields = [];
				var contrFields = [];
				
				var usedFields = {};
				for (var i = 0; i < controlAttrs.length; i++) {
					var fieldNm = controlAttrs[i];
					contrFields.push({
						field: fieldNm,
						source: storeNm,
						type: 'numeric',
						normalize: true
					});
					usedFields[fieldNm] = true;
				}
				
				for (var i = 0; i < attrs.length; i++) {
					var fieldNm = attrs[i];
					if (fieldNm in usedFields || fieldNm == timeAttr) continue;
										
					obsFields.push({
						field: fieldNm,
						source: storeNm,
						type: 'numeric',
						normalize: true
					});
				}
				
				var obsFtrSpace = new qm.FeatureSpace(userBase, obsFields);
	    		var controlFtrSpace = new qm.FeatureSpace(userBase, contrFields);
				
	    		var recs = [];
	    		
				// fill the store
				log.debug('Processing CSV file ...');
				var lineN = 0;
				qm.fs.readCsvLines(fileBuff, {
					skipLines: 1,
					onLine: function (lineArr) {
						if (++lineN % 10000 == 0 && log.debug())
							log.debug('Read %d lines ...', lineN);
						
						var recJson = {};
						for (var i = 0; i < headers.length; i++) {
							var attr = headers[i].name;
							if (attr == timeAttr) {
								var date = utils.dateToQmDate(new Date(parseInt(lineArr[i])));
								recJson[attr] = date;
								if (log.trace())
									log.trace('Parsed date: %s', date);
							} else {
								recJson[attr] = parseFloat(lineArr[i]);
							}
						}
						
						if (log.trace())
							log.trace('Inserting value: %s', JSON.stringify(recJson));
						
						// create the actual record and update the feature spaces						
						recs.push(store.newRecord(recJson));
					},
					onEnd: function (err) {
						if (err != null) {
							log.error(err, 'Exception while parsing the uploaded CSV file!');
							callback(err);
							return;
						}
						
						log.info('Building StreamStory model ...');
						
						// create the configuration
						try {
							var modelParams = utils.clone(config.STREAM_STORY_PARAMS);
							modelParams.clustering = clustConfig;
							modelParams.transitions.timeUnit = timeUnit;
							
							if (log.info())
								log.info('Creating a new model with params: %s', JSON.stringify(modelParams));
							
							// create the model
							var model = qm.analytics.StreamStory({
								base: userBase,
								config: modelParams,
								obsFtrSpace: obsFtrSpace,
								controlFtrSpace: controlFtrSpace
							});
							
							// fit the model
							// first create a matrix out of the records
							model.fit({
								recV: recs,
								timeField: timeAttr,
								batchEndV: null
							});
							
							var fname = isRealTime ? 
									config.REAL_TIME_MODELS_PATH + new Date().getTime() + '.bin' :
									utils.getModelFName(baseDir);
							var modelId = fname;
							
							log.info('Saving model ...');
							model.save(fname);
							model.setId(modelId);
							model.setOnline(isRealTime);
							
							if (!isRealTime) {
								log.info('Closing base ...');
								userBase.close();
							}
							
							callback(undefined, model, fname);
						} catch (e) {
							log.error(e, 'Failed to create the store!');
							callback(e);
						}
					},
					onError: function (e) {
						log.error(e, 'Exception while parsing CSV!');
						callback(e);
					}
				});
				
				
//				var worker = chproc.fork(__dirname + '/buildmodel.js');
//				var model = null;
//				
//				if (log.info())
//					log.info('Spawned a child process with PID: %d', worker.pid);
//				
//				worker.on('exit', function (code, signal) {
//					if (code != 0) {
//						callback(new Error('Model builder exited with status ' + code + '!'));
//					} else {
//						log.info('Worker exited successfully!');
//						if (model == null)
//							callback(new Error('Worker exited, but the model has not been received!'));
//						else
//							callback(undefined, model);
//					}
//				});
//				
//				worker.on('message', function (msg) {
//					log.debug('Builder sent: %s', msg);
//				});
//				
//				worker.send('start');
			} catch (e) {
				callback(e);
			}
		}
	}
	
	return that;
}

//=============================================================
// WEBSOCKET WRAPPER
//=============================================================


exports.WebSocketWrapper = function (opts) {
	log.info('Creating web socket server ...');
	
	var server = opts.server;
	var sessionStore = opts.sessionStore;
	var parseCookie = opts.parseCookie;
	var connectedCb = opts.onConnected;
	var disconnectedCb = opts.onDisconnected;
	
	var sockets = {};
	var socketId = 0;
	
	var wss = new WebSocket.Server({
		server: server,
		path: opts.webSocketPath
	});
	
	function delSocket(id) {
		if (id == null) {
			log.warn('Tried to delete socket with null ID! Ignoring ...');
			return;
		}
		
		try {
			if (id in sockets) {
				delete sockets[id];
				if (disconnectedCb != null)
					disconnectedCb(id);
			}
			else
				log.warn('Tried to delete a socket that is not cached %d!', id);
		} catch (e) {
			log.error(e, 'Failed to delete socket %d!', id);
		}
	}

	function closeClient(id) {
		if (!(id in sockets)) return;
		
		var socket = sockets[id].client;
		
		if (socket.readyState == WebSocket.CLOSING || socket.readyState == WebSocket.CLOSED)
			delSocket(id);
			return;
		
		if (log.debug())
			log.debug("Closing client %d", id);
		
		sockets[id].client.close();
		delSocket(id);
	}
	
	function removeIdle() {
		for (var id in sockets) {
			if (!sockets[id].gotPong) {
				if (log.debug())
					log.debug('Socket %s idle, removing ...', id)
				closeClient(id);
			}
			sockets[id].gotPong = false;
		}
	}
	
	wss.on('connection', function (socket) {
		var id = socketId++;
		
		// get the session
		parseCookie(socket.upgradeReq, null, function (e) {
			if (e != null) {
				log.error(e, 'Failed to parse cookie while connecting a web socket!');
				return;
			}
			
			var sessionId = socket.upgradeReq.signedCookies['connect.sid'];
			if (sessionId == null) {
				log.warn('Failed to get a sessionId for web socket %s!', id);
				return;
			}
			
			sessionStore.get(sessionId, function (e1, session) {
				if (log.info())
					log.info('Got session for web socket %d ...', id);
				if (connectedCb != null)
					connectedCb(id, sessionId, session);
			});
		});
		
		if (log.info())
			log.info('New websocket connected id: %d ...', id);
		
		sockets[id] = { client: socket, gotPong: true };
		
		socket.on('message', function (msg) {
			log.debug('Received message from websocket id: %d, msg: %s', id, msg);
		});
		
		socket.on('pong', function () {
			if (log.trace())
				log.trace('Received pong %d', id);
			sockets[id].gotPong = true;
		});
		
		socket.on('error', function (e) {
			log.error(e, 'Error on web socket %d! Closing ...', id);
			closeClient(id);
		});
		
		socket.on('close', function (code, msg) {
			log.debug('Web socket %d closed with code %d, message: %s. Removing from socket list!', id, code, msg);
			delSocket(id);
		});
	});
	
	function isOpen(socketId) {
		return socketId in sockets && sockets[socketId].client.readyState == WebSocket.OPEN;
	}
	
	// ping clients periodically
	function ping() {
		try {
			removeIdle();
			
			if (log.trace())
				log.trace('Pinging %d clients ...', Object.keys(sockets).length);
			
			for (var id in sockets) {
				if (!isOpen(id)) {
					log.warn('Socket is not open %d, closing ...', id);
					closeClient(id);
					continue;
				}
				sockets[id].client.ping();
			}
		} catch (e) {
			log.error(e, 'Failed to ping!');
		}
		setTimeout(ping, config.PING_INTERVAL);
	}
	ping();
	
	var that = {
		/**
		 * Distributes the message to all the clients.
		 */
		distribute: function (msg) {
			if (log.debug())
				log.debug('Distributing message: %s', msg);
			
			for (var id in sockets) {
				that.send(id, msg);
			}
		},
		
		send: function (id, msg) {
			try {
				if (!isOpen(id)) {
					log.warn('Socket is not open %d, closing ...', id);
					closeClient(id);
					return;
				}
				
				if (log.debug())
					log.debug('Distributing to web socket: %d ...', id);
				sockets[id].client.send(msg);
			} catch (e) {
				log.error(e, 'Exception while distributig message. Web socket ID: %d', id);
			}
		},
		
		close: function () {
			wss.close();
		}
	}
	
	return that;
}