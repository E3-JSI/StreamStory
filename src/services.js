var express = require('express');
var bodyParser = require("body-parser");
var path = require('path');
var WebSocket = require('ws');
var fs = require('fs');
var math = require('mathjs');
var mkdirp = require('mkdirp');
var multer = require('multer');
var session = require('express-session');
var SessionStore = require('./util/sessionstore.js');
var utils = require('./utils.js');
var broker = require('./broker.js');
var config = require('../config.js');
var fields = require('../fields.js');

var qmutil = qm.qm_util;

var UI_PATH = '/';
var API_PATH = '/api';
var WS_PATH = '/ws';

var app = express();

var server;
var ws;

var hmc;
var base;
var db;

var counts = {};
var storeLastTm = {};
var totalCounts = 0;

var lastCepTime = 0;
var lastRawTime = 0;

var intensConfig = {};

function getModel(sessionId, session) {
//	return session.model;
	return hmc;
}

function cleanUpSession(session) {
	if (session.base != null) {
		log.debug('Closing base for user %s ...', session.username);
		session.base.close();
		log.debug('Base closed!');
	}
	delete session.username;
	delete session.base;
	delete session.model;
	delete session.userConfig;
}

function saveToSession(session, username, userBase, model, userConfig) {
	log.debug('Saving new data to session ...');
	if (session.base != null)
		cleanUpSession(session);
	session.username = username;
	session.base = userBase;
	session.model = model;
	session.userConfig = userConfig;
}

function addRawMeasurement(val) {
	var storeNm = utils.storeFromTag(val.variable_type);
	
	if (!(storeNm in counts)) counts[storeNm] = 0;
	if (!(storeNm in storeLastTm)) storeLastTm[storeNm] = 0;
	
	counts[storeNm]++;
	
	if (totalCounts++ % config.RAW_PRINT_INTERVAL == 0)
		log.debug('Time: %s, Counts: %s', new Date(val.variable_timestamp).toString(), JSON.stringify(counts));
	
	var timestamp = val.variable_timestamp;
	var prevTimestamp = storeLastTm[storeNm];
	
	if (timestamp <= prevTimestamp)
		throw 'Invalid time for a single measurement! Current: ' + timestamp + ', prev: ' + prevTimestamp;
	if (timestamp < lastRawTime)
		throw 'Invalid time! Current: ' + timestamp + ', prev: ' + lastRawTime;
	
	var insertVal = {
		time_ms: timestamp,
		time: utils.dateToQmDate(new Date(timestamp)),
		value: val.value
	};

	base.store(storeNm).push(insertVal);
	storeLastTm[storeNm] = timestamp;
	lastRawTime = timestamp;
}

function addCepAnnotated(val) {	
	var time = val.time;
	
	if (isNaN(time)) {
		log.warn('CEP sent NaN time %s', JSON.stringify(val));
	} 
	else if (time <= lastCepTime) {
		log.warn('CEP sent invalid time %d <= %d: %s', time, lastCepTime, JSON.stringify(val));
		return;
	}
	
	val.time = utils.dateToQmDate(new Date(val.time));
	base.store(fields.OA_IN_STORE).push(val);
	
	lastCepTime = time;
}

