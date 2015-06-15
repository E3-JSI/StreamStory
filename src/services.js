var express = require('express');
var bodyParser = require("body-parser");
var path = require('path');
var WebSocket = require('ws');
var utils = require('./utils.js');
var broker = require('./broker.js');
var config = require('../config.js');
var fields = require('../fields.js');

var UI_PATH = '/';
var API_PATH = '/api';
var WS_PATH = '/ws';

var app = express();

var server;
var ws;

var hmc;
var base;

var counts = {};
var totalCounts = 0;

var lastCepTime = 0;
var lastRawTime = 0;

function addRawMeasurement(val) {
//	try {
		var storeNm = utils.storeFromTag(val.variable_type);
		
		if (!(storeNm in counts))
			counts[storeNm] = 0;
		counts[storeNm]++;
		if (totalCounts++ % 10000 == 0)
			log.debug('Counts: %s', JSON.stringify(counts));
		
		if (val.variable_timestamp < lastRawTime)
			throw 'Invalid time! Current: ' + val.variable_timestamp + ', prev: ' + lastRawTime;
		
		var insertVal = {
			time_ms: val.variable_timestamp,
			time: utils.dateToQmDate(new Date(val.variable_timestamp)),
			value: val.value
		};
	
		base.store(storeNm).push(insertVal);
		lastRawTime = val.variable_timestamp;
//	} catch (e) {
//		log.error(e, 'Failed to insert raw measurement into store %s: %s, %s!', storeNm, JSON.stringify(val), JSON.stringify(insertVal));
//	}
}

