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
	
	function releaseConnection(conn, callback) {
		return function (result) {
			if (conn != null)
				conn.release();
			
			if (log.trace())
				log.trace('Connection released!');
			
			callback(undefined, result);
		}
	}
	
	function releaseConnectionErr(conn, callback) {
		return function (e) {
			log.error(e, 'Exception during a connection! Releasing connection and calling callback ...');
			
			if (conn != null)
				conn.release();
			
			callback(e);
		}
	}
	
	function connection(opts) {
		var callback = opts.callback;
		var nextOp = opts.nextOp;
		
		if (callback == null) throw new Error('Callback is not defined while creating a connection!');
		
		if (log.trace())
			log.trace('Inializing connection to MySQL database ...');
		
		pool.getConnection(function (e, conn) {
			if (e != null) {
				log.error(e, 'An exception while opening a connection!');
				callback(e);
				return;
			}
			
			if (log.trace())
				log.trace('Connection established ...');
			
			if (nextOp != null)
				nextOp(conn, releaseConnection(conn, callback), releaseConnectionErr(conn, callback));
			else
				releaseConnection(conn, callback)();
		});
	}
	
	function _rollback(conn, e, onerror) {
		if (log.trace())
			log.trace('Rolling back ...');
		
		if (conn != null) {
			conn.rollback(function () {
				onerror(e);
			});
		} else {
			onerror(e);
		}
	}

	function rollback(conn, onsuccess, onerror) {
		return function (e) {
			_rollback(conn, e, onerror);
		}
	}

	function commit(conn, onsuccess, onerror) {
		return function (result) {
			if (log.trace())
				log.trace('Committing results ...');
			
			conn.commit(function (e) {
				if (e != null) {
					_rollback(conn, e, onerror);
					return;
				} else {
					onsuccess(result);
				}
			});
		}
	}

	function transaction(opts) {
		var nextOp = opts.nextOp;
		
		return function (conn, onsuccess, onerror, data) {
			if (log.trace())
				log.trace('Starting transaction ...');
			
			conn.beginTransaction(function (e) {
				if (e != null) {
					onerror(e);
					return;
				}
				nextOp(conn, commit(conn, onsuccess, onerror), rollback(conn, onsuccess, onerror), data);
			});
		}
	}
	
	function unlockTable(conn, onsuccess, onerror) {
		return function (result) {
			if (log.trace())
				log.trace('Unlocking tables ...');
			
			query({
				sql: 'UNLOCK TABLES',
				nextOp: function (conn, onsuccess, onerror) {
					onsuccess(result);
				}
			})(conn, onsuccess, function (e) {
				log.error(e, 'Critical, failed to unlock tables! This is very bad!');
				onerror(e);
			});
		}
	}
	
	function unlockTableErr(conn, onsuccess, onerror) {
		return function (e)	 {
			log.error(e, 'Exception while table locked!');
			
			query({
				sql: 'UNLOCK TABLES',
				nextOp: function (conn, onsuccess, onerror) {
					onerror(e);
				}
			})(conn, onsuccess, function (e) {
				log.error(e, 'Critical, failed to unlock tables! This is very bad!');
				onerror(e);
			})
		}
	}
	
	function lockTable(opts) {
		var tables = opts.tables;
		var nextOp = opts.nextOp;
		
		var sql = 'LOCK TABLE ';
		for (var i = 0; i < tables.length; i++) {
			sql += tables[i] + ' WRITE';
			if (i < tables.length-1)
				sql += ',';
		}
		
		return function (conn, onsuccess, onerror, data) {
			if (log.trace())
				log.trace('Locking tables %s', JSON.stringify(tables));
			
			query({
				sql: sql,
				nextOp: function (conn, onsuccess, onerror) {
					if (nextOp != null) {
						nextOp(conn, unlockTable(conn, onsuccess, onerror), unlockTableErr(conn, onsuccess, onerror), data)
					} else {
						unlockTable(conn, onsuccess, onerror)(data);
					}
				}
			})(conn, onsuccess, onerror);
		}
	}
	
	function query(opts) {
		var sql = opts.sql;
		var params = opts.params;
		var nextOp = opts.nextOp;
		
		if (params == null) params = [];
		
		return function (conn, onsuccess, onerror) {
			var q = conn.query(sql, params, function (e, result) {
				if (e != null) {
					onerror(e);
					return;
				}
				
				if (nextOp != null) {
					nextOp(conn, onsuccess, onerror, result);
				} else {
					onsuccess(result);
				}
			});
			
			if (log.trace())
				log.trace('Executed query: %s!', q.sql);
		}
	}
	
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
					callback(e2, result);
				});
			});
		});
	};
	
	function storeGeneralModel(opts) {
		var values = opts.values;
		var nextOp = opts.nextOp;
		
		return query({
			sql: 'INSERT INTO model SET ?',
			params: values,
			nextOp: function (conn, onsuccess, onerror, result) {
				if (nextOp != null)
					nextOp(conn, onsuccess, onerror, result.insertId);
				else
					onsuccess(undefined, result.insertId);
			}
		})
	}
	
	function createUser(opts) {
		var username = opts.username;
		var nextOp = opts.nextOp;
		
		return query({
			sql: 'SELECT EXISTS(SELECT 1 FROM user WHERE email = ?) as isRegistered',
			params: [username],
			nextOp: function (conn, onsuccess, onerror, result) {
				var exists = result[0].isRegistered == 1;
				
				if (exists) {
					if (nextOp != null)
						nextOp(conn, onsuccess, onerror, username);
					else
						onsuccess(undefined, username);
				} else {
					query({
						sql: 'INSERT INTO user SET ?',
						params: {email: username},
						nextOp: function (conn, onsuccess, onerror, result) {
							if (nextOp != null)
								nextOp(conn, onsuccess, onerror, result.insertId);
							else
								onsuccess(undefined, result.insertId)
						}
					})(conn, onsuccess, onerror);
				}
			}
		})
	}
	
	var that = {
			
		//===============================================================
		// USER QUERIES
		//===============================================================
			
		createUser: function (email, callback) {
			log.debug('Creating user with username: %s', email);
			
			connection({
				callback: callback,
				nextOp: createUser({
					username: email
				})
			});
		},
		
		//===============================================================
		// MODEL QUERIES
		//===============================================================
		
		fetchUserModels: function (username, callback) {
			connection({
				callback: callback,
				nextOp: transaction({
					nextOp: createUser({
						username: username,
						nextOp: query({
							sql: 'SELECT m.*, onm.is_active FROM model m LEFT JOIN offline_model ofm ON m.mid = ofm.mid LEFT JOIN online_model onm ON m.mid = onm.mid ' + 
									'WHERE m.username = ? OR m.is_public = 1',
							params: [username]
						})
					})
				})
			});
		},
		
		fetchModelByFName: function (fname, callback) {
			connection({
				callback: callback,
				nextOp: query({
					sql: 'SELECT m.*, onm.is_active FROM model m LEFT JOIN offline_model ofm ON m.mid = ofm.mid LEFT JOIN online_model onm ON m.mid = onm.mid ' + 
									'WHERE m.model_file = ?',
					params: [fname],
					nextOp: function (conn, onsuccess, onerror, results) {
						if (results.length == 0)
							onerror(new Error('Model with fname "' + fname + '" does not exist!'));
						else
							onsuccess(results[0]);
					}
				})
			});
		},
		
		storeOnlineModel: function (opts, callback) {
			var is_active = opts.is_active;
			
			var onlineOpts = utils.clone(opts);
			onlineOpts.is_realtime = 1;
			delete onlineOpts.is_active;
			
			connection({
				callback: callback,
				nextOp: transaction({
					nextOp: storeGeneralModel({
						values: onlineOpts,
						nextOp: function (conn, onsuccess, onerror, modelId) {
							query({
								sql: 'INSERT INTO online_model SET ?',
								params: { mid: modelId, is_active: is_active },
								nextOp: function (conn, onsuccess, onerror, results) {
									onsuccess(modelId);
								}
							})(conn, onsuccess, onerror);
						}
					})
				})
			});
		},
		storeOfflineModel: function (opts, callback) {
			var baseDir = opts.base_dir;
			
			var offlineOpts = utils.clone(opts);
			offlineOpts.is_realtime = 0;
			delete offlineOpts.base_dir;
			
			connection({
				callback: callback,
				nextOp: transaction({
					nextOp: storeGeneralModel({
						values: offlineOpts,
						nextOp: function (conn, onsuccess, onerror, modelId) {
							query({
								sql: 'INSERT INTO offline_model SET ?',
								params: { mid: modelId, base_dir: baseDir },
								nextOp: function (conn, onsuccess, onerror, results) {
									onsuccess(modelId);
								}
							})(conn, onsuccess, onerror);
						}
					})
				})
			});
		},
		fetchModel: function (modelId, callback) {
			connection({
				callback: callback,
				nextOp: query({
					sql: 'SELECT m.*, onm.is_active FROM model m LEFT JOIN offline_model ofm ON m.mid = ofm.mid LEFT JOIN online_model onm ON m.mid = onm.mid ' + 
								'WHERE m.mid = ?',
					params: [modelId],
					nextOp: function (conn, onsuccess, onerror, results) {
						if (results.length == 0)
							onerror(new Error('The model doesn\'t exist!'));
						else
							onsuccess(results[0]);
					}
				})
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
			connection({
				callback: callback,
				nextOp: query({
					sql: 'UPDATE online_model SET is_active = ? WHERE mid = ?',
					params: [opts.activate ? 1 : 0, opts.modelId]
				})
			});
		},
		
		//===============================================================
		// MODEL QUERIES
		//===============================================================
		
		setUndesiredEventId: function (mid, sid, eventId, callback) {
			connection({
				callback: callback,
				nextOp: query({
					sql: 'SELECT EXISTS(SELECT 1 FROM state_properties WHERE mid = ? AND sid = ?) AS ex',
					params: [mid, sid],
					nextOp: function (conn, onsuccess, onerror, results) {
						var exists = results[0].ex;
						
						if (!exists) {
							query({
								sql: 'INSERT INTO state_properties SET ?',
								params: { mid: mid, sid: sid, eventId: eventId }
							})(conn, onsuccess, onerror);
						} else {
							query({
								sql: 'UPDATE state_properties SET eventId = ? WHERE mid = ? AND sid = ?',
								params: [eventId, mid, sid]
							})(conn, onsuccess, onerror);
						}
					}
				})
			});
		},
		
		getUndesiredEventId: function (mid, sid, callback) {
			connection({
				callback: callback,
				nextOp: query({
					sql: 'SELECT eventId FROM state_properties WHERE mid = ? AND sid = ?',
					params: [mid, sid],
					nextOp: function (conn, onsuccess, onerror, results) {
						if (results.length == 0)
							onsuccess(undefined);
						else
							onsuccess(results[0].eventId);
					}
				})
			});
		},
		
		clearUndesiredEventId: function (mid, sid, callback) {
			connection({
				callback: callback,
				nextOp: query({
					sql: 'DELETE FROM state_properties WHERE mid = ? AND sid = ?',
					params: [mid, sid]
				})
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