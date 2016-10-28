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

function getCredentialsRqOpts(token) {
    var opts = utils.clone(userDetailsOpts);
    opts.path += '?session=' + token;
    return opts;
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

exports.fetchCredentials = function (token, callback) {
    var opts = getCredentialsRqOpts(token);

    var creadentialsReq = http.request(opts, function (creadentialsRes) {
        if (creadentialsRes.statusCode < 200 || 300 <= creadentialsRes.statusCode) {
            callback(new Error('Failed to get user credentials from external server!'));
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
                    callback(new Error('Got unsuccessful response!'));
                    return;
                }

                var credentials = response.authc.credentials.name;

                log.info('Got from external server: %s', JSON.stringify(response));

                if (credentials.name == null) {
                    log.warn('Got NULL name from external authentication!');
                    callback(new Error('Got NULL name!'));
                    return;
                }

                var email = credentials.name;

                log.info('Received credentials %s using the token ...', email);

                db.fetchUserByEmail(email, function (e, user) {
                    if (e != null) return callback(e);
                    if (user == null) return callback(new Error('Failed to fetch the user from the database!'));

                    callback(undefined, user);
                });
            } catch (e) {
                callback(e);
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

        callback(e);
    });

    creadentialsReq.end();
}

exports.setSessionStore = function (store) {
    sessionStore = store;
}