function addCepAnnotated(val) {
//	var internal = {};
//	
	val.time = utils.dateToQmDate(new Date(val.time));
//	for (var key in val) {
//		if (key == 'time') continue;
//		internal[utils.storeFromTag(key)] = val[key];
//	}
	
//	if (log.debug()) 
//		log.debug('Storing CEP message: %s', JSON.stringify(val));
	if (isNaN(val.time)) {
		log.warn('CEP sent NaN time %s', JSON.stringify(val));
	}
	else if (val.time <= lastCepTime) {
		log.warn('CEP sent invalid time %d', val.time);
		return;
	}
	
	base.store(fields.OA_IN_STORE).push(val);
	
	lastCepTime = val.time;
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
				hmc.save(config.STREAM_STORY_FNAME);
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
						
			for (var i = 0; i < batch.length; i++) {
				var instance = batch[i];
				
				if (++imported % printInterval == 0 && log.trace())
					log.trace('Imported %d values ...', imported);
				
				addRawMeasurement(instance);
			}
			
			resp.status(204);
			resp.end();
		});
	}
	
	{
		log.info('Registering set parameter service ...');
		
		app.post(API_PATH + '/param', function (req, resp) {
			try {
				var paramName = req.body.paramName;
				var paramVal = parseFloat(req.body.paramVal);
				
				var paramObj = {};
				paramObj[paramName] = paramVal;
				
				hmc.getModel().setParams(paramObj);
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
				
				var val = hmc.getModel().getParam(param);
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
				log.debug('Querying MHWirth multilevel model ...');
				resp.send(hmc.getVizState());
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		// multilevel analysis
		app.get(API_PATH + '/features', function (req, resp) {
			try {
				log.debug('Fetching all the features ...');
				
				var ftrNames = hmc.getFtrNames();
				
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
				
				if (log.debug())
					log.debug('Fetching transition model for level: %.3f', level);
				
				resp.send(hmc.getModel().getTransitionModel(level));
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
				if (log.info())
					log.info('Fetching current state for level ' + level);
				
				var result = hmc.currState(level);
				
				if (log.info())
					log.info("Current state: %s", JSON.stringify(result));
				
				resp.send(hmc.currState(level));
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
				
				if (req.query.time == null) {
					log.debug('Fetching future states currState: %d, height: %d', currState, level);
					resp.send(hmc.futureStates(level, currState));
				} else {
					var time = parseFloat(req.query.time);
					log.debug('Fetching future states, currState: %d, level: %d, time: %d', currState, level, time);
					resp.send(hmc.futureStates(level, currState, time));
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
				
				if (req.query.time == null) {
					log.debug('Fetching past states currState: %d, height: %d', currState, level);
					resp.send(hmc.pastStates(level, currState));
				} else {
					var time = parseFloat(req.query.time);
					log.debug('Fetching past states, currState: %d, level: %d, time: %d', currState, level, time);
					resp.send(hmc.pastStates(level, currState, time));
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
				
				resp.send(hmc.getModel().probsOverTime(height, state, startTm, endTm, deltaTm));
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
		
		app.get(API_PATH + '/history', function (req, resp) {
			try {
				var level = parseFloat(req.query.level);
				
				if (log.debug())
					log.debug('Fetching history for level %d', level);
				
				resp.send(hmc.getModel().histStates(level));
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
				
				if (log.debug())
					log.debug('Fetching details for state: %d', stateId);
				
				resp.send(hmc.stateDetails(stateId, height));
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
				
				if (log.debug())
					log.debug('Fetching histogram for state %d, feature %d ...', stateId, ftrIdx);
				
				resp.send(hmc.histogram(stateId, ftrIdx));
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
				
				if (log.debug())
					log.debug('Fetching distribution for feature "%d" for height %d ...', ftrIdx, height);
				
				resp.send(hmc.getFtrDist(height, ftrIdx));
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
				
				if (log.info()) 
					log.info('Setting name of state %d to %s ...', stateId, stateNm);
				
				hmc.getModel().setStateName(stateId, stateNm);
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
				
				if (log.info()) 
					log.info('Setting target state: %d, isTarget: ' + isTarget, stateId);
				
				
				hmc.getModel().setTarget(stateId, height, isTarget);
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
				
				if (log.info()) 
					log.info('Changing control %d by factor %d ...', ftrIdx, factor);
				
				hmc.setControl(ftrIdx, factor);
				resp.send(hmc.getVizState());
			} catch (e) {
				log.error(e, 'Failed to control %d by factor %d', ftrIdx, factor);
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
	}
}

function initServer() {
	log.info('Initializing web server ...');

	// automatically parse body on the API path
	app.use(API_PATH + '/', bodyParser.urlencoded({ extended: false }));
	app.use(API_PATH + '/', bodyParser.json());
		
	initRestApi();
	
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

function initHandlers() {
	log.info('Registering state changed callback ...');
	
	if (hmc == null) return;
	
	hmc.onStateChanged(function (states) {
		if (log.debug())
			log.debug('State changed: %s', JSON.stringify(states));
		
		var msg = JSON.stringify({
			type: 'stateChanged',
			content: states
		});
		
		ws.distribute(msg);
	});
	
	hmc.onAnomaly(function (desc) {
		if (log.info())
			log.info('Anomaly detected: %s', desc);
		
		var msg = JSON.stringify({
			type: 'anomaly',
			content: desc
		});
		
		ws.distribute(msg);
	});
	
	hmc.onOutlier(function (ftrV) {
		if (log.info())
			log.info('Outlier detected!');
		
		var msg = JSON.stringify({
			type: 'outlier',
			content: ftrV
		})
		
		ws.distribute(msg);
	});
	
	hmc.onPrediction(function (date, currState, targetState, prob, probV, timeV) {
		log.info('Sending prediction, with PDF length: %d', probV.length);
		
		var msg = {
			type: 'statePrediction',
			content: {
				time: date.getTime(),
				currState: currState,
				targetState: targetState,
				probability: prob,
				pdf: {
					probV: probV,
					timeV: timeV
				}
			}
		};
		
		var msgStr = JSON.stringify(msg);
		broker.send(broker.PREDICTION_PRODUCER_TOPIC, msgStr);
		ws.distribute(msgStr);
	});
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

exports.init = function (hmc1, base1) {
	log.info('Initializing server ...');
	
	hmc = hmc1;
	base = base1;
	
	// serve static files at www
	initServer();
	initHandlers();
	initBroker();
	
	log.info('Done!');
};
