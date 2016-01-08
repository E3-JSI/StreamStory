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
var LOGIN_PATH = '/login';
var API_PATH = '/api';
var DATA_PATH = '/data';
var WS_PATH = '/ws';

var LONG_REQUEST_TIMEOUT = 1000*60*60*24;

var app = express();

var fileBuffH = {};	// if I store the file buffer directly into the session, the request takes forever to complete

var titles = {
	'': 'Index',
	'index.html': 'Index',
	'login.html': 'Login',
	'register.html': 'Register',
	'resetpassword.html': 'Reset Password',
	'dashboard.html': 'Dashboard',
	'profile.html': 'Profile',
	'ui.html': 'View Model',
	'profile.html': 'Profile'
}

var base;
var db;
var pipeline;
var modelStore;

var counts = {};
var storeLastTm = {};
var totalCounts = 0;

var lastRawTime = 0;

var intensConfig = {};

function activateModel(model) {
	try {
		if (log.info())
			log.info('Activating an online model, ID: %s ...', model.getId());
		
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

//=====================================================
// SESSION
//=====================================================

function getModel(sessionId, session) {
	return session.model;
}

function getModelFile(session) {
	return session.modelFile;
}

function cleanUpSessionModel(sessionId, session) {
	if (log.debug())
		log.debug('Cleaning up session %s ...', sessionId);
	
	closeBase(session);
	
	delete session.base;
	delete session.model;
	delete session.modelId;
	delete session.modelFile;
}

function cleanUpSession(sessionId, session) {
	cleanUpSessionModel(sessionId, session);
	delete session.username;
}

function loginUser(session, username) {
	session.username = username;
}

function isLoggedIn(session) {
	return session.username != null;
}

function saveToSession(sessionId, session, userBase, model, modelId, fname) {
	if (session.base != null)
		cleanUpSessionModel(sessionId, session);
	
	if (log.debug())
		log.debug('Saving new data to session %s ...', sessionId);
	
	if (userBase.isClosed())
		throw new Error('Tried to save a closed base to session!');
	
	session.base = userBase;
	session.model = model;
	session.modelId = modelId;
	session.modelFile = fname;
	
	if (log.debug())
		log.debug('Saved to session!');
}

//=====================================================
// UTILITY METHODS
//=====================================================

function getRequestedPage(req) {
	return req.path.split('/').pop();
}

function getRequestedPath(req) {
	var spl = req.path.split('/');
	spl.pop();
	return spl.pop();
}

function redirect(res, page) {
	if (log.debug())
		log.debug('Redirecting to %s ...', page);
	res.redirect(page);
}

//=====================================================
// NON-SUCCESSFUL RESPONSES
//=====================================================

function handleNoPermission(req, res) {
	if (log.debug())
		log.debug('No permission, blocking page!');
	
	res.status(404);	// not found
	res.send('Cannot GET ' + req.path);
	res.end();
}

function handleBadRequest(req, res, msg) {
	if (log.debug())
		log.debug('Bad request, blocking page!');
	
	res.status(404);	// bad request
	res.send(msg != null ? msg : ('Bad request ' + req.path));
	res.end();
}

function handleServerError(e, req, res) {
	log.error(e, 'Exception while processing request!');
	res.status(500);	// internal server error
	res.send(e.message);
	res.end();
}

function handleBadInput(res, msg) {
	res.status(400);	// bad request
	res.send(msg);
	res.end();
}

function addRawMeasurement(val) {
	if (log.trace())
		log.trace('Received raw measurememnt %s ...', JSON.stringify(val));
	
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
		

		if (log.trace())
			log.trace('Inserting raw measurement %s', JSON.stringify(insertVal));
		
		pipeline.insertRaw(storeNm, insertVal);
		storeLastTm[storeNm] = timestamp;
		lastRawTime = timestamp;
	}
}

function initStreamStoryHandlers(model, enable) {
	if (model == null) {
		log.warn('StreamStory is NULL, cannot register callbacks ...');
		return;
	}
	
	log.info('Registering StreamStory callbacks for model %s ...', model.getId());
	
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
				
				db.getUndesiredEventId(model.getId(), targetState, function (e, eventId) {
					if (e != null) {
						log.error(e, 'Failed to fetch event ID from the database!');
						return;
					}
					
					if (currStateNm == null || currStateNm.length == 0) currStateNm = currState;
					if (targetStateNm == null || targetStateNm.length == 0) targetStateNm = targetState;
					
					var uiMsg = {
						type: 'statePrediction',
						content: {
							time: date.getTime(),
							currState: currStateNm,
							targetState: targetStateNm,
							eventId: eventId,
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
						eventId,
						timeV,
						probV,
						model.getModel().getTimeUnit(),
						metadata
					);
					
					broker.send(broker.PREDICTION_PRODUCER_TOPIC, JSON.stringify(brokerMsg));
					modelStore.sendMsg(model.getId(), JSON.stringify(uiMsg));
				});
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

function initLoginRestApi() {
	log.info('Initializing Login REST services ...');
	
	app.post(LOGIN_PATH + '/login', function (req, res) {
		try {
			var session = req.session;
			
			var username = req.body.email;
			var password = req.body.password;
			
			if (log.debug())
				log.debug('Loggin in user: %s', username);
			
			if (username == null || username == '') {
				session.warning = 'Email missing!';
				redirect(res, '../login.html');
				return;
			}
			
			if (password == null || password == '') {
				session.warning = 'Password missing!';
				redirect(res, '../login.html');
				return;
			}
			
			db.userExists(username, function (e, exists) {
				if (e != null) {
					log.error(e, 'Exception while checking if user exists!');
					handleServerError(e, req, res);
					return;
				}
				
				if (!exists) {
					session.warning = 'Invalid email or password!';
					redirect(res, '../login.html');
					return;
				}
				
				db.fetchUserPassword(username, function (e1, storedHash) {
					if (e1 != null) {
						log.error(e1, 'Exception while checking if user exists!');
						handleServerError(e1, req, res);
						return;
					}
					
					var hash = utils.hashPassword(password);
					
					if (hash != storedHash) {
						session.warning = 'Invalid email or password!';
						redirect(res, '../login.html');
						return;
					} else {
						loginUser(session, username);
						redirect(res, '../dashboard.html');
					}
				});
			});
		} catch (e) {
			handleServerError(e, req, res);
		}
	});
	
	app.post(LOGIN_PATH + '/register', function (req, res) {
		try {
			var session = req.session;
			
			var username = req.body.email;
			var password = req.body.password;
			var password1 = req.body.password1;
			
			if (log.debug())
				log.debug('Registering user: %s', username);
			
			if (username == null || username == '') {
				session.warning = 'Email missing!';
				redirect(res, '../register.html');
				return;
			}
			
			if (password == null || password == '') {
				session.warning = 'Password missing!';
				redirect(res, '../register.html');
				return;
			}
			
			if (password.length < 4) {
				session.warning = 'The password must be at least 6 characters long!';
				redirect(res, '../register.html');
				return;
			}
			
			if (password1 == null || password1 == '') {
				session.warning = 'Please repeat password!';
				redirect(res, '../register.html');
				return;
			}
			
			if (password != password1) {
				session.warning = 'Passwords don\'t match!';
				redirect(res, '../register.html');
				return;
			}
			
			db.userExists(username, function (e, exists) {
				if (e != null) {
					log.error(e, 'Exception while checking if user exists!');
					handleServerError(e, req, res);
					return;
				}
				
				if (exists) {
					session.warning = 'Email "' + username + '" already taken!';
					redirect(res, '../register.html');
					return;
				} else {
					var hash = utils.hashPassword(password);
					db.createUser(username, hash, function (e1) {
						if (e1 != null) {
							log.error(e1, 'Exception while creating a new user!');
							handleServerError(e1, req, res);
							return;
						}
						
						loginUser(session, username);
						redirect(res, '../dashboard.html');
					});
				}
			});
		} catch (e) {
			handleServerError(e, req, res);
		}
	});
	
	app.post(LOGIN_PATH + '/resetPassword', function (req, res) {
		try {
			var session = req.session;
			var email = req.body.email;
			
			var password = utils.genPassword();
			var hash = utils.hashPassword(password);
			
			db.userExists(email, function (e, exists) {
				if (e != null) {
					handleServerError(e, req, res);
					return;
				}
				
				if (!exists) {
					session.error = 'Invalid email address!';
					redirect(res, '../resetpassword.html');
				} else {
					db.updatePassword(email, hash, function (e1) {
						if (e1 != null) {
							log.error(e, 'Failed to update password!');
							handleServerError(e1, req, res);
							return;
						}
						
						var opts = {
							password: password,
							email: email
						}
						
						utils.sendEmail(opts, function (e2) {
							if (e2 != null) {
								log.error(e2, 'Failed to send email!');
								handleServerError(e2, req, res);
								return;
							}
							
							session.message = 'Your new password has been sent to ' + email + '!';
							redirect(res, '../resetpassword.html');
						})
					});
				}
			})
		} catch (e) {
			log.error(e, 'Exception while resetting password!');
			handleServerError(e, req, res);
		}
	});
	
	app.post(API_PATH + '/changePassword', function (req, res) {
		try {
			var session = req.session;
			
			var email = session.username;
			
			var old = req.body.old;
			var password = req.body.newP;
			var password1 = req.body.repeat;
			
			if (password == null || password == '') {
				handleBadInput(res, 'Password missing!');
				return;
			}
			
			if (password.length < 4) {
				handleBadInput(res, 'The password must be at least 6 characters long!');
				return;
			}
			
			if (password1 == null || password1 == '') {
				handleBadInput(res, 'Please repeat password!');
				return;
			}
			
			if (password != password1) {
				handleBadInput(res, 'Passwords don\'t match!');
				return;
			}
			
			var hashOld = utils.hashPassword(old);
			
			db.fetchUserPassword(email, function (e, storedHash) {
				if (e != null) {
					log.error(e, 'Exception while fetching user password!');
					handleServerError(e, req, res);
					return;
				}
				
				if (hashOld != storedHash) {
					handleBadInput(res, 'Passwords don\'t match!');
					return;
				}
				
				var hash = utils.hashPassword(password);
				
				db.updatePassword(email, hash, function (e1) {
					if (e1 != null) {
						log.error(e, 'Failed to update password!');
						handleServerError(e1, req, res);
						return;
					}
					
					res.status(204);	// no content
	       			res.end();
				});
			});
		} catch (e) {
			log.error(e, 'Exception while changing password!');
			handleServerError(e, req, res);
		}
	});
	
	app.post(API_PATH + '/logout', function (req, res) {
		try {
			cleanUpSession(req.sessionID, req.session);
			redirect(res, '../login.html');
		} catch (e) {
			handleServerError(e, req, res);
		}
	});
}

function initStreamStoryRestApi() {
	log.info('Initializing StreamStory REST services ...');
	
	{
		log.info('Registering save service ...');
		app.post(API_PATH + '/save', function (req, res) {
			var session = req.session;
			var sessionId = req.sessionID;
			
			try {
				var model = getModel(sessionId, session);
				var positions = req.body.positions != null ? JSON.parse(req.body.positions) : null;
				
				if (model == null) {
					res.status(401);	// unauthorized
					res.end();
					return;
				}
				
				if (positions != null) {
					if (log.debug())
						log.debug('Saving node positions ...');
					model.getModel().setStateCoords(positions);
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
				var stateId = parseInt(req.query.stateId);
				var time = parseFloat(req.query.time);
				var height = parseFloat(req.query.level);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching probability distribution of states at height %d from state %d at time %d ...', height, stateId, time);
				
				res.send(model.getModel().probsAtTime(stateId, height, time));
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
		function fetchUndesiredEventId(mid, stateId, callback) {
			db.getUndesiredEventId(mid, stateId, function (e, eventId) {
				if (e != null) {
					log.error(e, 'Failed to fetch undesired event ID!');
					callback(e);
					return;
				}
				
				callback(undefined, eventId);
			});
		}
		
		log.info('Registering state details service ...');
		
		// state details
		app.get(API_PATH + '/stateDetails', function (req, res) {
			try {
				var stateId = parseInt(req.query.stateId);
				var height = parseFloat(req.query.level);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching details for state: %d', stateId);
				
				var details = model.stateDetails(stateId, height);
				
				fetchUndesiredEventId(model.getId(), stateId, function (e, eventId) {
					if (e != null) {
						handleServerError(e, req, res);
						return;
					}
					
					details.undesiredEventId = eventId;
					res.send(details);
					res.end();
				});
			} catch (e) {
				log.error(e, 'Failed to query state details!');
				andleServerError(e, req, res);
			}
		});
		
		app.get(API_PATH + '/modelDetails', function (req, res) {
			try {
				var modelId = parseInt(req.query.modelId);
				
				if (log.debug())
					log.debug('Fetching model details for model: %d', modelId);
				
				db.fetchModel(modelId, function (e, modelConfig) {
					if (e != null) {
						log.error(e, 'Failed to fetch model details!');
						handleServerError(e, req, res);
						return;
					}				

					res.send({
						mid: modelConfig.mid,
						name: modelConfig.name,
						dataset: modelConfig.dataset,
						isOnline: modelConfig.is_realtime == 1,
						creator: modelConfig.username,
						creationDate: modelConfig.date_created,
						isPublic: modelConfig.is_public == 1,
						isActive: modelConfig.is_active == 1
					});
					res.end();
				});
			} catch (e) {
				log.error(e, 'Failed to query state details!');
				andleServerError(e, req, res);
			}
		});
		
		app.get(API_PATH + '/targetProperties', function (req, res) {
			try {
				var stateId = parseInt(req.query.stateId);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching target details for state: %d', stateId);
				
				var isUndesired = model.getModel().isTarget(stateId);
				
				if (isUndesired) {
					fetchUndesiredEventId(model.getId(), stateId, function (e, eventId) {
						if (e != null) {
							handleServerError(e, req, res);
							return;
						}
						
						res.send({ isUndesired: isUndesired, eventId: eventId });
						res.end();
					});
				} else {
					res.send({ isUndesired: isUndesired });
					res.end();
				}
			} catch (e) {
				log.error(e, 'Failed to query target details!');
				handleServerError(e, req, res);
			}
		});
		
		// state explanation
		app.get(API_PATH + '/explanation', function (req, res) {
			try {
				var stateId = parseInt(req.query.stateId);
				
				var model = getModel(req.sessionID, req.session);
				
				if (log.debug())
					log.debug('Fetching explanation for state: %d', stateId);
				
				res.send(model.explainState(stateId));
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
				
				if (log.trace())
					log.trace('Fetching histogram for state %d, feature %d ...', stateId, ftrIdx);
				
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
				
				if (log.trace())
					log.trace('Fetching transition histogram for transition %d -> %d, feature %d ...', sourceId, targetId, ftrId);
				
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
		
		app.post(API_PATH + '/stateProperties', function (req, res) {
			var stateId, stateNm, isUndesired, eventId;
			
			try {
				var session = req.session;
				
				var model = getModel(req.sessionID, session);
				var mid = session.modelId;
				
				stateId = parseInt(req.body.id);
				stateNm = req.body.name;
				isUndesired = JSON.parse(req.body.isUndesired);
				eventId = req.body.eventId;
				
				if (isUndesired && (eventId == null || eventId == '')) {
					log.warn('The state is marked undesired, but the eventId is missing!');
					handleBadInput(res, 'Undesired event without an event id!');
					return;
				}
				
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
				
				if (log.info()) 
					log.info('Setting undesired state: %d, isUndesired: ' + isUndesired, stateId);

				model.getModel().setTarget(stateId, isUndesired);
				var fname = getModelFile(session);
				
				if (log.debug())
					log.debug('Saving model to file: %s', fname);
				
				model.save(fname);
				
				if (!isUndesired) {
					if (log.debug())
						log.debug('Clearing undesired event id ...');
					
					// clear the event id from the database
					db.clearUndesiredEventId(mid, stateId, function (e) {
						if (e != null) {
							log.error(e, 'Failed to clear undesired event ID!');
							handleServerError(e, req, res);
							return;
						}
						
						res.status(204);	// no content
						res.end();
					});
				} else {
					if (log.debug())
						log.debug('Setting undesired event id to "%s" ...', eventId);
						
					db.setUndesiredEventId(mid, stateId, eventId, function (e) {
						if (e != null) {
							log.error(e, 'Failed to set undesired event ID!');
							handleServerError(e, req, res);
							return;
						}
						
						res.status(204);	// no content
						res.end();
					});
				}
			} catch (e) {
				log.error(e, 'Failed to set name of state %d to %s', stateId, stateNm);
				res.status(500);	// internal server error
			}
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
			onEnd: function () {
				log.debug('Headers read, sending them back to the UI ...');
				if (log.trace()) 
					log.trace('Read headers: %s', JSON.stringify(headers));
				
				session.headerFields = headers;
				res.send(headers);
				res.end();
			},
			onError: function () {
				log.error(new Error(), 'Exception while reading CSV headers!');
				res.status(500);	// internal server error
				res.end();
			}
		});
	});
	
	function createModel(req, res) {
		try {
			req.connection.setTimeout(LONG_REQUEST_TIMEOUT);	// set long timeout since the processing can take quite long
			
			var session = req.session;
			var sessionId = req.sessionID;
			
			var username = session.username;
			
			var timeAttr = req.body.time;
			var modelName = req.body.name;
			var timeUnit = req.body.timeUnit;
			var attrs = req.body.attrs;
			var controlAttrs = req.body.controlAttrs;
			var isRealTime = req.body.isRealTime;
			var hierarchy = req.body.hierarchyType;
			var clustConfig = req.body.clust;
			
			var fileBuff = fileBuffH[sessionId];
			var datasetName = session.datasetName;
			var headers = session.headerFields;
			
			if (fileBuff == null)
				throw new Error('File is not defined while building a new model!');
			
			delete fileBuffH[sessionId];
			delete session.datasetName;
			delete session.headerFields;
			
			log.debug('Creating a new base for the current user ...');
			var baseDir = utils.getBaseDir(username, new Date().getTime());
			var dbDir = utils.getDbDir(baseDir);
			
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
							dbPath: dbDir,
							strictNames: false
						});
						
						log.debug('Creating default store ...');
						store = userBase.createStore({
							name: storeNm,
							fields: storeFields
						});
					}
					
					var opts = {
						username: username,
						datasetName: datasetName,
						modelName: modelName,
						base: userBase,
						store: store,
						storeNm: storeNm,
						isRealTime: isRealTime,
						timeUnit: timeUnit,
						headers: headers,
						timeAttr: timeAttr,
						hierarchyType: hierarchy,
						attrs: attrs,
						controlAttrs: controlAttrs,
							isRealTime: isRealTime,
							fileBuff: fileBuff,
							clustConfig: clustConfig,
							baseDir: baseDir
					}
						
					// finish the request
					res.status(204);	// no content
					res.end();
					
					// build the model
					modelStore.buildModel(opts, function (e, mid, model) {
						if (e != null) {
							log.error('Exception while building model!');
							return;
						}
						
						if (isRealTime) {
							if (log.debug())
								log.debug('Online model created!');
							
							activateModel(model);
						}
					});
				} catch (e) {
					log.error(e, 'Exception while uploading a new dataset!');
					handleServerError(e, req, res);
				}
			});
		} catch (e) {
			log.error(e, 'Exception while building model!');
			res.status(500);	// internal server error
			res.end();
		}
	}
	
	function handleGotProgress(req, res, e, isFinished, progress, msg) {
		try {
			var session = req.session;
			var username = session.username;
			
			if (e != null) {
				log.error(e, 'Failed to build model!');
				modelStore.confirmModelBuilt(username);
				res.send({
					isFinished: true,
					progress: 100,
					message: e.message,
					error: e.message
				});
			} else if (isFinished) {
				var mid = modelStore.getBuildingModelId(username);
				modelStore.confirmModelBuilt(username);
				
				res.send({
					isFinished: true,
					progress: progress,
					message: msg,
					mid: mid
				});
			} else {
				res.send({
					isFinished: false,
					message: msg,
					progress: progress
				});
			}
			
			res.end();
		} catch (e) {
			log.error(e, 'Failed to send progress to the UI!');
			handleServerError(e, req, res);
		}
	}
	
	app.get(API_PATH + '/pingProgress', function (req, res) {
		if (log.trace())
			log.trace('Checking model progress ...');
		
		try {
			var session = req.session;
			var username = session.username;
			
			if (!modelStore.isBuildingModel(username)) throw new Error('The user is not building a model!');
			
			if (modelStore.hasProgress(username)) {
				if (log.trace())
					log.trace('Already have progress, returning result ...');
				
				var progress = modelStore.popProgress(username);
				handleGotProgress(req, res, progress.error, progress.isFinished, progress.progress, progress.message);
			}
			else {
				var timeoutId = setTimeout(function () {
					if (log.trace())
						log.trace('Progress request expired, sending no content ...');
					
					if (modelStore.isBuildingModel(username) && modelStore.hasProgress(username))
						modelStore.clearProgressCallback(username);
					
					if (!res.finished) {
						res.status(204);	// no content
						res.end();
					}
				}, 30000);
				
				modelStore.setProgressCallback(username, function (e, isFinished, progress, message) {
					if (log.trace())
						log.trace('Progress callback called ...');
					
					clearTimeout(timeoutId);
					modelStore.clearProgressCallback(username);
					
					handleGotProgress(req, res, e, isFinished, progress, message);
				});
			}
		} catch (e) {
			log.error(e, 'Failed to check model progress!');
			handleServerError(e, req, res);
		}
	});
	
	app.post(API_PATH + '/buildModel', function (req, res) {
		log.info('Building the model ...');
		
		// create new base with the default store
		log.info('Creating users directory ...');
		var userDirNm = utils.getUserDir(req.body.username);
		
		fs.exists(userDirNm, function (exists) {
			if (exists) {
				log.debug('Reusing directory %s ...', userDirNm);
				createModel(req, res);
			} else {
				fs.mkdir(userDirNm, function (e) {
					if (e != null) {
						log.error(e, 'Failed to create directory!');
						res.status(500);	// internal server error
						res.end();
						return;
					}
					createModel(req, res);
				});
			}
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
				handleServerError(e, req, res);
				return;
			}
			
			try {
				if (modelConfig.is_realtime == 1) {
					var fname = modelConfig.model_file;
					var isActive = modelConfig.is_active == 1;
					
					if (isActive) {
						if (log.debug())
							log.debug('Adding an already active model to the session ...');
						
						var model = modelStore.getModel(modelId);
						saveToSession(sessionId, session, base, model, modelId, fname);
						res.status(204);	// no content
						res.end();
					} else {
						if (log.debug())
							log.debug('Adding an inactive model to the session ...');
						
						modelStore.loadOnlineModel(modelConfig.model_file, function (e, model) {
							if (e != null) {
								log.error(e, 'Exception while loading online model!');
								handleServerError(e, req, res);
								return;
							}
							
							saveToSession(sessionId, session, base, model, modelId, fname);
							res.status(204);	// no content
							res.end();
						});						
					}
				} else {
					var fname = utils.getModelFName(modelConfig.base_dir);
					
					modelStore.loadOfflineModel(modelConfig.base_dir, function (e, baseConfig) {
						if (e != null) {
							log.error(e, 'Exception while loading offline model!');
							handleServerError(e, req, res);
							return;
						}
						
						saveToSession(sessionId, session, baseConfig.base, baseConfig.model, modelId, fname);
						res.status(204);	// no content
						res.end();
					});
				}
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
				handleServerError(e, req, res);
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
					handleServerError(e, req, res);
					return;
				}
				
				res.send(result);
				res.end();
			});
		});
	}
	
	{
		log.info('Registering activate model service ...');
		
		function activateModelById(req, res, modelId, activate) {
			if (log.info())
				log.info('Activating model %s: ' + activate, modelId);
			
			db.activateModel({modelId: modelId, activate: activate}, function (e1) {
				if (e1 != null) {
					log.error(e1, 'Failed to activate model %s!', modelId);
					handleServerError(e, req, res);
					return;
				}
				
				try {
					if (activate) {
						db.fetchModel(modelId, function (e2, modelConfig) {
							if (e2 != null) {
								log.error(e2, 'Failed to fetch a model from the DB!');
								handleServerError(e, req, res);
								return;
							}
							
							modelStore.loadOnlineModel(modelConfig.model_file, function (e, model) {
								if (e != null) {
									log.error(e, 'Exception while loading online model!');
									return;
								}
								
								if (log.debug())
									log.debug('Activating model with id %s', model.getId());
								
								activateModel(model);
							});
						});
					} else {
						// deactivate, the model is currently active
						var model = modelStore.getModel(modelId);
						deactivateModel(model);
					}
					
					res.status(204);
					res.end();
				} catch (e2) {
					log.error('Model activated in the DB, but failed to activate it in the app!');
					res.status(500);
					res.end();
				}
			});
		}
		
		app.post(API_PATH + '/activateModel', function (req, res) {
			try {
				var session = req.session;
				var modelId = req.body.modelId;
				var activate = req.body.activate;

				if (activate == null) throw new Error('Missing parameter activate!');
				if (modelId == null) throw new Error('WTF?! Tried to activate a model that doesn\'t have an ID!');
				
				activateModelById(req, res, modelId, activate);
			} catch (e) {
				log.error(e, 'Failed to process raw measurement!');
				res.status(500);
				res.end();
			}
		});
		
		app.post(API_PATH + '/activateModelViz', function (req, res) {
			try {
				var session = req.session;
				var activate = req.body.activate == 'true';

				if (activate == null) throw new Error('Missing parameter activate!');
				
				var model = getModel(req.sessionID, session);
				
				activateModelById(req, res, model.getId(), activate);
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
					handleServerError(e, req, res);
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
	
	app.post(API_PATH + '/shareModel', function (req, res) {
		try {
			var session = req.session;
			
			var mid = req.body.modelId;
			var share = req.body.share;
			
			if (log.info())
				log.info('Sharing model %s: ', mid);
			
			db.makeModelPublic(mid, share, function (e) {
				if (e != null) {
					log.error(e, 'Failed to activate model %s!', modelId);
					handleServerError(e, req, res);
					return;
				}
				
				res.status(204);
				res.end();
			});
		} catch (e) {
			log.error(e, 'Failed to process raw measurement!');
			res.status(500);
			res.end();
		}
	});
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

function sendPrediction(msg, timestamp) {
	var msgStr = JSON.stringify(msg);
	
	var perMonth = msg.content.pdf.lambda;
	var perHour = perMonth / (30*24);
	
	var brokerMsg = transform.genExpPrediction(perHour, 'hour', timestamp);
	
	if (log.debug())
		log.debug('Sending prediction: %s', JSON.stringify(brokerMsg))
	
	broker.send(broker.PREDICTION_PRODUCER_TOPIC, JSON.stringify(brokerMsg));
	modelStore.distributeMsg(msgStr);
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
				
				if (zscore >= 2) {
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
					} else {					// (zscore >= 2) minor deviation
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
						
						sendPrediction(msg, opts.time);
					}
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
		try {
			if (msg.type == 'raw') {
				if (++imported % printInterval == 0 && log.trace())
					log.trace('Imported %d values ...', imported);
				var payload = msg.payload;
				
	
				if (log.trace())
					log.trace('Received raw measurement: %s', JSON.stringify(payload));
				
//				//========================================================
//				// TODO remove this			
//				payload = transform.parseDominiksRawEvent(msg);
//				//========================================================
				
				addRawMeasurement(payload);
			} else if (msg.type == 'cep') {
				if (log.trace())
					log.trace('Received CEP message: %s', JSON.stringify(msg));
				
				var event = msg.payload;	
				
//				//========================================================
//				// TODO remove this			
//				event = transform.parseDominiksDerivedEvent(event);
//				//========================================================
				
				var val = transform.parseDerivedEvent(event);
	
				var timestamp = event.timestamp;
				var eventName = event.eventName;
				
				if (isNaN(timestamp)) {
					log.warn('CEP sent NaN time %s', JSON.stringify(val));
					return;
				} 
				else if (timestamp <= lastCepTime) {
					log.warn('CEP sent invalid time %d <= %d: %s', timestamp, lastCepTime, JSON.stringify(val));
					return;
				}
				
				if (eventName == 'Generated') {
					if (log.trace())
						log.trace('Got enriched event ...');
					
					base.store(fields.OA_IN_STORE).push(val);
				} else if (eventName == 'timeToMolding') {
					if (log.trace())
						log.trace('Processing %s event ...', eventName);
					
					var ll = val.lacqueringLineId;
					var mm = val.mouldingMachineId;
					var shuttleId = val.shuttleId;
					var deltaTm = val.timeDifference;
					
					var minTime = transform.getMinShuttleTime(ll, mm);
					
					if (log.debug())
						log.debug('Got %s event, minTime: %s ...', eventName, minTime);
					
					if (minTime != null) {
						var timeRatio = deltaTm / minTime;
						
						if (log.info())
							log.info('Calculated timeToMolding ratio: %d', timeRatio);
						
						if (timeRatio < 1.2) {
							var msg = {
								type: 'prediction',
								content: {
									time: timestamp,
									eventId: 'Moulding line empty: ' + mm,
									pdf: {
										type: 'exponential',
										lambda: 1000
									}
								}
							};
							
							if (log.debug())
								log.info('Sending prediction %s', JSON.stringify(msg));
							
							sendPrediction(msg, timestamp);
						}
					}
				} else {
					if (log.info())
						log.info('Got unknown event, sending prediction ...');
					// send prediction directly
					
					var msg = {
						type: 'prediction',
						content: {
							time: timestamp,
							eventId: 'Some dummy prediction generated from a CEP event',
							pdf: {
								type: 'exponential',
								lambda: 1
							}
						}
					};
					
					sendPrediction(msg, timestamp);
				}
				
				lastCepTime = timestamp;
			} else {
				log.warn('Invalid message type: %s', msg.type);
			}
		} catch (e) {
			log.error(e, 'Exception while processing broker message!');
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
				
				modelStore.loadOnlineModel(modelConfig.model_file, function (e, model) {
					if (e != null) {
						log.error(e, 'Exception while loading online model!');
						return;
					}
					
					if (log.debug())
						log.debug('Activating model with id %s', model.getId());
					
					activateModel(model);
				});
			} catch (e1) {
				log.error(e1, 'Exception while initializing model %s', JSON.stringify(modelConfig));
			}
		}
	});
}

function excludeDirs(dirs, middleware) {
	function isInDirs(path) {
		for (var i = 0; i < dirs.length; i++) {
			if (path.startsWith(dirs[i]))
				return true;
		}
		return false;
	}
	
	return function (req, res, next) {
		var path = req.path;
		if (log.trace())
			log.trace('Request to path %s', path);
		
		if (isInDirs(path)) {
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

function excludeFiles(files, middleware) {
	return function (req, res, next) {
		var path = req.path;
		
		if (path == '/') path = '/index.html';
		
		if (log.trace())
			log.trace('Request to path %s', path);
		
		var isExcluded = false;
		
		for (var i = 0; i < files.length; i++) {
			var fname = files[i];
			if (path.endsWith(fname)) {
				isExcluded = true;
			}
		}
		
		if (isExcluded) {
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

function getPageOpts(req, res) {
	var session = req.session;
	var page = getRequestedPage(req);
	
	var opts = {
		utils: utils,
		username: null,
		model: session.model,
		modelConfig: null,
		models: null,
		modelStore: modelStore,
		error: null,
		warning: null,
		message: null,
		page: page,
		subtitle: titles[page],
		useCase: config.USE_CASE_NAME
	};
	
	if (isLoggedIn(session)) {
		opts.username = session.username;
	}
	
	if (session.error != null) {
		opts.error = session.error;
		delete session.error;
	}
	
	if (session.warning != null) {
		opts.warning = session.warning;
		delete session.warning;
	}
	
	if (session.message != null) {
		opts.message = session.message;
		delete session.message;
	}
	
	return opts;
}

function prepPage(page) {
	return function(req, res) {
		res.render(page, getPageOpts(req, res));
	}
}

function prepDashboard() {
	return function (req, res) {
		var opts = getPageOpts(req, res);
		var session = req.session;
		
		var username = session.username;
		
		db.fetchUserModels(username, function (e, dbModels) {
			if (e != null) {
				log.error(e, 'Failed to fetch user models!');
				handleServerError(e, req, res);
				return;
			}
			
			var models = {
				online: {
					active: [],
					inactive: [],
				},
				offline: [],
				publicModels: []
			};
			for (var i = 0; i < dbModels.length; i++) {
				var model = dbModels[i];
				
				var isOnline = model.is_active != null;
				var isPublic = model.is_public == 1;
				
				if (isPublic) {
					models.publicModels.push(model);
				}
				else if (isOnline) {
					if (model.is_active == 1) {
						models.online.active.push(model);
					} else {
						models.online.inactive.push(model);
					}
				}
				else {
					models.offline.push(model);
				}
			}
			
			opts.models = models;
			res.render('dashboard', opts);
		});
	}
}

function prepMainUi() {
	return function (req, res) {
		var opts = getPageOpts(req, res);
		var session = req.session;
		
		db.fetchModel(session.model.getId(), function (e, modelConfig) {
			if (e != null) {
				log.error(e, 'Failed to fetch model configuration from the DB!');
				handleServerError(e, req, res);
				return;
			}
			
			opts.modelConfig = modelConfig;
			res.render('ui', opts);
		});
	}
}

function accessControl(req, res, next) {
	var session = req.session;
	
	var page = getRequestedPage(req);
	var dir = getRequestedPath(req);
	
	if (!isLoggedIn(session)) {
		if (log.debug())
			log.debug('Session data missing for page %s, dir %s ...', page, dir);
		
		var isAjax = req.xhr;
		if (isAjax) {
			if (log.debug())
				log.debug('Session data missing for AJAX API call, blocking!');
			handleNoPermission(req, res);
		} else {
			redirect(res, 'login.html');
		}
	} else {
		next();
	}
}

function getHackedSessionStore() {
	var store =  new SessionStore();
	store.on('preDestroy', function (sessionId, session) {
		cleanUpSessionModel(sessionId, session);
		if (sessionId in fileBuffH)
			delete fileBuffH[sessionId];
	});
	return store;
}

function initServer(sessionStore, parseCookie) {
	log.info('Initializing web server ...');

	var sess = session({ 
		unset: 'destroy',
		store: sessionStore,
		cookie: { maxAge: 1000*60*60*24 },	// the cookie will last for 1 day
		resave: true,
		saveUninitialized: true
	});
	
	app.set('view engine', 'ejs');
	app.use(parseCookie);
	app.use(excludeDirs([DATA_PATH], sess));
	// automatically parse body on the API path
	app.use(LOGIN_PATH + '/', bodyParser.urlencoded({ extended: false }));
	app.use(LOGIN_PATH + '/', bodyParser.json());
	app.use(API_PATH + '/', bodyParser.urlencoded({ extended: false }));
	app.use(API_PATH + '/', bodyParser.json());
	app.use(DATA_PATH + '/', bodyParser.json());
	
	// when a session expires, redirect to index
	app.use('/ui.html', function (req, res, next) {
		var model = getModel(req.sessionID, req.session);
		// check if we need to redirect to the index page
		if (model == null) {
			log.info('Session data missing, redirecting to index ...');
			res.redirect('dashboard.html');
		} else {
			next();
		}
	});
	
	initLoginRestApi();
	initServerApi();
	initStreamStoryRestApi();
	initConfigRestApi();
	initDataUploadApi();
	
	app.use(excludeDirs(['/login', '/js', '/css', '/img', '/lib', '/popups'], excludeFiles(['index.html', 'login.html', 'register.html', 'resetpassword.html'], accessControl)));
	
	app.get('/login.html', prepPage('login'));
	app.get('/register.html', prepPage('register'));
	app.get('/resetpassword.html', prepPage('resetpassword'));
	app.get('/profile.html', prepPage('profile'));
	app.get('/dashboard.html', prepDashboard('dashboard'));
	app.get('/ui.html', prepMainUi('ui'));
	
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
		base: base,
		ws: ws,
		db: db,
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
