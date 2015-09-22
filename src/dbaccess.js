var mysql = require('mysql');
var config = require('../config.js');
var utils = require('./utils.js');

module.exports = function () {
	log.info('Creating MySQL connection pool ...');
	
	var pool = mysql.createPool({
		database: config.database.database,
		host: config.database.host,
		user: config.database.user,
		password: config.database.password,
		connectionLimit: 10
	});
	
	log.info('MySql connection created!');
	
	//===============================================================
	// HELPER FUNCTIONS
	//===============================================================
	
	function storeModel(opts, callback) {
		var username = opts.username;
		
		that.createUser(username, function (e) {
			if (e != null) {
				callback(e);
				return;
			}
			
			pool.getConnection(function (e1, conn) {
				if (e1 != null) {
					callback(e1);
					return;
				}
				
				conn.query('INSERT INTO model SET ?', opts, function (e2, result) {
					conn.release();
					callback(e2 != null ? undefined : e2, result);
				});
			});
		});
	};
	
	var that = {
			
		//===============================================================
		// USER QUERIES
		//===============================================================
			
		createUser: function (email, callback) {
			log.debug('Fetching user by email: %s', email);
			
			pool.getConnection(function (e, conn) {
				if (e != null) {
					callback(e);
					return;
				}
				
				// check if the user already exists
				conn.query("SELECT EXISTS(SELECT 1 FROM user WHERE email = ?) as isRegistered", [email], function (e1, results) {
					if (e1 != null) {
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
		
		//===============================================================
		// MODEL QUERIES
		//===============================================================
		
		fetchUserModels: function (username, callback) {
			that.createUser(username, function (e) {
				if (e != null) {
					callback(e);
					return;
				}
				
				pool.getConnection(function (e1, conn) {
					if (e1 != null) {
						callback(e1);
						return;
					}
					
					conn.query('SELECT * FROM model m LEFT JOIN offline_model ofm ON m.mid = ofm.mid LEFT JOIN online_model onm ON m.mid = onm.mid ' + 
									'WHERE m.username = ?', [username], function (e2, result) {
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
		storeOnlineModel: function (opts, callback) {
			var is_active = opts.is_active;
			
			var onlineOpts = utils.clone(opts);
			onlineOpts.is_realtime = 1;
			delete onlineOpts.is_active;
			
			storeModel(onlineOpts, function (e, result) {
				if (e != null) {
					callback(e);
					return;
				}
				
				var modelId = result.insertId;
				
				pool.getConnection(function (e1, conn) {
					if (e1 != null) {
						callback(e1);
						return;
					}
					
					conn.query('INSERT INTO online_model SET ?', { mid: modelId, is_active: is_active }, function (e2, result) {
						conn.release();
						callback(e2 != null ? undefined : e2);
					});
				});
			});
		},
		storeOfflineModel: function (opts, callback) {
			var baseDir = opts.base_dir;
			
			var offlineOpts = utils.clone(opts);
			offlineOpts.is_realtime = 0;
			delete offlineOpts.base_dir;
			
			storeModel(offlineOpts, function (e, result) {
				if (e != null) {
					callback(e);
					return;
				}
				
				var modelId = result.insertId;
				
				pool.getConnection(function (e1, conn) {
					if (e1 != null) {
						callback(e1);
						return;
					}
					
					conn.query('INSERT INTO offline_model SET ?', { mid: modelId, base_dir: baseDir }, function (e2, result) {
						conn.release();
						callback(e2 != null ? undefined : e2);
					});
				});
			});
		},
		fetchModel: function (modelId, callback) {
			pool.getConnection(function (e, conn) {
				if (e != null) {
					callback(e);
					return;
				}
				
				var query = 'SELECT * FROM model m LEFT JOIN offline_model ofm ON m.mid = ofm.mid LEFT JOIN online_model onm ON m.mid = onm.mid ' + 
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
		countActiveModels: function (callback) {
			pool.getConnection(function (e, conn) {
				if (e != null) {
					callback(e);
					return;
				}
				
				conn.query('SELECT COUNT(1) AS count FROM online_model WHERE is_active = 1', function (e1, result) {
					conn.release();
					
					if (e1 != null) {
						callback(e1);
						return;
					}
					
					if (result.length == 0) {
						callback(new Error('WTF? Did not get a result for count!'));
						return;
					}
					
					callback(undefined, result[0]);
				});
			});
		},
		fetchActiveModels: function (callback) {
			pool.getConnection(function (e, conn) {
				if (e != null) {
					callback(e);
					return;
				}
				
				var query = 'SELECT * FROM model NATURAL JOIN online_model ' + 
								'WHERE is_active = 1';

				conn.query(query, function (e1, result) {
					conn.release();
					
					if (e1 != null) {
						callback(e1);
						return;
					}
					
					if (result.length == null) {
						callback(new Error('The model doesn\'t exist!'));
						return;
					}
					
					callback(undefined, result);
				});
			});
		},
		activateModel: function (opts, callback) {
			pool.getConnection(function (e, conn) {
				if (e != null) {
					callback(e);
					return;
				}
				
				var query = 'UPDATE online_model SET is_active = ? WHERE mid = (SELECT m.mid FROM model m WHERE m.model_file = ?)';
				conn.query(query, [opts.activate ? 1 : 0, opts.modelId], function (e1) {
					conn.release();
					callback(e1);
				});
			});
		},
		
		//===============================================================
		// CONFIGURATION QUERIES
		//===============================================================
		
		getMultipleConfig: function (opts, callback) {
			pool.getConnection(function (e, conn) {
				if (e != null) {
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