var WebSocketWrapper = function () {
	log.info('Creating web socket server ...');
	
	var sockets = {};
	var socketId = 0;
	
	var wss = new WebSocket.Server({
		server: server,
		path: WS_PATH
	});
	
	function delSocket(id) {
		if (id == null) {
			log.warn('Tried to delete socket with null ID! Ignoring ...');
			return;
		}
		
		try {
			if (id in sockets)
				delete sockets[id];
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
	
	return {
		/**
		 * Distributes the message to all the clients.
		 */
		distribute: function (msg) {
			if (log.debug())
				log.debug('Distributing message: %s', msg);
			
			for (var id in sockets) {
				try {
					if (!isOpen(id)) {
						log.warn('Socket is not open %d, closing ...', id);
						closeClient(id);
						continue;
					}
					
					if (log.debug())
						log.debug('Distributing to web socket: %d ...', id);
					sockets[id].client.send(msg);
				} catch (e) {
					log.error(e, 'Exception while distributig message. Web socket ID: %d', id);
				}
			}
		},
		
		close: function () {
			wss.close();
		}
	}
}

function initRestApi() {
	log.info('Registering REST services ...');
	
	{
		log.info('Registering exit service ...');
		
		// multilevel analysis
		app.get(API_PATH + '/exit', function (req, resp) {
			try {
				log.info(API_PATH + '/exit called. Exiting qminer and closing server ...');
				utils.exit(base);
				resp.status(204);
			} catch (e) {
				log.error(e, 'Failed to exit!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		log.info('Registering save service ...');
		
		// multilevel analysis
		app.get(API_PATH + '/save', function (req, resp) {
			try {
				var model = getModel(req.sessionID, req.session);
				model.save(config.STREAM_STORY_FNAME);	// TODO change the file name
				resp.status(204);
			} catch (e) {
				log.error(e, 'Failed to save visualization model!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
	}
	
	{
		log.info('Registering push data service ...');
		
		var imported = 0;
		var printInterval = 10000;
		
		app.post(API_PATH + '/push', function (req, resp) {
			var batch = req.body;
			
			try {
				for (var i = 0; i < batch.length; i++) {
					var instance = batch[i];
					
					if (++imported % printInterval == 0 && log.trace())
						log.trace('Imported %d values ...', imported);
					
					addRawMeasurement(instance);
				}
				
				resp.status(204);
				resp.end();
			} catch (e) {
				log.error(e, 'Failed to process raw measurement!');
				resp.status(500);
				resp.end();
			}
		});
	}
	
	{
		log.info('Registering set parameter service ...');
		
		app.post(API_PATH + '/param', function (req, resp) {
			try {
				var paramName = req.body.paramName;
				var paramVal = parseFloat(req.body.paramVal);
				
				var model = getModel(req.sessionID, req.session);
				
				var paramObj = {};
				paramObj[paramName] = paramVal;
				
				model.getModel().setParams(paramObj);
				resp.status(204);	// no content
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		app.get(API_PATH + '/param', function (req, resp) {
			try {
				var param = req.query.paramName;
				var model = getModel(req.sessionID, req.session);
				
				var val = model.getModel().getParam(param);
				resp.send({ parameter: param, value: val });
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
	}
	
	{
		log.info('Registering multilevel service at drilling/multilevel ...');
		
		// multilevel analysis
		app.get(API_PATH + '/multilevel', function (req, resp) {
			try {
				var model = getModel(req.sessionID, req.session);
				
				log.debug('Querying MHWirth multilevel model ...');
				resp.send(model.getVizState());
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		// multilevel analysis
		app.get(API_PATH + '/features', function (req, resp) {
			try {
				var model = getModel(req.sessionID, req.session);
				log.debug('Fetching all the features ...');
				
				var ftrNames = model.getFtrNames();
				
				resp.send(ftrNames);
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
	}
	
	{
		log.info('Registering transition model service ...');
		
		// multilevel analysis
		app.get(API_PATH + '/transitionModel', function (req, resp) {
			try {
				var level = parseFloat(req.query.level);
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching transition model for level: %.3f', level);
				
				resp.send(model.getModel().getTransitionModel(level));
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
	}
	
	{
		log.info('Registering future and states services ...');
		
		// multilevel analysis
		app.get(API_PATH + '/currentState', function (req, resp) {
			try {
				var level = parseFloat(req.query.level);
				var model = getModel(req.sessionID, req.session);
				
				if (log.info())
					log.info('Fetching current state for level ' + level);
				
				var result = model.currState(level);
				
				if (log.info())
					log.info("Current state: %s", JSON.stringify(result));
				
				resp.send(result);
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		// multilevel analysis
		app.get(API_PATH + '/futureStates', function (req, resp) {
			try {
				var level = parseFloat(req.query.level);
				var currState = parseInt(req.query.state);
				
				var model = getModel(req.sessionID, req.session);
				
				if (req.query.time == null) {
					log.debug('Fetching future states currState: %d, height: %d', currState, level);
					resp.send(model.futureStates(level, currState));
				} else {
					var time = parseFloat(req.query.time);
					log.debug('Fetching future states, currState: %d, level: %d, time: %d', currState, level, time);
					resp.send(model.futureStates(level, currState, time));
				}
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		app.get(API_PATH + '/pastStates', function (req, resp) {
			try {
				var level = parseFloat(req.query.level);
				var currState = parseInt(req.query.state);
				
				var model = getModel(req.sessionID, req.session);
				
				if (req.query.time == null) {
					log.debug('Fetching past states currState: %d, height: %d', currState, level);
					resp.send(model.pastStates(level, currState));
				} else {
					var time = parseFloat(req.query.time);
					log.debug('Fetching past states, currState: %d, level: %d, time: %d', currState, level, time);
					resp.send(model.pastStates(level, currState, time));
				}
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		app.get(API_PATH + '/timeDist', function (req, resp) {
			try {
				var state = parseInt(req.query.state);
				var startTm = parseFloat(req.query.start);
				var endTm = parseFloat(req.query.end);
				var deltaTm = parseFloat(req.query.deltaTm);
				var height = parseFloat(req.query.level);
				
				var model = getModel(req.sessionID, req.session);
				
				resp.send(model.getModel().probsOverTime(height, state, startTm, endTm, deltaTm));
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		app.get(API_PATH + '/history', function (req, resp) {
			try {
				var level = parseFloat(req.query.level);
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching history for level %d', level);
				
				resp.send(model.getModel().histStates(level));
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
	}
	
	{
		log.info('Registering state details service ...');
		
		// state details
		app.get(API_PATH + '/details', function (req, resp) {
			try {
				var stateId = parseInt(req.query.stateId);
				var height = parseFloat(req.query.level);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching details for state: %d', stateId);
				
				resp.send(model.stateDetails(stateId, height));
			} catch (e) {
				log.error(e, 'Failed to query state details!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		// multilevel analysis
		app.get(API_PATH + '/histogram', function (req, resp) {
			try {
				var stateId = parseInt(req.query.stateId);
				var ftrIdx = parseInt(req.query.feature);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching histogram for state %d, feature %d ...', stateId, ftrIdx);
				
				resp.send(model.histogram(stateId, ftrIdx));
			} catch (e) {
				log.error(e, 'Failed to query state details!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		// multilevel analysis
		app.get(API_PATH + '/targetFeature', function (req, resp) {
			try {
				var height = parseFloat(req.query.height);
				var ftrIdx = parseInt(req.query.ftr);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching distribution for feature "%d" for height %d ...', ftrIdx, height);
				
				resp.send(model.getFtrDist(height, ftrIdx));
			} catch (e) {
				log.error(e, 'Failed to query state details!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		app.post(API_PATH + '/stateName', function (req, resp) {
			var stateId, stateNm;
			
			try {
				stateId = parseInt(req.body.id);
				stateNm = req.body.name;
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.info()) 
					log.info('Setting name of state %d to %s ...', stateId, stateNm);
				
				model.getModel().setStateName(stateId, stateNm);
				resp.status(204);	// no content
			} catch (e) {
				log.error(e, 'Failed to set name of state %d to %s', stateId, stateNm);
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		app.post(API_PATH + '/setTarget', function (req, resp) {
			var stateId, isTarget, height;
			
			try {
				stateId = parseInt(req.body.id);
				height = parseFloat(req.body.height);
				isTarget = JSON.parse(req.body.isTarget);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.info()) 
					log.info('Setting target state: %d, isTarget: ' + isTarget, stateId);
				
				
				model.getModel().setTarget(stateId, height, isTarget);
				resp.status(204);	// no content
			} catch (e) {
				log.error(e, 'Failed to set target state %d!', stateId);
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		app.post(API_PATH + '/setControl', function (req, resp) {
			var ftrIdx, factor;
			
			try {
				ftrIdx = parseInt(req.body.ftrIdx);
				factor = parseFloat(req.body.factor);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.info()) 
					log.info('Changing control %d by factor %d ...', ftrIdx, factor);
				
				model.setControl(ftrIdx, factor);
				resp.send(model.getVizState());
			} catch (e) {
				log.error(e, 'Failed to control %d by factor %d', ftrIdx, factor);
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
	}
}

function initDataUpload() {
	var upload = multer({
		storage: multer.memoryStorage(),				// will have file.buffer
		fileFilter: function (req, file, callback) {	// only accept csv files
			var passes = qmutil.stringEndsWith(file.originalname, '.csv');
			log.debug('Filtering uploaded file %s. File passess filter: ' + passes, JSON.stringify(file));
			callback(null, passes);
		}
	});	
	
	function getUserDir(username) {
		return config.QM_USER_BASES_PATH + username;
	}
	
	function getBaseDir(username, timestamp) {
		return getUserDir(username) + '/' + timestamp;
	}
	
	function getDbDir(baseDir) {
		return baseDir + '/db';
	}
	
	function getModelDir(baseDir) {
		return baseDir + '/StreamStory.bin';
	}
	
	function openBase(session, baseDir, username, userConfig) {
		log.info('Opening new base for user \'%s\': %s', username, baseDir);
		
		try {
			var userBase = new qm.Base({
				mode: 'openReadOnly',
				dbPath: getDbDir(baseDir)
			});
			
			var model = new qm.analytics.StreamStory({ 
				base: userBase, 
				fname: getModelDir(baseDir) 
			});
			
			saveToSession(session, username, userBase, model, userConfig);
		} catch (e) {
			log.error(e, 'Failed to open base!');
			throw e;
		}
	}
	
	var fileBuffH = {};
	
	app.post('/upload', upload.single('dataset'), function (req, res, next) {
		var session = req.session;
		
		var fileBuff = req.file.buffer;
		
		fileBuffH[req.sessionID] = fileBuff;
		
		session.fileName = req.file.originalname;
				
		var headers = [];
		qm.fs.readCsvLines(req.file.buffer, {
			lineLimit: 1,
			onLine: function (lineArr) {
				// read the header and create the store
				for (var i = 0; i < lineArr.length; i++) {
					headers.push({ name: lineArr[i] });
				}

				log.debug('Fields read!');
			},
			onEnd: function (err) {
				if (err != null) {
					log.error(err, 'Exception while reading CSV headers!');
					res.status(500);	// internal server error
					res.end();
					return;
				}
				
				log.info('Headers read, sending them back to the UI ...');
				session.headers = headers;
				res.send(headers);
				res.end();
			}
		});
	});
	
	function initBase(req, res) {
		try {
			var session = req.session;
			var sessionId = req.sessionID;
			
			var timeAttr = req.body.time;
			var userEmail = req.body.username;
			var timeUnit = req.body.timeUnit;
			var controlAttrs = req.body.controlAttrs;
			
			var headers = session.headers;
			
			log.info('Creating a new base for the current user ...');
			var baseDir = getBaseDir(userEmail, new Date().getTime());
			var dbDir = getDbDir(baseDir);
			
			mkdirp(dbDir, function (e) {
				if (e != null) {
					log.error(e, 'Failed to create base directory!');
					log.error(err, 'Exception while parsing the uploaded CSV file!');
					res.status(500);	// internal server error
					return;
				}
				
				var userBase = new qm.Base({
					mode: 'create',
					dbPath: dbDir
				});
				
				log.debug('Creating default store ...');
				var storeFields = [];
				for (var i = 0; i < headers.length; i++) {
					storeFields.push({
						name: headers[i].name,
						type: headers[i].name == timeAttr ? 'datetime' : 'float',
						'null': false
					})
				}
				
				var store = userBase.createStore({
					name: config.QM_USER_DEFAULT_STORE_NAME,
					fields: storeFields
				});
				
				var fileBuff = fileBuffH[req.sessionID];	// TODO bit of a hack, take care of possible memory leaks when sessions expire
				delete fileBuffH[req.sessionID];
				
				// fill the store
				log.debug('Filling the store ...');
				var i = 0;
				qm.fs.readCsvLines(fileBuff, {
					skipLines: 1,
					onLine: function (lineArr) {
						if (++i % 10 == 0)
							log.debug('Read %d lines ...', i);
						
						var rec = {};
						for (var i = 0; i < headers.length; i++) {
							if (headers[i].name == timeAttr) {
								rec[timeAttr] = utils.dateToQmDate(new Date(parseInt(lineArr[i])));
							} else {
								rec[headers[i].name] = parseFloat(lineArr[i]);
							}
						}
						
						if (log.trace())
							log.trace('Inserting value: %s', JSON.stringify(rec));
						
						store.push(rec);
					},
					onEnd: function (err) {
						if (err != null) {
							log.error(err, 'Exception while parsing the uploaded CSV file!');
							res.status(500);	// internal server error
							return;
						}
						
						log.info('New store created, building StreamStory model ...');
						
						try {
							// create the configuration
							var obsFields = [];
							var contrFields = [];
							
							var usedFields = {};
							for (var i = 0; i < controlAttrs.length; i++) {
								var fieldNm = controlAttrs[i];
								
								var fieldConfig = {
									field: fieldNm,
									source: config.QM_USER_DEFAULT_STORE_NAME,
									type: 'numeric',
									normalize: true
								}
								
								contrFields.push(fieldConfig);
								usedFields[fieldNm] = true;
							}
							
							for (var i = 0; i < headers.length; i++) {
								var fieldNm = headers[i].name;
								
								if (fieldNm in usedFields || fieldNm == timeAttr) continue;
								
								var fieldConfig = {
									field: fieldNm,
									source: config.QM_USER_DEFAULT_STORE_NAME,
									type: 'numeric',
									normalize: true
								}
								
								obsFields.push(fieldConfig);
							}
							
							// create the model
							var model = qm.analytics.StreamStory({
								base: userBase,
								config: {
									transitions: {
										type: 'continuous',
										timeUnit: timeUnit
									},
									clustering: {
										type: 'dpmeans',
										lambda: .7,
										minClusts: 10,
										rndSeed: 1,
										sample: 1,
										histogramBins: 20
									},
									pastStates: 2,
									verbose: true
								},
								obsFields: obsFields,
								contrFields: contrFields
							});
													
							model.fit({
								recSet: store.allRecords,
								timeField: timeAttr,
								batchEndV: null
							});
							
							log.info('Saving model and base ...');
							model.save(getModelDir(baseDir));
							userBase.close();
							
							log.info('Saved, opening base in read mode ...');
							
							var userConfig = {
								email: userEmail,
								baseDir: baseDir,
								dataset: session.fileName
							}
							
							db.addAndGetUserConfig(userConfig, function (e, userConfig) {
								if (e != null) {
									log.error(e, 'Failed to fetch user config from the DB!');
									res.status(500);	// internal server error
									res.end();
									return;
								}
								
								try {
									openBase(session, baseDir, userEmail, userConfig);
									
									// end request
									res.status(204);	// no content
									res.end();
								} catch (e1) {
									log.error(e1, 'Failed to open base!');
									res.status(500);	// internal server error
									res.end();
								}
							});
						} catch (e) {
							log.error(e, 'Failed to create the store!');
							res.status(500);	// internal server error
							res.end();
						}
					}
				});
			});
		} catch (e) {
			log.error(e, 'Exception while building model!');
			res.status(500);	// internal server error
			res.end();
		}
	}
	
	app.post(API_PATH + '/configureModel', function (req, res) {
		log.info('Building the model ...');
		
		// create new base with the default store
		log.info('Creating users directory ...');
		var userDirNm = getUserDir(req.body.username);
		
		fs.exists(userDirNm, function (exists) {
			if (exists) {
				log.debug('Reusing directory %s ...', userDirNm);
				initBase(req, res);
			} else {
				fs.mkdir(userDirNm, function (e) {
					if (e != null) {
						log.error(e, 'Failed to create directory!');
						res.status(500);	// internal server error
						res.end();
						return;
					}
					initBase(req, res);
				})
			}
		});
	});
	
	app.get(API_PATH + '/selectDataset', upload.single('dataset'), function (req, res, next) {
		var session = req.session;
		var username = req.query.email;
		
		db.getUserConfig(username, function (e, userBases) {
			if (e != null) {
				log.error(e, 'Failed to get base info for user: %s', username);
				res.status(500);	// internal server error
				res.end();
				return;
			}
			
			session.username = username;
			
			res.send(userBases.bases);
			res.end();
		});
	});
	
	app.post(API_PATH + '/selectDataset', function (req, res) {
		var session = req.session;
		var username = session.username;
		
		var baseDir = req.body.base;
		
		log.info('User %s selected base %s ...', username, baseDir);
		
		db.getUserConfig(username, function (e, userConfig) {
			if (e != null) {
				log.error(e, 'Failed to get base info for user: %s', username);
				res.status(500);	// internal server error
				res.end();
				return;
			}
			
			try {
				openBase(session, baseDir, username, userConfig);
				res.status(204);	// no content
				res.end();
			} catch (e) {
				log.error(e, 'Failed to open base for user %s!', username);
				res.status(500);	// internal server error
				res.end();
			}
		});
	});
}

function initMhwirthRestApi(pipeline) {
	app.get(API_PATH + '/config', function (req, resp) {
		try {
			var properties = req.query.properties;
			
			if (log.debug())
				log.debug('Fetching property %s', JSON.stringify(properties));
			
			log.info('Fetching intensities from DB ...');
       		db.getMultipleConfig({properties: properties}, function (e, result) {
       			if (e != null) {
       				log.error(e, 'Failed to fetch properties from DB!');
       				resp.status(500);	// internal server error
       				resp.end();
       				return;
       			}
       			
       			resp.send(result);
       			resp.end();
       		});
		} catch (e) {
			log.error(e, 'Failed to query state details!');
			resp.status(500);	// internal server error
			resp.end();
		}
	});
	
	app.post(API_PATH + '/config', function (req, res) {
		try {
			var config = req.body;
			
			if (log.debug())
				log.debug('Setting configuration %s', JSON.stringify(config));
			
       		db.setConfig(config, function (e, result) {
       			if (e != null) {
       				log.error(e, 'Failed to update settings!');
       				res.status(500);	// internal server error
       				res.end();
       				return;
       			}
       			
       			if ('calc_coeff' in config) {
       				if (log.debug())
       					log.debug('Found calc_coeff in the new configuration. Setting ...')
       				pipeline.setCalcCoeff(config.calc_coeff == 'true');
       			}
       			
       			res.status(204);	// no content
       			res.end();
       		});
		} catch (e) {
			log.error(e, 'Failed to query state details!');
			res.status(500);	// internal server error
			res.end();
		}
	});
}

function getHackedSessionStore() {
	var store =  new SessionStore();
	store.on('preDestroy', function (sessionId, session) {
		cleanUpSession(session);
	});
	return store;
}

function initServer(pipeline) {
	log.info('Initializing web server ...');

	app.use(session({ 
		secret: 'somesecret_TODO make config',
		unset: 'destroy',
		store: getHackedSessionStore(),
		cookie: { maxAge: 60*60*1000 }	// the cookie will last for 1h
	}));
	// automatically parse body on the API path
	app.use(API_PATH + '/', bodyParser.urlencoded({ extended: false }));
	app.use(API_PATH + '/', bodyParser.json());
	// when a session expires, redirect to index
	app.use('/ui.html', function (req, res, next) {
		var model = getModel(req.sessionID, session);
		
		// check if we need to redirect to the index page
		if (model == null) {
			log.info('Session data missing, redirecting to index ...');
			res.redirect('.');
		} else {
			next();
		}
	});
		
	initRestApi();
	initMhwirthRestApi(pipeline);
	initDataUpload();
	
	// serve static directories on the UI path
	app.use(UI_PATH, express.static(path.join(__dirname, config.WWW_DIR)));
	
	// start server
	server = app.listen(config.SERVER_PORT);
	ws = WebSocketWrapper();
	
	log.info('================================================');
	log.info('Server running at http://localhost:%d', config.SERVER_PORT);
	log.info('Serving UI at: %s', UI_PATH);
	log.info('Serving API at: %s', API_PATH);
	log.info('Web socket listening at: %s', WS_PATH);
	log.info('================================================');
}

function initHandlers(pipeline) {
	log.info('Registering state changed callback ...');
	
	if (hmc == null) return;
	
	hmc.onStateChanged(function (states) {
		if (log.debug())
			log.debug('State changed: %s', JSON.stringify(states));
				
		ws.distribute(JSON.stringify({
			type: 'stateChanged',
			content: states
		}));
	});
	
	hmc.onAnomaly(function (desc) {
		if (log.info())
			log.info('Anomaly detected: %s TODO: currently ignoring!', desc);
				
//		ws.distribute(JSON.stringify({
//			type: 'anomaly',
//			content: desc
//		}));
	});
	
	hmc.onOutlier(function (ftrV) {
		if (log.info())
			log.info('Outlier detected!');
				
		ws.distribute(JSON.stringify({
			type: 'outlier',
			content: ftrV
		}));
	});
	
	
	hmc.onPrediction(function (date, currState, targetState, prob, probV, timeV) {
		if (log.info())
			log.info('Sending prediction, with PDF length: %d', probV.length);
		
		var msg = {
			type: 'prediction',
			content: {
				time: date.getTime(),
				currState: currState,
				targetState: targetState,
				probability: prob,
				pdf: {
					type: 'histogram',
					probV: probV,
					timeV: timeV
				}
			}
		};
		
		var msgStr = JSON.stringify(msg);
		broker.send(broker.PREDICTION_PRODUCER_TOPIC, msgStr);
		ws.distribute(msgStr);
	});
	
	// configure coefficient callback
	{
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
			pipeline.onCoefficient(function (opts) {
				var pdf = null;
				
				if (math.abs(opts.zScore) >= 5) {
					pdf = {
						type: 'exponential',
						lambda: intensConfig.deviation_extreme_lambda		// degradation occurs once per month
					};
				} else if (math.abs(opts.zScore) >= 4) {					// major deviation
					pdf = {
						type: 'exponential',
						lambda: intensConfig.deviation_major_lambda			// degradation occurs once per two months
					};
				} else if (math.abs(opts.zScore) >= 3) {					// significant deviation
					pdf = {
						type: 'exponential',
						lambda: intensConfig.deviation_significant_lambda	// degradation occurs once per year
					};
				} else if (math.abs(opts.zScore) >= 2) {					// minor deviation
					pdf = {
						type: 'exponential',
						lambda: intensConfig.deviation_minor_lambda			// degradation occurs once per two years
					};
				}
				
				ws.distribute(JSON.stringify({
					type: 'coeff',
					content: opts
				}));
				
				if (pdf != null) {
					var msg = msg = {
						type: 'prediction',
						content: {
							time: opts.time,
							eventId: opts.eventId,
							pdf: pdf
						}
					};
					
					var msgStr = JSON.stringify(msg);
					broker.send(broker.PREDICTION_PRODUCER_TOPIC, msgStr);
					ws.distribute(msgStr);
				}
			});
		});
	}
}

function initBroker() {
	broker.init();
	
	var imported = 0;
	var printInterval = 100;
	
	broker.onMessage(function (msg) {		
		if (msg.type == 'raw') {
			if (++imported % printInterval == 0 && log.trace())
				log.trace('Imported %d values ...', imported);
			
			addRawMeasurement(msg.payload);
		} else if (msg.type == 'cep') {
			if (log.trace())
				log.trace('received CEP message: %s', JSON.stringify(msg));
			
			addCepAnnotated(msg.payload);
		} else {
			log.warn('Invalid message type: %s', msg.type);
		}
	});
}

exports.init = function (opts) {
	log.info('Initializing server ...');
	
	hmc = opts.model;
	base = opts.base;
	db = opts.db;
	
	// serve static files at www
	initServer(opts.pipeline);
	initHandlers(opts.pipeline);
	initBroker();
	
	log.info('Done!');
};
