var express = require('express');
var path = require('path');
var WebSocket = require('ws');

var app = express();

var server;
var ws;

function initServer() {
	log.info('Initializing web server ...');
	
	var staticDir = path.join(__dirname, WWW_DIR);
	log.info('Using static directory: %s', staticDir);
	
	app.use('/www', express.static(staticDir));
	
	server = app.listen(SERVER_PORT);
	log.info('Server running at http://localhost:%d', SERVER_PORT);
}

var WebSocketWrapper = function () {
	log.info('Creating web socket server ...');
	
	var sockets = {};
	
	var WebSocketServer = WebSocket.Server;
	var wss = new WebSocketServer({
		server: server,
		path: '/websocket'
	});

	function closeClient(id) {
		if (log.debug())
			log.debug("Closing client %")
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
	
	var socketId = 0;
	wss.on('connection', function (socket) {
		var id = socketId++;
		
		log.info('New websocket connected id: %d ...', id);
		
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
		
		sockets[id] = { client: socket, gotPong: true };
	});
	
	// ping clients periodically
	function ping() {
		removeIdle();
		
		if (log.trace())
			log.trace('Pinging %d clients ...', Object.keys(sockets).length);
		
		for (var id in sockets) {
			sockets[id].client.ping();
		}
		
		setTimeout(ping, PING_INTERVAL);
	}
	ping();
	
	return {
		distribute: function (msg) {
			if (log.debug())
				log.debug('Distributing message: %s', msg);
			
			for (var clientId in sockets) {
				sockets[clientId].client.send(msg);
			}
		}
	}
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
					log.debug('Fetching future states, currState: ' + currState + ', level: ' + level + ', time: ' + time);
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
	ws = WebSocketWrapper();
	initHandlers();
	
	log.info('Done!');
};