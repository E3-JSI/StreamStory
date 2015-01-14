var express = require('express');
var path = require('path');
var WebSocket = require('ws');

var app = express();

var server;
var ws;

var WebSocketWrapper = function () {
	log.info('Creating web socket server ...');
	
	var sockets = {};
	var socketId = 0;
	
	var wss = new WebSocket.Server({
		server: server,
		path: '/websocket'
	});

	function closeClient(id) {
		if (log.debug())
			log.debug("Closing client %d", id);
		sockets[id].client.close();
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
			delete sockets[id];
		});
	});
	
	// ping clients periodically
	function ping() {
		try {
			removeIdle();
			
			if (log.trace())
				log.trace('Pinging %d clients ...', Object.keys(sockets).length);
			
			for (var id in sockets) {
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
			
			for (var clientId in sockets) {
				var socket = sockets[clientId].client;
				
				if (!socket.readyState == WebSocket.OPEN) {
					log.warn('Socket is not open ' + socket.readyState + ' closing ...');
					closeClient(clientId);
					continue;
				}
				
				sockets[clientId].client.send(msg);
			}
		}
	}
}

function initServer() {
	log.info('Initializing web server ...');
	
	var staticDir = path.join(__dirname, WWW_DIR);
	log.info('Using static directory: %s', staticDir);
	
	app.use('/ui', express.static(staticDir));
	
	server = app.listen(SERVER_PORT);
	ws = WebSocketWrapper();
	
	log.info('Server running at http://localhost:%d', SERVER_PORT);
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
}

exports.init = function () {
	log.info('Registering drilling services ...');
	
	{
		log.info('Registering exit service ...');
		
		// multilevel analysis
		app.get('/exit', function (req, resp) {
			try {
				log.debug('Exiting qminer and closing server ...');
				
				wss.close();
				closeBase();
				setTimeout(function () {
					console.log('Closing server ...');
		            server.close(function () {	// TODO doesn't work 
		            	console.log('Server closed!');
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
		
		app.post('/drilling/push', function (req, resp) {
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
		app.get('/drilling/multilevel', function (req, resp) {
			try {
				log.debug('Querying MHWirth multilevel model ...');
				resp.send(hmc.getVizState());
			} catch (e) {
				console.log(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
	}
	
	{
		log.info('Registering transition model service ...');
		
		// multilevel analysis
		app.get('/drilling/transitionModel', function (req, resp) {
			try {
				var level = parseFloat(req.query.level);
				
				if (log.debug())
					log.debug('Fetching transition model for level: %.3f', level);
				
				resp.send(ctmcNew.getTransitionModel(level));
			} catch (e) {
				console.log(e, 'Failed to query MHWirth multilevel visualization!');
				resp.status(500);	// internal server error
			}
			
			resp.end();
		});
	}
	
	{
		log.info('Registering future states service ...');
		
		// multilevel analysis
		app.get('/drilling/futureStates', function (req, resp) {
			try {
				var level = parseFloat(req.query.level);
				var currState = parseInt(req.query.state);
				var time = req.query.time != null ? parseFloat(req.query.time) : null;
				
				if (time == null) {
					log.debug('Fetching future states currState: %d, height: %.3f', currState, level);
				} else {
					log.debug('Fetching future states, currState: %d, level: %d, time: %.3f', currState, level, time);
				}
				
				resp.send(hmc.futureStates(level, currState, time));
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
		app.get('/drilling/details', function (req, resp) {
			try {
				var stateId = parseInt(req.query.state);
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
	}
	
	// serve static files at www
	initServer();
	initHandlers();
	
	log.info('Done!');
};