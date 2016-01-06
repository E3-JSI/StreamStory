var WebSocket = require('ws');

var StreamStory = require('../streamstory.js').StreamStory;
var utils = require('../utils.js');
var config = require('../../config.js');

//=============================================================
// MODEL STORE
//=============================================================

exports.RealTimeModelStore = function (opts) {
	log.info('Initializing model store ...');
	
	if (opts.base == null) throw new Error('Missing base for online models!');
	if (opts.ws == null) throw new Error('Missing web sockets!');
	if (opts.db == null) throw new Error('Missing database in model store!');
	
	var store = {};
	var buildingModelStore = {};
	
	var base = opts.base;
	var ws = opts.ws;
	var onAddCb = opts.onAdd;
	var onRemoveBc = opts.onRemove;
	var db = opts.db;
	
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
	
	function loadModel(modelBase, fname, callback) {
		if (log.debug())
			log.debug('Loading model from file %s ...', fname);
		
		var model = StreamStory({ 
			base: modelBase, 
			fname: fname
		});
		
		db.fetchModelByFName(fname, function (e, dbModel) {
			if (e != null) {
				log.error(e, 'Failed to fetch a model from the DB!');
				callback(e);
				return;
			}
			
			if (log.trace())
				log.trace('Setting model id to ' + dbModel.mid);
			
 			model.setId(dbModel.mid);
			callback(undefined, model);
		});
	}
	
	function hasProgress(username) {
		if (!that.isBuildingModel(username)) throw new Error('User ' + username + ' is not building a model!');
		return buildingModelStore[username].progress != null;
	}
	
	function popProgress(username) {
		if (!that.hasProgress(username)) throw new Error('User ' + username + ' does not have any progress to report!');
		
		var status = buildingModelStore[username];
		var progress = status.progress;
		
		status.prevProgress = progress;
		status.progress = null;
		
		return {
			error: status.error,
			message: progress.message,
			isFinished: progress.isFinished,
			progress: progress.progress
		}
	}
	
	function setProgress(username, isFinished, progress, message) {
		if (!that.isBuildingModel(username)) throw new Error(username + ' is not building a model!');
	
		var status = buildingModelStore[username];
		status.progress = {
			message: message,
			progress: progress,
			isFinished: isFinished
		}
	}
	
	function updateProgress(username, isFinished, progress, message) {
		if (log.trace())
			log.trace('Updating progress ...');
		
		if (!that.isBuildingModel(username)) throw new Error(username + ' is not building a model!');
		
		var status = buildingModelStore[username];
		
		status.prevProgress = status.progress;
		setProgress(username, isFinished, progress, message);
		
		var callback = status.progressCallback;
		if (callback != null) {
			var progress = popProgress(username);			
			callback(status.error, progress.isFinished, progress.progress, progress.message);
		}
	}
	
	function startBuildingModel(username, callback) {
		buildingModelStore[username] = {
			progress: null,
			prevProgress: null,
			callback: callback,
			error: null,
			mid: null
		};
		
		updateProgress(username, false, 0, 'Initilizing ...');
	}
	
	function setModelBuildError(username, e) {
		log.warn('Setting model build error for user: %s', username);
		
		if (!that.isBuildingModel(username)) throw new Error(username + ' is not building a model!');
		
		var status = buildingModelStore[username];
		status.error = e;
		
		updateProgress(username, true, 100, 'Error while building model: ' + e.message);
	}
	
	function setModelFinshed(username, mid, model) {
		if (log.trace())
			log.trace('Finished building model, calling callbacks ...');
		
		if (!that.isBuildingModel(username)) throw new Error(username + ' is not building a model!');
		
		setProgress(username, true, 100, 'Finished!');		
		buildingModelStore[username].mid = mid;
		
		// callbacks
		buildingModelStore[username].callback(undefined, mid, model);
		updateProgress(username, true, 100, 'Finished!');
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
				
				var outVal = model.project(val);
				that.sendMsg(modelId, JSON.stringify({
					type: 'values',
					content: outVal
				}));
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
		
		loadOfflineModel: function (baseDir, callback) {
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
				
				loadModel(userBase, modelFName, function (e, model) {
					if (e != null) {
						callback(e);
						return;
					}
					
					model.setOnline(false);
					callback(undefined, {base: userBase, model: model});
				});
			} catch (e) {
				log.error(e, 'Failed to open base!');
				throw e;
			}
		},
		loadOnlineModel: function (fname, callback) {
			if (log.debug())
				log.debug('Loading online model from file: %s ...', fname);
			
			loadModel(base, fname, function (e, model) {
				if (e != null) {
					callback(e);
					return;
				}
				
				model.setOnline(true);
				
				if (log.debug())
					log.debug('Model %s loaded, calling callback ...', model.getId());
				
				callback(undefined, model);
			});
		},
		isBuildingModel: function (username) {
			return username in buildingModelStore;
		},
		confirmModelBuilt: function (username) {
			if (log.trace())
				log.trace('Confirming that the model was built ...');
			
			if (!that.isBuildingModel(username)) throw new Error('User ' + username + ' is not building a model!');
			
			delete buildingModelStore[username];
		},
		getBuildingModelId: function (username) {
			if (!that.isBuildingModel(username)) throw new Error('User ' + username + ' is not building a model!');
			if (buildingModelStore[username].mid == null) throw new Error('Model for ' + username + ' not yet built!');
			
			return buildingModelStore[username].mid;
		},
		hasProgress: hasProgress,
		popProgress: popProgress,
		setProgressCallback: function (username, callback) {
			if (!that.isBuildingModel(username)) throw new Error('User ' + username + ' is not building a model!');
			
			buildingModelStore[username].progressCallback = callback;
		},
		clearProgressCallback: function (username) {
			if (!that.isBuildingModel(username)) throw new Error('User ' + username + ' is not building a model!');
		
			buildingModelStore[username].progressCallback = null;
		},
		buildModel: function (opts, callback) {
			if (callback == null) callback = function (e) { log.error(e, 'Exception while buillding model!'); }
			if (that.isBuildingModel(opts.username)) throw new Error('User ' + opts.username + ' is already building a model!');
			
			try {
				startBuildingModel(opts.username, callback);
				
				var username = opts.username;
				var datasetName = opts.datasetName;
				var modelName = opts.modelName;
				var base = opts.base;
				var store = opts.store;
				var storeNm = opts.storeNm;
				var timeUnit = opts.timeUnit;
				var headers = opts.headers;
				var timeAttr = opts.timeAttr;
				var hierarchyType = opts.hierarchyType;
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
				
				var obsFtrSpace = new qm.FeatureSpace(base, obsFields);
	    		var controlFtrSpace = new qm.FeatureSpace(base, contrFields);
				
	    		var recs = new qm.RecordVector();
	    		
				// fill the store
				log.debug('Processing CSV file ...');
				
				var timeV = new qm.la.Vector({ vals: 0, mxVals: 200000 });
				
				var lineN = 0;
				qm.fs.readCsvAsync(fileBuff, { offset: 1 }, function onBatch(lines) {
					var nLines = lines.length;
					
					for (var entryN = 0; entryN < nLines; entryN++) {
						var lineArr = lines[entryN];
						
						if (++lineN % 10000 == 0 && log.debug()) {
							log.debug('Read %d lines ...', lineN);
							updateProgress(username, false, 20, 'Read ' + lineN + ' lines ...');
						}
						
						var recJson = {};
						for (var i = 0; i < headers.length; i++) {
							var attr = headers[i].name;
							if (attr == timeAttr) {
								var date = new Date(parseInt(lineArr[i]));
								var qmDate = utils.dateToQmDate(date);
								if (log.trace())
									log.trace('Parsed date: %s', date.toString());
								
								recJson[attr] = qmDate;
								timeV.push(date.getTime());
							} else {
								recJson[attr] = parseFloat(lineArr[i]);
							}
						}
						
						if (log.trace())
							log.trace('Inserting value: %s', JSON.stringify(recJson));
						
						// create the actual record and update the feature spaces
						recs.push(store.newRecord(recJson));
					}
				}, function onEnd(e) {
					if (e != null) {
						log.error(e, 'Exception while parsing the uploaded CSV file!');
						setModelBuildError(username, e);
//						callback(e);
						return;
					}
					
					log.info('Building StreamStory model ...');
					updateProgress(username, false, 40, 'Building the model ...');
					
					// create the configuration
					try {
						var modelParams = utils.clone(config.STREAM_STORY_PARAMS);
						modelParams.clustering = clustConfig;
						modelParams.transitions.timeUnit = timeUnit;
						modelParams.hierarchy = { isTransitionBased: hierarchyType == 'mchainPartitioning' };
						
						if (log.info())
							log.info('Creating a new model with params: %s', JSON.stringify(modelParams));
						
						// create the model
						var model = StreamStory({
							base: base,
							config: modelParams,
							obsFtrSpace: obsFtrSpace,
							controlFtrSpace: controlFtrSpace
						});
						
						// fit the model
						// first create a matrix out of the records
						var fitOpts = {
							recV: recs,
							timeV: timeV,
							batchEndV: null
						};
						
						model.getModel().onProgress(function (perc, msg) {
							updateProgress(username, false, (40 + 55*perc/100).toFixed(), msg);
						});
						
						model.fitAsync(fitOpts, function (e1) {
							if (e1 != null) {
								log.error(e1, 'Exception while fitting model!');
								setModelBuildError(username, e1);
//								callback(e1);
								return;
							}
							
							model.getModel().onProgress(null);
							
							if (log.debug()) {
								log.debug('Model created, storing ...');
								updateProgress(username, false, 95, 'Storing ...');
							}
							
							var fname = isRealTime ? 
									config.REAL_TIME_MODELS_PATH + new Date().getTime() + '.bin' :
									utils.getModelFName(baseDir);
							
							if (isRealTime) {
								var dbOpts = {
									username: username,
									model_file: fname,
									dataset: datasetName,
									name: modelName,
									is_active: 1
								}
								
								log.info('Storing a new online model ...');
								db.storeOnlineModel(dbOpts, function (e, mid) {
									if (e != null) {
										log.error(e, 'Failed to store offline model to DB!');
										setModelBuildError(username, e);
//										callback(e);
										return;
									}
																	
									log.info('Saving model ...');
									model.save(fname);
									model.setId(mid);
									model.setOnline(true);
									
									setModelFinshed(username, mid, model);
//									callback(undefined, model, undefined, fname);
								});
							} else {
								// store the model into the DB
								var dbOpts = {
									username: username,
									base_dir: baseDir,
									model_file: fname,
									dataset: datasetName,
									name: modelName
								}
								
								log.info('Storing a new offline model ...');
								db.storeOfflineModel(dbOpts, function (e, mid) {
									if (e != null) {
										log.error(e, 'Failed to store offline model to DB!');
										setModelBuildError(username, e);
//										callback(e);
										return;
									}
									
									try {
//										model.setId(mid);
//										model.setOnline(false);
										model.save(fname);
										// need to close the base to be able to re-open it later
										base.close();
										
										if (log.debug())
											log.debug('Offline model stored!');
										
										setModelFinshed(username, mid, undefined);
										
//										that.loadOfflineModel(baseDir, function (e, baseConfig) {
//											if (e != null) {
//												log.error(e, 'Failed to load an offline model!');
//												setModelBuildError(username, e);
////												callback(e);
//												return;
//											}
//											
//											var model = baseConfig.model;
//											var base = baseConfig.base;
//											
//											
////											callback(undefined, model, base, fname);
//										});
									} catch (e1) {
										log.error(e1, 'Failed to open base!');
										callback(e1);
									}
								})
							}
						});
					} catch (e) {
						log.error(e, 'Failed to create the store!');
						callback(e);
					}
				});
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
				
				if (log.trace())
					log.trace('Distributing to web socket: %d ...', id);
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