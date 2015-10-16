var express = require('express');
var bodyParser = require("body-parser");
var path = require('path');
var fs = require('fs');
var math = require('mathjs');
var mkdirp = require('mkdirp');
var multer = require('multer');
var session = require('express-session');
var cookieParser = require('cookie-parser');

var SessionStore = require('./util/sessionstore.js');
var utils = require('./utils.js');
var broker = require('./broker.js');
var config = require('../config.js');
var fields = require('../fields.js');
var transform = require('./util/transform.js');

var ModelStore = require('./util/servicesutil.js').RealTimeModelStore;
var WebSocketWrapper = require('./util/servicesutil.js').WebSocketWrapper;

var qmutil = qm.qm_util;

var UI_PATH = '/';
var API_PATH = '/api';
var DATA_PATH = '/data';
var WS_PATH = '/ws';

var LONG_REQUEST_TIMEOUT = 1000*60*60*24;

var app = express();

var fileBuffH = {};	// if I store the file buffer directly into the session, the request takes forever to complete

var base;
var db;
var pipeline;
var modelStore;

var counts = {};
var storeLastTm = {};
var totalCounts = 0;

var lastRawTime = 0;

var intensConfig = {};

function getUserDir(username) {
	return config.USER_BASES_PATH + username;
}

function getBaseDir(username, timestamp) {
	return getUserDir(username) + '/' + timestamp;
}

function getDbDir(baseDir) {
	return baseDir + '/db';
}

function getModelFName(baseDir) {
	return baseDir + '/StreamStory.bin';
}

function activateModel(model) {
	try {
		log.info('Activating an online model ...');
		modelStore.add(model);
		initStreamStoryHandlers(model, true);
		model.setActive(true);
	} catch (e) {
		log.error(e, 'Failed to activate real-time model!');
		throw e;
	}
}

function deactivateModel(model) {
	try {
		log.info('Deactivating an online model ...');
		modelStore.remove(model);
		initStreamStoryHandlers(model, false);
		model.setActive(false);
	} catch (e) {
		log.error(e, 'Failed to deactivate a model!');
	}
}

function loadModel(modelBase, fname) {
	if (log.debug())
		log.debug('Loading model from file %s ...', fname);
	
	var model = new qm.analytics.StreamStory({ 
		base: modelBase, 
		fname: fname
	});
	
	model.setId(fname);
	return model;
}

