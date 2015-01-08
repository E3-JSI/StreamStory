var express = require('express');
var path = require('path');

var app = express();
var server;

exports.init = function () {
	console.log('Registering drilling services ...');
	
	{
		console.log('Registering exit service ...');
		
		// multilevel analysis
		app.get('/exit', function (req, resp) {
			try {
				console.log('Exiting qminer and closing server ...');
				
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
				console.log('Failed to query MHWirth multilevel visualization: ' + e);
				resp.setStatusCode(500);	// internal server error
			}
			
			resp.end();
		});
	}
	
	{
		console.log('Registering push data service ...');
		
		var imported = 0;
		var printInterval = 10000;
		app.post('/drilling/push', function (req, resp) {
			try {
				var batch = JSON.parse(req.body);
				
				for (var i = 0; i < batch.length; i++) {
					var instance = batch[i];
					
					var store = instance.store;
					var timestamp = instance.timestamp;
					var value = instance.value;
					
					if (++imported % printInterval == 0)
						console.log('Imported ' + imported + ' values ...');
					
					qm.store(store).add({
						time_ms: timestamp,
						time: new Date(timestamp).toISOString().split('Z')[0],
						value: value
					});
				}
				
				resp.status(204);
			} catch (e) {
				console.log('Failed to add records: ' + e);
				resp.setStatusCode(500);	// internal server error
			}

			resp.end();
		});
	}
	
	{
		console.log('Registering multilevel service at drilling/multilevel ...');
		
		// multilevel analysis
		app.get('/drilling/multilevel', function (req, resp) {
			try {
				console.log('Querying MHWirth multilevel model ...');
				resp.send(hmc.getModel().toJSON());
			} catch (e) {
				console.log('Failed to query MHWirth multilevel visualization: ' + e);
				resp.setStatusCode(500);	// internal server error
			}
			
			resp.end();
		});
	}
	
	{
		console.log('Registering transition model service ...');
		
		// multilevel analysis
		app.get('/drilling/transitionModel', function (req, resp) {
			try {
				var level = parseFloat(req.query.level);
				
				console.log('Fetching transition model for level: ' + level);
				
				resp.send(ctmcNew.getTransitionModel(level));
			} catch (e) {
				console.log('Failed to query MHWirth multilevel visualization: ' + e);
				resp.setStatusCode(500);	// internal server error
			}
			
			resp.end();
		});
	}
	
	// serve static files at www
	{
		console.log('Initializing web server ...');
		
		var staticDir = path.join(__dirname, WWW_DIR);
		console.log('Using static directory: ' + staticDir);
		
		app.use('/www', express.static(staticDir));
	}
	
	server = app.listen(SERVER_PORT);
	console.log('Server running at http://localhost:' + SERVER_PORT + '/');
};