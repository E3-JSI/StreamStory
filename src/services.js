var express = require('express');
var path = require('path');
var WebSocket = require('ws');

var UI_PATH = '/';
var API_PATH = '/api';
var WS_PATH = '/ws';

var app = express();

var server;
var ws;

var WebSocketWrapper = function () {
	log.info('Creating web socket server ...');
	
	var sockets = {};
	var socketId = 0;
	
	var wss = new WebSocket.Server({
		server: server,
		path: WS_PATH
	});
	
	function delSocket(id) {
		if (id == null) return;
		
		try {
			if (id in sockets)
				delete sockets[id];
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
		setTimeout(ping, PING_INTERVAL);
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
		}
	}
}

function initServer() {
	log.info('Initializing web server ...');

	app.use(UI_PATH, express.static(path.join(__dirname, WWW_DIR)));
	
	server = app.listen(SERVER_PORT);
	ws = WebSocketWrapper();
	
	log.info('================================================');
	log.info('Server running at http://localhost:%d', SERVER_PORT);
	log.info('Serving UI at: %s', UI_PATH);
	log.info('Serving API at: %s', API_PATH);
	log.info('Web socket listening at: %s', WS_PATH);
	log.info('================================================');
}

function initHandlers() {
	log.info('Registering state changed callback ...');
	
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
}

exports.init = function () {
	log.info('Registering drilling services ...');
	
	{
		log.info('Registering exit service ...');
		
		// multilevel analysis
		app.get(API_PATH + '/exit', function (req, resp) {
			try {
				log.debug('Exiting qminer and closing server ...');
				
				wss.close();
				closeBase();
				setTimeout(function () {
					log.info('Closing server ...');
		            server.close(function () {	// TODO doesn't work 
		            	log.info('Server closed!');
		            	process.exit();
		            });
		        }, 1000);
				
				resp.status(204);
			} catch (e) {
				log.error(e, 'Failed to query MHWirth multilevel visualization!');
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
			var body = '';
			
			req.on('data', function (data) {
				body += data;
			})
			req.on('end', function () {
				var batch = JSON.parse(body);
				
				for (var i = 0; i < batch.length; i++) {
					var instance = batch[i];
					
					var store = instance.store;
					var timestamp = instance.timestamp;
					var value = instance.value;
					
					if (++imported % printInterval == 0 && log.debug())
						log.debug('Imported %d values ...', imported);
					
					base.store(store).add({
						time_ms: timestamp,
						time: new Date(timestamp).toISOString().split('Z')[0],
						value: value
					});
				}
				
				resp.status(204);
				resp.end();
			});
			
			req.on('error', function (e) {
				log.error(e, 'Error while receiving data!');
				resp.status(500);	// internal server error
				resp.end();
			});
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
		
		// multilevel analysis
		app.get(API_PATH + '/details', function (req, resp) {
			try {
				var stateId = parseInt(req.query.stateId);
				var level = parseFloat(req.query.level);
				
				if (log.debug())
					log.debug('Fetching details for state: %d', stateId);
				
				resp.send(hmc.stateDetails(stateId, level));
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
	}
	
	// serve static files at www
	initServer();
	initHandlers();
	
	log.info('Done!');
};