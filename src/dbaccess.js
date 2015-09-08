var mysql = require('mysql');
var config = require('../config.js');

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
	
	function fetchUserConfig(email, callback) {
		log.debug('fetching user config for user %s ...', email);
		
		
	}
	
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
		getUserConfig: function (email, callback) {
			log.debug('Fetching or creating user config ...');
			
			that.createUser(email, function (e) {
				pool.getConnection(function (e1, conn) {
					if (e != null) {
						conn.release();
						callback(e1);
						return;
					}
					
					conn.query('SELECT base_dir, dataset FROM user_base where user_email = ?', [email], function (e, result) {
						if (e != null) {
							conn.release();
							callback(e);
							return;
						}
						
						var userConfig = {
							bases: []
						};
						
						for (var i = 0; i < result.length; i++) {
							userConfig.bases.push({dir: result[i].base_dir, dataset: result[i].dataset});
						}
						
						conn.release();
						callback(undefined, userConfig);
					});
				});
			});
		},
		addAndGetUserConfig: function (opts, callback) {
			that.createUser(opts.email, function (e) {
				pool.getConnection(function (e1, conn) {
					if (e1 != null) {
						conn.release();
						callback(e1);
						return;
					}
					
					var insertVals = {
						user_email: opts.email,
						base_dir: opts.baseDir,
						dataset: opts.dataset
					}
					
					conn.query("INSERT INTO user_base SET ?", insertVals, function (e2) {
						conn.release();
						
						if (e2 != null) {
							callback(e2);
							return;
						}
						
						that.getUserConfig(opts.email, callback);
					});
				});
			});
		}
	}
	
	return that;
}