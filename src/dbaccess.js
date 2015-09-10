var mysql = require('mysql');
var config = require('../config.js');
var utils = require('./utils.js');

module.exports = function () {
	log.info('Creating MySQL connection pool ...');
	
	var pool = mysql.createPool({
		database: 'StreamStory',
		host: config.database.host,
		user: config.database.user,
		password: 'StreamStory',
		connectionLimit: 10
	});
	
	log.info('MySql connection created!');
	
	var that = {
		createUser: function (email, callback) {
			log.debug('Fetching user by email: %s', email);
			
			pool.getConnection(function (e, conn) {
				if (e != null) {
					conn.release();
					callback(e);
					return;
				}
				
				// check if the user already exists
				conn.query("SELECT EXISTS(SELECT 1 FROM user WHERE email = ?) as isRegistered", [email], function (e1, results) {
					if (e1 != null) {
						conn.release();
						callback(e1);
						return;
					}
					
					if (results[0].isRegistered == 1) {
						conn.release();
						callback();
					} else {
						// create the user
						conn.query('INSERT INTO user SET ?', {email: email}, function (e2, result) {
							conn.release();
							callback(e2 != null ? undefined : e2);
						});
					}
				});
			});
		},
		storeModel: function (opts, callback) {
			var username = opts.username;
			
			that.createUser(username, function (e) {
				if (e != null) {
					callback(e);
					return;
				}
				
				pool.getConnection(function (e1, conn) {
					if (e1 != null) {
						conn.release();	// TODO should release be here?
						callback(e1);
						return;
					}
					
					conn.query('INSERT INTO model SET ?', opts, function (e2, result) {
						conn.release();
						callback(e2 != null ? undefined : e2, result);
					});
				});
			});
		},
		storeOfflineModel: function (opts, callback) {
			var baseDir = opts.base_dir;
			
			var offlineOpts = utils.clone(opts);
			offlineOpts.is_realtime = 0;
			delete offlineOpts.base_dir;
			
			that.storeModel(offlineOpts, function (e, result) {
				if (e != null) {
					callback(e);
					return;
				}
				
				var modelId = result.insertId;
				
				pool.getConnection(function (e1, conn) {
					if (e1 != null) {
						conn.release();	// TODO should release be here?
						callback(e1);
						return;
					}
					
					conn.query('INSERT INTO model_base SET ?', { mid: modelId, base_dir: baseDir }, function (e2, result) {
						conn.release();
						callback(e2 != null ? undefined : e2);
					});
				});
			});
		},
		fetchUserModels: function (username, callback) {
			that.createUser(username, function (e) {
				if (e != null) {
					callback(e);
					return;
				}
				
				pool.getConnection(function (e1, conn) {
					if (e1 != null) {
						conn.release();
						callback(e1);
						return;
					}
					
					conn.query('SELECT * FROM model where username = ?', [username], function (e2, result) {
						conn.release();
						
						if (e2 != null) {
							callback(e2);
							return;
						}
						
						callback(undefined, result);
					});
				});
			});
		},
		fetchModel: function (modelId, callback) {
			pool.getConnection(function (e, conn) {
				if (e != null) {
					conn.release();
					callback(e);
					return;
				}
				
				var query = 'SELECT * FROM model m LEFT JOIN model_base mb ON m.mid = mb.mid ' + 
								'WHERE m.model_file = ?';
				
				conn.query(query, [modelId], function (e1, result) {
					conn.release();
					
					if (e1 != null) {
						callback(e1);
						return;
					}
					
					if (result.length == null) {
						callback(new Error('The model doesn\'t exist!'));
						return;
					}
					
					callback(undefined, result[0]);
				});
			});
		},
//		getUserConfig: function (email, callback) {
//			log.debug('Fetching or creating user config ...');
//			
//			that.createUser(email, function (e) {
//				pool.getConnection(function (e1, conn) {
//					if (e != null) {
//						conn.release();
//						callback(e1);
//						return;
//					}
//					
//					conn.query('SELECT base_dir, dataset FROM user_base where user_email = ?', [email], function (e, result) {
//						if (e != null) {
//							conn.release();
//							callback(e);
//							return;
//						}
//						
//						var userConfig = {
//							bases: []
//						};
//						
//						for (var i = 0; i < result.length; i++) {
//							userConfig.bases.push({dir: result[i].base_dir, dataset: result[i].dataset});
//						}
//						
//						conn.release();
//						callback(undefined, userConfig);
//					});
//				});
//			});
//		},
//		addAndGetUserConfig: function (opts, callback) {
//			that.createUser(opts.email, function (e) {
//				pool.getConnection(function (e1, conn) {
//					if (e1 != null) {
//						conn.release();
//						callback(e1);
//						return;
//					}
//					
//					var insertVals = {
//						user_email: opts.email,
//						base_dir: opts.baseDir,
//						dataset: opts.dataset
//					}
//					
//					conn.query("INSERT INTO user_base SET ?", insertVals, function (e2) {
//						conn.release();
//						
//						if (e2 != null) {
//							callback(e2);
//							return;
//						}
//						
//						that.getUserConfig(opts.email, callback);
//					});
//				});
//			});
//		},
		getMultipleConfig: function (opts, callback) {
			pool.getConnection(function (e, conn) {
				if (e != null) {
					conn.release();
					callback(e);
					return;
				}
				
				conn.query("SELECT property, value FROM config WHERE property in (?)", [opts.properties], function (e1, result) {
					conn.release();
					if (e1 != null) {
						callback(e1);
					} else {
						callback(undefined, result);
					}
				});
			});
		},
		getConfig: function (property, callback) {
			pool.getConnection(function (e, conn) {
				if (e != null) {
					conn.release();
					callback(e);
					return;
				}
				
				conn.query("SELECT property, value FROM config WHERE property = ?", [property], function (e1, result) {
					conn.release();
					if (e1 != null) {
						callback(e1);
					} else {
						callback(undefined, result.length == 1 ? result[0] : null);
					}
				});
			});
		},
		setConfig: function (config, callback) {
			var props = [];
			for (var prop in config) {
				props.push(prop);
			}
			
			if (props.length == 0) {
				callback();
				return;
			}
			
			pool.getConnection(function (e, conn) {
				if (e != null) {
					conn.release();
					callback(e);
					return;
				}

				var query = 'REPLACE INTO config (property, value) VALUES ';
				var vals = [];
				for (var i = 0; i < props.length; i++) {
					var prop = props[i];
					
					query += '(?, ?)';
					vals.push(prop);
					vals.push(config[prop]);
					
					if (i < props.length - 1)
						query += ', ';
				}
				
				conn.query(query, vals, function (e1) {
					conn.release();
					if (e1 != null) {
						callback(e1);
					} else {
						callback(undefined);
					}
				});
			});
		}
	}
	
	return that;
}