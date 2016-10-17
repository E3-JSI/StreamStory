var http = require('http');

var config = require('../../config.js');
var utils = require('../utils.js');
var db = require('../db/mysqldb.js');

var sessionStore = null;

var userDetailsOpts = {
    hostname: config.AUTHENTICATION_HOST,
    port: 80,
    path: 'semantic-epa-backend/api/v2/admin/sso',
    method: 'GET'
}

function loginUser(session, email, cb) {
    log.info('Logging in user %s ...', email);

    db.userExists(email, function (e, exists) {
        if (e != null) return cb(e);

        if (!exists) {
            log.info('User does not exist, will create new one ...');

            var dummyHash = utils.hashPassword('Some dummy password!');

            db.createUser(email, dummyHash, function (e) {
                if (e != null) return cb(e);

                db.fetchUserByEmail(email, function (e, user) {
                    if (e != null) return cb(e);
                    if (user == null) return cb(new Error('Failed to fetch the user from the database!'));

                    log.info('User successfully logged in!');
                    session.username = email;
                    session.theme = user.theme;
                    cb();
                });
            })
        }
        else {
            db.fetchUserByEmail(email, function (e, user) {
                if (e != null) return cb(e);
                if (user == null) return cb(new Error('Failed to fetch the user from the database!'));

                log.info('User successfully logged in!');
                session.username = email;
                session.theme = user.theme;
                cb();
            });
        }
    })
}

exports.prepDashboard = function (opts, sessionId) {
    if (config.AUTHENTICATION_EXTERNAL) {
        if (log.trace())
            log.trace('Preparing external authentication data for the page ...');
        opts.useExternalAuth = true;
        opts.authenticationUrl = 'http://' + config.AUTHENTICATION_HOST + '/#/sso/streamstory?session=' + sessionId;
    } else {
        opts.useExternalAuth = false;
    }
}

exports.initExternalAuth = function (app) {
    log.info('Initializing external authentication service ...');

    app.post('/login/token', function (req, res) {
        try {
            log.info('Received request with token, fetching user credentials ...');

            // use the token from the request body to query user
            // credentials
            var token = req.body.token;
            var sessionId = req.body.session;

            if (log.debug())
                log.debug('Token: %s', token);
            if (log.debug())
                log.debug('Session ID: %s', sessionId);

            var opts = (function () {
                var opts = utils.clone(userDetailsOpts);
                opts.path += '?session=' + token;
                return opts;
            })();

            sessionStore.get(sessionId, function (session) {
                if (session == null) {
                    log.warn('External authentication failed, could not find session with ID: %s', sessionId);
                    utils.handleBadInput(res, 'Could not find session with provided ID!');
                    return;
                }

                var creadentialsReq = http.request(opts, function (creadentialsRes) {
                    if (creadentialsRes.statusCode < 200 || 300 <= creadentialsRes.statusCode) {
                        utils.handleServerError(new Error('Failed to get user credentials from external server!'), req, res);
                        return;
                    }

                    var msgJson = '';
                    creadentialsRes.on('data', function (chunk) {
                        msgJson += chunk;
                    });
                    creadentialsRes.on('end', function () {
                        try {
                            if (log.trace())
                                log.trace('Received message: %s', msgJson);

                            var response = JSON.parse(msgJson);

                            // check for success
                            if (!response.success) {
                                log.warn('User failed to login!');
                                utils.handleServerError(new Error('Got unsuccessful response!'), req, res);
                                return;
                            }

                            var credentials = response.authc.credentials.name;
                            if (credentials.name == null) {
                                log.warn('Got NULL name from external authentication!');
                                utils.handleServerError(new Error('Got NULL name!'), req, res);
                                return;
                            }

                            var email = credentials.name;

                            log.info('Received credentials %s using the token ...', email);

                            loginUser(session, email, function (e) {
                                if (e != null) {
                                    utils.handleServerError(e, req, res);
                                    return;
                                }

                                utils.handleNoContent(req, res);
                            })
                        } catch (e) {
                            utils.handleServerError(e, req, res);
                        }
                    });
                })

                creadentialsReq.on('socket', function (socket) {
                    if (log.trace())
                        log.trace('Setting timeout ...');

                    socket.setTimeout(config.AUTHENTICATION_TIMEOUT);
                    socket.on('timeout', function() {
                        if (log.warn())
                            log.warn('Socket timeout %s:%s, aborting request ...', opts.hostname, opts.port);
                        creadentialsReq.abort();
                    });
                });

                creadentialsReq.on('error', function (e) {
                    if (e.code === "ECONNRESET") {
                        log.info('Connection reset %s:%s', opts.hostname, opts.port);
                    } else if (e.code === 'ETIMEDOUT') {
                        log.info('Timedout occurred for host: %s:%s', opts.hostname, opts.port);
                    } else {
                        log.error(e, 'Failed to send HTTP pool %s:%s', opts.hostname, opts.port);
                    }

                    utils.handleServerError(e, req, res);
                });

                creadentialsReq.end();
            })
        } catch (e) {
            utils.handleServerError(e, req, res);
        }
    });
}

exports.setSessionStore = function (store) {
    sessionStore = store;
}