function loadOfflineModel(baseDir) {
	if (log.debug())
		log.debug('Loading offline model from base: %s', baseDir);
	
	try {
		var dbDir = getDbDir(baseDir);
		var modelFName = getModelFName(baseDir);
		
		if (log.debug())
			log.debug('Opening new base: %s', dbDir);
		
		var userBase = new qm.Base({
			mode: 'openReadOnly',
			dbPath: getDbDir(baseDir)
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
}

function loadOnlineModel(fname) {
	var model = loadModel(base, fname);
	
	model.setOnline(true);
	
	return model;
}

function getModel(sessionId, session) {
	return session.model;
}

function getModelFile(session) {
	return session.modelFile;
}

function closeBase(session) {
	if (session.base == null)
		return;
	
	if (log.debug())
		log.debug('Closing base ...');
	
	if (session.base != null) {
		if (session.base == base) {
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
}

function cleanUpSession(sessionId, session) {
	if (log.debug())
		log.debug('Cleaning up session %s ...', sessionId);
	
	closeBase(session);
	
	delete session.username;
	delete session.base;
	delete session.model;
	delete session.modelId;
	delete session.modelFile;
}

function saveToSession(sessionId, session, username, userBase, model, modelId) {
	if (session.base != null)
		cleanUpSession(sessionId, session);
	
	if (log.debug())
		log.debug('Saving new data to session %s ...', sessionId);
	
	if (userBase.isClosed())
		throw new Error('Tried to save a closed base to session!');
	
	session.username = username;
	session.base = userBase;
	session.model = model;
	session.modelId = modelId;
	session.modelFile = modelId;	// TODO maybe in the future set modelId to something else
	
	if (log.debug())
		log.debug('Saved to session!');
}

function addRawMeasurement(val) {
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
			log.debug('Time: %s, Counts: %s', new Date(timestamp).toString(), JSON.stringify(counts));
		if (timestamp <= prevTimestamp)
			throw new Error('Invalid time for a single measurement: ' + timestamp + ' <= ' + prevTimestamp);
		if (timestamp < lastRawTime)
			throw new Error('Invalid time! Current: ' + timestamp + ', prev: ' + lastRawTime);
		
		var insertVal = transformed.value;
		pipeline.insertRaw(storeNm, insertVal);
		storeLastTm[storeNm] = timestamp;
		lastRawTime = timestamp;
	}
}

function initStreamStoryHandlers(model, enable) {
	log.info('Registering StreamStory callbacks ...');
	
	if (model == null) {
		log.warn('StreamStory is NULL, cannot register callbacks ...');
		return;
	}
	
	if (enable) {
		log.info('Registering state changed callback ...');
		model.onStateChanged(function (states) {
			if (log.debug())
				log.debug('State changed: %s', JSON.stringify(states));
					
			modelStore.sendMsg(model.getId(), JSON.stringify({
				type: 'stateChanged',
				content: states
			}));
		});
		
		log.info('Registering anomaly callback ...');
		model.onAnomaly(function (desc) {
			if (log.info())
				log.info('Anomaly detected: %s TODO: currently ignoring!', desc);
			
			// TODO not notifying anyone!
		});
		
		log.info('Registering outlier callback ...');
		model.onOutlier(function (ftrV) {
			if (log.info())
				log.info('Outlier detected!');
			
			modelStore.sendMsg(model.getId(), JSON.stringify({
				type: 'outlier',
				content: ftrV
			}));
			var brokerMsg = transform.genExpPrediction(100.1, 'minute', new Date().getTime);
			broker.send(broker.PREDICTION_PRODUCER_TOPIC, JSON.stringify(brokerMsg));
		});
		
		log.info('Registering prediction callback ...');
		model.onPrediction(function (date, currState, targetState, prob, probV, timeV) {
			if (log.info())
				log.info('Sending prediction, with PDF length: %d', probV.length);
			
			try {
				var _model = model.getModel();
				
				var currStateNm = _model.getStateName(currState);
				var targetStateNm = _model.getStateName(targetState);
				
				if (currStateNm == null || currStateNm.length == 0) currStateNm = currState;
				if (targetStateNm == null || targetStateNm.length == 0) targetStateNm = targetState;
				
				var uiMsg = {
					type: 'statePrediction',
					content: {
						time: date.getTime(),
						currState: currStateNm,
						targetState: targetStateNm,
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
				for (var i = 0; i < contr.length; i++) {
					var ftr = contr[i];
					metadata[ftr.name] = ftr.value;
				}
				
				var brokerMsg = transform.genHistPrediction(
					date.getTime(),
					currState == targetState ? ('Arrived in ' + currStateNm) : (currStateNm + ' to ' + targetStateNm),
					timeV,
					probV,
					model.getModel().getTimeUnit(),
					metadata
				);
				
				broker.send(broker.PREDICTION_PRODUCER_TOPIC, JSON.stringify(brokerMsg));
				modelStore.sendMsg(model.getId(), JSON.stringify(uiMsg));
			} catch (e) {
				log.error(e, 'Failed to send target state prediction!');
			}
		});
	} else {
		log.debug('Removing StreamStory handlers for model %s ...', model.getId());
		log.debug('Removing state changed callback ...');
		model.onStateChanged(null);
		log.debug('Removing anomaly callback ...');
		model.onAnomaly(null);
		log.debug('Removing outlier callback ...');
		model.onOutlier(null);
		log.debug('Removing prediction callback ...');
		model.onPrediction();
	}
}

function initStreamStoryRestApi() {
	log.info('Initializing StreamStory REST services ...');
	
	{
		log.info('Registering save service ...');
		app.get(API_PATH + '/save', function (req, res) {
			var session = req.session;
			var sessionId = req.sessionID;
			
			try {
				var model = getModel(sessionId, session);
				
				if (model == null) {
					res.status(401);	// unauthorized
					res.end();
					return;
				}
				
				var modelFile = getModelFile(session);
				
				if (modelFile == null)
					throw new Error('Model file missing when saving!');
				
				model.save(modelFile);
				res.status(204);
			} catch (e) {
				log.error(e, 'Failed to save visualization model!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
	}
	
	{
		log.info('Registering set parameter service ...');
		
		app.post(API_PATH + '/param', function (req, res) {
			try {
				var paramName = req.body.paramName;
				var paramVal = parseFloat(req.body.paramVal);
				
				if (log.debug())
					log.debug('Setting parameter %s to value %d ...', paramName, paramVal);
				
				var model = getModel(req.sessionID, req.session);
				
				var paramObj = {};
				paramObj[paramName] = paramVal;
				
				model.getModel().setParams(paramObj);
				res.status(204);	// no content
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		app.get(API_PATH + '/param', function (req, res) {
			try {
				var param = req.query.paramName;
				var model = getModel(req.sessionID, req.session);
				
				var val = model.getModel().getParam(param);
				res.send({ parameter: param, value: val });
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		app.get(API_PATH + '/timeUnit', function (req, res) {
			try {
				var model = getModel(req.sessionID, req.session);
				res.send({ value: model.getModel().getTimeUnit() });
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				res.status(500);	// internal server error
			}
			res.end();
		});
	}
	
	{
		log.info('Registering multilevel service at drilling/multilevel ...');
		
		// multilevel analysis
		app.get(API_PATH + '/model', function (req, res) {
			try {
				var model = getModel(req.sessionID, req.session);
				
				log.debug('Querying MHWirth multilevel model ...');
				res.send(model.getVizState());
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		// multilevel analysis
		app.get(API_PATH + '/features', function (req, res) {
			try {
				var model = getModel(req.sessionID, req.session);
				log.debug('Fetching all the features ...');
				res.send(model.getFtrDesc());
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
	}
	
	{
		log.info('Registering transition model service ...');
		
		// multilevel analysis
		app.get(API_PATH + '/transitionModel', function (req, res) {
			try {
				var level = parseFloat(req.query.level);
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching transition model for level: %.3f', level);
				
				res.send(model.getModel().getTransitionModel(level));
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
	}
	
	{
		log.info('Registering future and states services ...');
		
		// multilevel analysis
		app.get(API_PATH + '/currentState', function (req, res) {
			try {
				var level = parseFloat(req.query.level);
				var model = getModel(req.sessionID, req.session);
				
				if (log.info())
					log.info('Fetching current state for level ' + level);
				
				var result = model.currState(level);
				
				if (log.info())
					log.info("Current state: %s", JSON.stringify(result));
				
				res.send(result);
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		// multilevel analysis
		app.get(API_PATH + '/futureStates', function (req, res) {
			try {
				var level = parseFloat(req.query.level);
				var currState = parseInt(req.query.state);
				
				var model = getModel(req.sessionID, req.session);
				
				if (req.query.time == null) {
					log.debug('Fetching future states currState: %d, height: %d', currState, level);
					res.send(model.futureStates(level, currState));
				} else {
					var time = parseFloat(req.query.time);
					log.debug('Fetching future states, currState: %d, level: %d, time: %d', currState, level, time);
					res.send(model.futureStates(level, currState, time));
				}
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		app.get(API_PATH + '/pastStates', function (req, res) {
			try {
				var level = parseFloat(req.query.level);
				var currState = parseInt(req.query.state);
				
				var model = getModel(req.sessionID, req.session);
				
				if (req.query.time == null) {
					log.debug('Fetching past states currState: %d, height: %d', currState, level);
					res.send(model.pastStates(level, currState));
				} else {
					var time = parseFloat(req.query.time);
					log.debug('Fetching past states, currState: %d, level: %d, time: %d', currState, level, time);
					res.send(model.pastStates(level, currState, time));
				}
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		app.get(API_PATH + '/timeDist', function (req, res) {
			try {
				var state = parseInt(req.query.state);
				var startTm = parseFloat(req.query.start);
				var endTm = parseFloat(req.query.end);
				var deltaTm = parseFloat(req.query.deltaTm);
				var height = parseFloat(req.query.level);
				
				var model = getModel(req.sessionID, req.session);
				
				res.send(model.getModel().probsOverTime(height, state, startTm, endTm, deltaTm));
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		app.get(API_PATH + '/history', function (req, res) {
			try {
				var level = parseFloat(req.query.level);
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching history for level %d', level);
				
				res.send(model.getModel().histStates(level));
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
	}
	
	{
		log.info('Registering state details service ...');
		
		// state details
		app.get(API_PATH + '/stateDetails', function (req, res) {
			try {
				var stateId = parseInt(req.query.stateId);
				var height = parseFloat(req.query.level);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching details for state: %d', stateId);
				
				res.send(model.stateDetails(stateId, height));
			} catch (e) {
				log.error(e, 'Failed to query state details!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		// histograms
		app.get(API_PATH + '/histogram', function (req, res) {
			try {
				var stateId = parseInt(req.query.stateId);
				var ftrIdx = parseInt(req.query.feature);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching histogram for state %d, feature %d ...', stateId, ftrIdx);
				
				res.send(model.histogram(stateId, ftrIdx));
			} catch (e) {
				log.error(e, 'Failed to query histogram!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		app.get(API_PATH + '/transitionHistogram', function (req, res) {
			try {
				var sourceId = parseInt(req.query.sourceId);
				var targetId = parseInt(req.query.targetId);
				var ftrId = parseInt(req.query.feature);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching transition histogram for transition %d -> %d, feature %d ...', sourceId, targetId, ftrId);
				
				res.send(model.transitionHistogram(sourceId, targetId, ftrId));
			} catch (e) {
				log.error(e, 'Failed to query histogram!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		app.get(API_PATH + '/targetFeature', function (req, res) {
			try {
				var height = parseFloat(req.query.height);
				var ftrIdx = parseInt(req.query.ftr);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching distribution for feature "%d" for height %d ...', ftrIdx, height);
				
				res.send(model.getFtrDist(height, ftrIdx));
			} catch (e) {
				log.error(e, 'Failed to fetch the distribution of a feature!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		app.post(API_PATH + '/stateName', function (req, res) {
			var stateId, stateNm;
			
			try {
				var model = getModel(req.sessionID, req.session);
				
				stateId = parseInt(req.body.id);
				stateNm = req.body.name;
				
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
				res.status(204);	// no content
			} catch (e) {
				log.error(e, 'Failed to set name of state %d to %s', stateId, stateNm);
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		app.post(API_PATH + '/setTarget', function (req, res) {
			var stateId, isTarget, height;
			
			try {
				stateId = parseInt(req.body.id);
				height = parseFloat(req.body.height);
				isTarget = JSON.parse(req.body.isTarget);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.info()) 
					log.info('Setting target state: %d, isTarget: ' + isTarget, stateId);
				
				
				model.getModel().setTarget(stateId, height, isTarget);
				res.status(204);	// no content
			} catch (e) {
				log.error(e, 'Failed to set target state %d!', stateId);
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		app.post(API_PATH + '/setControl', function (req, res) {
			var ftrId, val;
			
			try {
				ftrId = parseInt(req.body.ftrIdx);
				val = parseFloat(req.body.val);
				var stateId = req.body.stateId != null ? parseInt(req.body.stateId) : null;
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug()) 
					log.debug('Changing control %d to value %d ...', ftrId, val);
				
				model.setControlVal({ ftrId: ftrId, val: val, stateId: stateId});
				res.send(model.getVizState());
			} catch (e) {
				log.error(e, 'Failed to control %d by factor %d', ftrId, val);
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		app.post(API_PATH + '/resetControl', function (req, res) {
			try {
				var ftrId = req.body.ftrIdx != null ? parseInt(req.body.ftrIdx) : null;
				var stateId = req.body.stateId != null ? parseInt(req.body.stateId) : null;
				
				var model = getModel(req.sessionID, req.session);
				
				if (model == null) throw new Error('Model is null, has the session expired?');
				
				if (log.info()) 
					log.info('Reseting control ...');
				
				model.resetControlVal({ ftrId: ftrId, stateId: stateId});
				res.send(model.getVizState());
				
			} catch (e) {
				log.error(e, 'Failed to reset control!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
		
		app.get(API_PATH + '/controlsSet', function (req, res) {
			try {
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching the state of any control features ...');
				
				res.send({ active: model.getModel().isAnyControlFtrSet() });
			} catch (e) {
				log.error(e, 'Failed to query the state of control features!');
				res.status(500);	// internal server error
			}
			
			res.end();
		});
	}
}

function initDataUploadApi() {
	log.info('Initializing data upload API ...');
	
	var upload = multer({
		storage: multer.memoryStorage(),				// will have file.buffer
		fileFilter: function (req, file, callback) {	// only accept csv files
			var passes = qmutil.stringEndsWith(file.originalname, '.csv');
			log.debug('Filtering uploaded file %s. File passess filter: ' + passes, JSON.stringify(file));
			callback(null, passes);
		}
	});
	
	app.post('/upload', upload.single('dataset'), function (req, res, next) {
		var sessionId = req.sessionID;
		var session = req.session;
		
		if (req.file == null)
			throw new Error('File not uploaded in the upload request!');
		
		var fileBuff = req.file.buffer;
		
		session.datasetName = req.file.originalname;
		fileBuffH[sessionId] = fileBuff;
		
		var headers = [];
		qm.fs.readCsvLines(fileBuff, {
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
				
				log.debug('Headers read, sending them back to the UI ...');
				if (log.trace()) 
					log.trace('Read headers: %s', JSON.stringify(headers));
				
				session.headerFields = headers;
				res.send(headers);
				res.end();
			}
		});
	});
	
	function initBase(req, res) {
		try {
			req.connection.setTimeout(LONG_REQUEST_TIMEOUT);	// set long timeout since the processing can take quite long
			
			var session = req.session;
			var sessionId = req.sessionID;
			
			var timeAttr = req.body.time;
			var username = req.body.username;
			var timeUnit = req.body.timeUnit;
			var attrs = req.body.attrs;
			var controlAttrs = req.body.controlAttrs;
			var isRealTime = req.body.isRealTime;
			
			var fileBuff = fileBuffH[sessionId];
			var datasetName = session.datasetName;
			var headers = session.headerFields;
			
			if (fileBuff == null)
				throw new Error('File is not defined while building a new model!');
			
			delete fileBuffH[sessionId];
			delete session.datasetName;
			delete session.headerFields;
			
			var attrSet = {};
			for (var i = 0; i < attrs.length; i++) {
				attrSet[attrs[i]] = true;
			}
			
			log.debug('Creating a new base for the current user ...');
			var baseDir = getBaseDir(username, new Date().getTime());
			var dbDir = getDbDir(baseDir);
			
			mkdirp(dbDir, function (e) {
				if (e != null) {
					log.error(e, 'Failed to create base directory!');
					res.status(500);	// internal server error
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
					} else {	// not real-time => create a new base and store
						if (log.debug())
							log.debug('Creating new base and store ...');
						
						var storeFields = [];
						for (var i = 0; i < headers.length; i++) {
							var attr = headers[i].name;
							storeFields.push({
								name: attr,
								type: attr == timeAttr ? 'datetime' : 'float',
								'null': false
							});
						}
						
						storeNm = config.QM_USER_DEFAULT_STORE_NAME;
						userBase = new qm.Base({
							mode: 'create',
							dbPath: dbDir
						});
						
						log.debug('Creating default store ...');
						store = userBase.createStore({
							name: storeNm,
							fields: storeFields
						});
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
								res.status(500);	// internal server error
								return;
							}
							
							log.info('Building StreamStory model ...');
							
							// create the configuration
							try {
								var modelParams = utils.clone(config.STREAM_STORY_PARAMS);
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
								
								if (isRealTime) {
									var fname = config.REAL_TIME_MODELS_PATH + new Date().getTime() + '.bin';
									var modelId = fname;
									
									log.info('Saving model ...');
									model.save(fname);
									
									var dbOpts = {
										username: username,
										model_file: fname,
										dataset: datasetName,
										is_active: 1
									}
									
									log.info('Storing a new online model ...');
									db.storeOnlineModel(dbOpts, function (e) {
										if (e != null) {
											log.error(e, 'Failed to store offline model to DB!');
											res.status(500);	// internal server error
											res.end();
											return;
										}
										
										try {
											if (log.debug())
												log.debug('Online model stored!');
											
											model.setId(modelId);
											activateModel(model);
											saveToSession(sessionId, session, username, userBase, model, modelId);
											
											// end request
											res.status(204);	// no content
											res.end();
										} catch (e1) {
											log.error(e1, 'Failed to open base!');
											res.status(500);	// internal server error
											res.end();
										}
									});
								}
								else {
									var modelFile = getModelFName(baseDir);
									var modelId = modelFile;
									
									log.info('Saving model and base ...');
									model.save(modelFile);
									userBase.close();
									log.info('Saved!');
									
									var dbOpts = {
										username: username,
										base_dir: baseDir,
										model_file: modelFile,
										dataset: datasetName
									}
									
									log.info('Storing a new offline model ...');
									db.storeOfflineModel(dbOpts, function (e) {
										if (e != null) {
											log.error(e, 'Failed to store offline model to DB!');
											res.status(500);	// internal server error
											res.end();
											return;
										}
										
										try {
											if (log.debug())
												log.debug('Offline model stored!');
											
											var baseConfig = loadOfflineModel(baseDir);
											saveToSession(sessionId, session, username, baseConfig.base, baseConfig.model, modelId);
											
											// end request
											res.status(204);	// no content
											res.end();
										} catch (e1) {
											log.error(e1, 'Failed to open base!');
											res.status(500);	// internal server error
											res.end();
										}
									})
								}
							} catch (e) {
								log.error(e, 'Failed to create the store!');
								res.status(500);	// internal server error
								res.end();
							}
						}
					});
				} catch (e) {
					log.error(e, 'Exception while uploading a new dataset!');
					res.status(500);	// internal server error
					res.end();
				}
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
				});
			}
		});
	});
	
	app.get(API_PATH + '/selectDataset', upload.single('dataset'), function (req, res, next) {
		var session = req.session;
		var username = req.query.email;
		
		db.fetchUserModels(username, function (e, models) {
			if (e != null) {
				log.error(e, 'Failed to fetch models for user: %s', username);
				res.status(500);	// internal server error
				res.end();
				return;
			}
			
			session.username = username;
			res.send(models);
			res.end();
		});
	});
	
	app.post(API_PATH + '/selectDataset', function (req, res) {
		var session = req.session;
		var sessionId = req.sessionID;
		var username = session.username;
		
		var modelId = req.body.modelId;
		
		log.info('User %s selected model %s ...', username, modelId);
		
		db.fetchModel(modelId, function (e, modelConfig) {
			if (e != null) {
				log.error(e, 'Failed to get base info for user: %s', username);
				res.status(500);	// internal server error
				res.end();
				return;
			}
			
			try {
				if (modelConfig.is_realtime == 1) {
					var isActive = modelConfig.is_active == 1;
					if (isActive) {
						if (log.debug())
							log.debug('Adding an already active model to the session ...');
						
						var model = modelStore.getModel(modelId);
						saveToSession(sessionId, session, username, base, model, modelId);
					} else {
						if (log.debug())
							log.debug('Adding an inactive model to the session ...');
						
						var model = loadOnlineModel(modelConfig.model_file);
						saveToSession(sessionId, session, username, base, model, modelId);
					}
				} else {
//					closeBase(session);		// TODO bug in qminer, have to do this before opening a new base
					var baseConfig = loadOfflineModel(modelConfig.base_dir);
					saveToSession(sessionId, session, username, baseConfig.base, baseConfig.model, modelId);
				}
				
				res.status(204);	// no content
				res.end();
			} catch (e1) {
				log.error(e1, 'Failed to initialize model!');
				res.status(500);	// internal server error
				res.end();
			}
		});
	});
}

function initServerApi() {
	log.info('Initializing general server REST API ...');
	
	{
		log.info('Registering exit service ...');
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
	}
	
	{
		log.info('Registering push data service ...');
		
		var imported = 0;
		var printInterval = 10000;
		
		app.post(DATA_PATH + '/push', function (req, resp) {
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
		log.info('Registering count active models service ...');
		app.get(API_PATH + '/countActiveModels', function (req, res) {
			log.debug('Fetching the number of active models from the DB ...');
			
			db.countActiveModels(function (e, result) {
				if (e != null) {
					log.error(e, 'Failed to count the number of active models!');
					res.status(500);	// internal server error
					res.end();
				}
				
				res.send(result);
				res.end();
			});
		});
	}
	
	{
		log.info('Registering activate model service ...');
		
		app.post(API_PATH + '/activateModel', function (req, res) {
			try {
				var session = req.session;
				var model = getModel(req.sessionID, session);
				
				var activate = req.body.activate == 'true';
				
				if (activate == null) throw new Error('Missing parameter activate!');
				if (model.getId() == null) throw new Error('WTF?! Tried to activate a model that doesn\'t have an ID!');
				
				if (log.info())
					log.info('Activating model %s: ' + activate, model.getId());
				
				db.activateModel({modelId: model.getId(), activate: activate}, function (e1) {
					if (e1 != null) {
						log.error(e1, 'Failed to activate model %s!', modelId);
						res.status(500);
						res.end();
					}
					
					try {
						if (activate)
							activateModel(model);
						else
							deactivateModel(model);
						
						res.status(204);
						res.end();
					} catch (e2) {
						log.error('Model activated in the DB, but failed to activate it in the app!');
						res.status(500);
						res.end();
					}
				});
			} catch (e) {
				log.error(e, 'Failed to process raw measurement!');
				res.status(500);
				res.end();
			}
		});
	}
	
	{
		log.info('Registering model mode service ...');
		app.get(API_PATH + '/modelMode', function (req, res) {
			log.debug('Fetching model mode from the db DB ...');
			
			var model = getModel(req.sessionID, req.session);
			
			db.fetchModel(model.getId(), function (e, modelConfig) {
				if (e != null) {
					log.error(e, 'Failed to get model mode from the DB!');
					res.status(500);	// internal server error
					res.end();
					return;
				}
				
				res.send({
					isRealtime: modelConfig.is_realtime == 1,
					isActive: modelConfig.is_active == 1
				});
				res.end();
			});
		});
	}
}

function initConfigRestApi() {
	log.info('Initializing configuration REST API ...');
	
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
			log.error(e, 'Failed to query configuration!');
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
			log.error(e, 'Failed to set configuration!');
			res.status(500);	// internal server error
			res.end();
		}
	});
}

function initPipelineHandlers() {
	log.info('Initializing pipeline callbacks ...');
	
	pipeline.onValue(function (val) {
		if (log.trace())
			log.trace('Inserting value into StreamStories ...');
		
		if (config.USE_CASE == config.USE_CASE_MHWIRTH && val.temp_ambient == null) {	// TODO remove this
			log.warn('Not sending ambient temperature!');
			throw new Error('Not sending ambient temperature!');
		}
		modelStore.updateModels(val);
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
			log.info('Creating coefficient callback ...');
			pipeline.onCoefficient(function (opts) {
				var pdf = null;
				
				var zscore = opts.zScore;
				
				if (zscore >= 5) {
					pdf = {
						type: 'exponential',
						lambda: intensConfig.deviation_extreme_lambda		// degradation occurs once per month
					};
				} else if (zscore >= 4) {					// major deviation
					pdf = {
						type: 'exponential',
						lambda: intensConfig.deviation_major_lambda			// degradation occurs once per two months
					};
				} else if (zscore >= 3) {					// significant deviation
					pdf = {
						type: 'exponential',
						lambda: intensConfig.deviation_significant_lambda	// degradation occurs once per year
					};
				} else if (zscore >= 2) {					// minor deviation
					pdf = {
						type: 'exponential',
						lambda: intensConfig.deviation_minor_lambda			// degradation occurs once per two years
					};
				}
				
				modelStore.distributeMsg(JSON.stringify({
					type: 'coeff',
					content: opts
				}));
				
				if (pdf != null) {
					var msg = {
						type: 'prediction',
						content: {
							time: opts.time,
							eventId: opts.eventId,
							pdf: pdf
						}
					};
					
					var msgStr = JSON.stringify(msg);
					
					var brokerMsg = transform.genExpPrediction(pdf.lambda, 'month', opts.time);
					broker.send(broker.PREDICTION_PRODUCER_TOPIC, JSON.stringify(brokerMsg));
					modelStore.distributeMsg(msgStr);
				}
			});
		});
	}
}

function initBroker() {
	broker.init();
	
	log.info('Initializing broker callbacks ...');
	
	var imported = 0;
	var printInterval = 100;
	
	var lastCepTime = 0;
	
	broker.onMessage(function (msg) {		
		if (msg.type == 'raw') {
			if (++imported % printInterval == 0 && log.trace())
				log.trace('Imported %d values ...', imported);
			var payload = msg.payload;
			
			//========================================================
			// TODO remove this
//			log.debug('Received mesage: %s', JSON.stringify(payload));
			payload = {
				sensorId: 'montrac',
				eventProperties: {
					location: msg.payload.location,
					event: msg.payload.event,
					shuttle: msg.payload.shuttle,
					leftPiece: msg.payload.leftPiece,
					rightPiece: msg.payload.rightPiece
				}
			};
			
//			log.debug('Converted to %s', JSON.stringify(payload));
//			{"shuttle":405,"rightPiece":false,"variable_timestamp":1441847832000,"variable_type":"montrac","location":"SW2 (MAIN)","event":"Start","leftPiece":false}
			//========================================================
			
			addRawMeasurement(payload);
		} else if (msg.type == 'cep') {
			if (log.trace())
				log.trace('received CEP message: %s', JSON.stringify(msg));
			
			var event = msg.payload;			
			var val = transform.parseDerivedEvent(event);

			var timestamp = event.timestamp;
			
			if (isNaN(timestamp)) {
				log.warn('CEP sent NaN time %s', JSON.stringify(val));
				return;
			} 
			else if (timestamp <= lastCepTime) {
				log.warn('CEP sent invalid time %d <= %d: %s', timestamp, lastCepTime, JSON.stringify(val));
				return;
			}
			
			base.store(fields.OA_IN_STORE).push(val);
			lastCepTime = timestamp;
		} else {
			log.warn('Invalid message type: %s', msg.type);
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
		
		if (log.info())
			log.info('There are %d active models on startup ...', models.length);
		
		for (var i = 0; i < models.length; i++) {
			var modelConfig = models[i];
			
			try {
				if (log.info())
					log.info('Initializing model %s ...', JSON.stringify(modelConfig));
				
				var model = loadOnlineModel(modelConfig.model_file);
				activateModel(model);
			} catch (e1) {
				log.error(e1, 'Exception while initializing model %s', JSON.stringify(model));
			}
		}
	});
}

function getHackedSessionStore() {
	var store =  new SessionStore();
	store.on('preDestroy', function (sessionId, session) {
		cleanUpSession(sessionId, session);
		if (sessionId in fileBuffH)
			delete fileBuffH[sessionId];
	});
	return store;
}

function prepPage(page) {
	return function (req, res) {
		var session = req.session;
		
		var opts = {
			isOnline: session.model.isOnline()
		};
		
		res.render(page, opts);
	}
}

function initServer(sessionStore, parseCookie) {
	log.info('Initializing web server ...');

	var sess = session({ 
		unset: 'destroy',
		store: sessionStore,
		cookie: { maxAge: 1000*60*60*24 },	// the cookie will last for 1 day
		resave: false,
		saveUninitialized: true
	});
	
	function excludeDir(dir, middleware) {
		return function (req, res, next) {
			var path = req.path;
			if (log.trace())
				log.trace('Request to path %s', path);
			
			if (path.indexOf(dir) == 0) {
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
	
	app.set('view engine', 'ejs');
	app.use(parseCookie);
	app.use(excludeDir(DATA_PATH, sess));
	// automatically parse body on the API path
	app.use(API_PATH + '/', bodyParser.urlencoded({ extended: false }));
	app.use(API_PATH + '/', bodyParser.json());
	app.use(DATA_PATH + '/', bodyParser.json());
	
	// when a session expires, redirect to index
	app.use('/ui.html', function (req, res, next) {
		var model = getModel(req.sessionID, req.session);
		// check if we need to redirect to the index page
		if (model == null) {
			log.info('Session data missing, redirecting to index ...');
			res.redirect('.');
		} else {
			next();
		}
	});
	
	initServerApi();
	initStreamStoryRestApi();
	initConfigRestApi();
	initDataUploadApi();
	
//	app.get('/ui.html', prepPage('ui'));
	
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
				var model = getModel(sessionId, session);
				
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
		ws: ws,
		onAdd: function (model) {
			if (log.debug())
				log.debug('Model %s added to the model store, activating handlers ...', model.getId());
			
		},
		onRemove: function (model) {
			if (log.debug())
				log.debug('Model %s removed from the model store! Deactivating handlers ...', model.getId());
		}
	});
	
	loadActiveModels();
	initPipelineHandlers();
	initBroker();
	
	log.info('Done!');
};
