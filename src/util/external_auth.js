var http = require('http');

var config = require('../../config.js');
var utils = require('../utils.js');

var db = null;

var userDetailsOpts = {
    hostname: config.AUTHENTICATION_HOST,
    port: 80,
    path: '/semantic-epa-backend/api/v2/admin/sso',
    method: 'GET'
}

function getCredentialsRqOpts(token) {
    var opts = utils.clone(userDetailsOpts);
    opts.path += '?token=' + token;
    return opts;
}

exports.prepDashboard = function (opts) {
    if (config.AUTHENTICATION_EXTERNAL) {
        if (log.trace())
            log.trace('Preparing external authentication data for the page ...');
        opts.useExternalAuth = true;
        opts.authenticationUrl = 'http://' + config.AUTHENTICATION_HOST + '/#/sso/streamstory';
    } else {
        opts.useExternalAuth = false;
    }
}

exports.fetchCredentials = function (token, callback) {
    var opts = getCredentialsRqOpts(token);

    if (log.info())
        log.info('Fetching credentials using options: %s', JSON.stringify(opts));

    var credentialsReq = http.request(opts, function (credentialsRes) {
        if (credentialsRes.statusCode < 200 || 300 <= credentialsRes.statusCode) {
            callback(new Error('Failed to get user credentials from external server! Status code: ' + credentialsRes.statusCode));
            return;
        }

        var msgJson = '';
        credentialsRes.on('data', function (chunk) {
            msgJson += chunk;
        });
        credentialsRes.on('end', function () {
            try {
                if (log.debug())
                    log.debug('Received message: %s', msgJson);

                var response = JSON.parse(msgJson);

                // check for success
                if (!response.success) {
                    log.warn('User failed to login!');
                    callback(new Error('Got unsuccessful response!'));
                    return;
                }

                var credentials = response.info.authc.credentials;

                if (credentials.email == null) {
                    log.warn('Got NULL email from external authentication!');
                    callback(new Error('Got NULL email!'));
                    return;
                }

                var email = credentials.email;

                log.info('Received credentials %s using the token ...', email);

                db.fetchUserByEmail(email, function (e, user) {
                    if (e != null) return callback(e);

                    if (user == null) {
                        var hash = utils.hashPassword('somedummypassword');
                        db.createUser(email, hash, function (e1) {
                            if (e1 != null) {
                                return callback(e1);
                            }

                            db.fetchUserByEmail(email, function (e, user) {
                                if (e != null) return callback(e);
                                callback(undefined, user);
                            })
                        });
                    } else {
                        callback(undefined, user);
                    }
                });
            } catch (e) {
                callback(e);
            }
        });
    })

    credentialsReq.on('socket', function (socket) {
        if (log.trace())
            log.trace('Setting timeout ...');

        socket.setTimeout(config.AUTHENTICATION_TIMEOUT);
        socket.on('timeout', function() {
            if (log.warn())
                log.warn('Socket timeout %s:%s, aborting request ...', opts.hostname, opts.port);
            credentialsReq.abort();
        });
    });

    credentialsReq.on('error', function (e) {
        if (e.code === "ECONNRESET") {
            log.info('Connection reset %s:%s', opts.hostname, opts.port);
        } else if (e.code === 'ETIMEDOUT') {
            log.info('Timedout occurred for host: %s:%s', opts.hostname, opts.port);
        } else {
            log.error(e, 'Failed to send HTTP pool %s:%s', opts.hostname, opts.port);
        }

        callback(e);
    });

    credentialsReq.end();
}

exports.setDb = function (_db) {
    db = _db;
}
