var express = require('express');
var path = require('path');

var app = express();
var server;

exports.init = function () {
	log.info('Registering drilling services ...');
	
	{
		log.info('Registering exit service ...');
		
		// multilevel analysis
		app.get('/exit', function (req, resp) {
			try {
				log.debug('Exiting qminer and closing server ...');
				
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
			req.on('error', function (e) {
				log.error(e, 'Error while receiving data!');
				resp.status(500);	// internal server error
				resp.end();
			});
			
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
		});
	}
	
	{
		log.info('Registering multilevel service at drilling/multilevel ...');
		
		// multilevel analysis
		app.get('/drilling/multilevel', function (req, resp) {
			try {
				console.log('Querying MHWirth multilevel model ...');
				resp.send(hmc.getModel().toJSON());
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
				var time = parseFloat(req.query.time);
				
				log.debug('Fetching future states, currState: ' + currState + ', level: ' + level + ', time: ' + time);
				
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
	
	{
		log.info('Registering state changed callback ...');
		
		hmc.onStateChanged(function (currStates) {
			log.info('State changed: ' + currStates);
		});
	}
	
	// serve static files at www
	{
		log.info('Initializing web server ...');
		
		var staticDir = path.join(__dirname, WWW_DIR);
		log.info('Using static directory: %s', staticDir);
		
		app.use('/www', express.static(staticDir));
	}
	
	server = app.listen(SERVER_PORT);
	log.info('Server running at http://localhost:%d', SERVER_PORT);
};