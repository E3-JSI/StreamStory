var WebSocket = require('ws');

var config = require('../../config.js');

//=============================================================
// WEBSOCKET WRAPPER
//=============================================================

module.exports = exports = function (opts) {
    log.info('Creating web socket server ...');

    var server = opts.server;
    var sessionStore = opts.sessionStore;
    var parseCookie = opts.parseCookie;
    var connectedCb = opts.onConnected;
    var disconnectedCb = opts.onDisconnected;

    var sockets = {};
    var socketId = 0;

    var wss = new WebSocket.Server({
        server: server,
        path: opts.webSocketPath
    });

    function delSocket(id) {
        if (id == null) {
            log.warn('Tried to delete socket with null ID! Ignoring ...');
            return;
        }

        try {
            if (id in sockets) {
                delete sockets[id];

                if (disconnectedCb != null)
                    disconnectedCb(id);
            }
            else
                log.warn('Tried to delete a socket that is not cached %d!', id);
        } catch (e) {
            log.error(e, 'Failed to delete socket %d!', id);
        }
    }

    function closeClient(id) {
        if (!(id in sockets)) return;

        var socket = sockets[id].client;

        if (socket.readyState == WebSocket.CLOSING || socket.readyState == WebSocket.CLOSED) {
            delSocket(id);
            return;
        }

        if (log.debug())
            log.debug("Closing client %d", id);

        sockets[id].client.close();
        delSocket(id);
    }

    function removeIdle() {
        for (var id in sockets) {
            if (!sockets[id].gotPong) {
                if (log.debug())
                    log.debug('Socket %s idle, removing ...', id)
                closeClient(id);
            }
            if (id in sockets) {
                sockets[id].gotPong = false;
            }
        }
    }

    wss.on('connection', function (socket) {
        var id = socketId++;

        // get the session
        parseCookie(socket.upgradeReq, null, function (e) {
            if (e != null) {
                log.error(e, 'Failed to parse cookie while connecting a web socket!');
                return;
            }

            var sessionId = socket.upgradeReq.signedCookies['connect.sid'];
            if (sessionId == null) {
                log.warn('Failed to get a sessionId for web socket %s!', id);
                return;
            }

            sessionStore.get(sessionId, function (e1, session) {
                if (log.info())
                    log.info('Got session for web socket %d ...', id);
                if (connectedCb != null)
                    connectedCb(id, sessionId, session);
            });
        });

        if (log.info())
            log.info('New websocket connected id: %d ...', id);

        sockets[id] = { client: socket, gotPong: true };

        socket.on('message', function (msg) {
            log.debug('Received message from websocket id: %d, msg: %s', id, msg);
        });

        socket.on('pong', function () {
            if (log.trace())
                log.trace('Received pong %d', id);
            if (id in sockets)
                sockets[id].gotPong = true;
        });

        socket.on('error', function (e) {
            log.error(e, 'Error on web socket %d! Closing ...', id);
            closeClient(id);
        });

        socket.on('close', function (code, msg) {
            log.debug('Web socket %d closed with code %d, message: %s. Removing from socket list!', id, code, msg);
            delSocket(id);
        });
    });

    function isOpen(socketId) {
        return socketId in sockets && sockets[socketId].client.readyState == WebSocket.OPEN;
    }

    // ping clients periodically
    function ping() {
        try {
            removeIdle();

            if (log.trace())
                log.trace('Pinging %d clients ...', Object.keys(sockets).length);

            for (var id in sockets) {
                if (!isOpen(id)) {
                    log.warn('Socket is not open %d, closing ...', id);
                    closeClient(id);
                    continue;
                }
                sockets[id].client.ping();
            }
        } catch (e) {
            log.error(e, 'Failed to ping!');
        }
    }

    var that = {
        /**
         * Distributes the message to all the clients.
         */
        distribute: function (msg) {
            if (log.debug())
                log.debug('Distributing message: %s', msg);

            for (var id in sockets) {
                that.send(id, msg);
            }
        },

        send: function (id, msg) {
            try {
                if (!isOpen(id)) {
                    log.warn('Socket is not open %d, closing ...', id);
                    closeClient(id);
                    return;
                }

                if (log.trace())
                    log.trace('Distributing to web socket: %d ...', id);

                sockets[id].client.send(msg);
            } catch (e) {
                log.error(e, 'Exception while distributig message. Web socket ID: %d', id);
            }
        },

        close: function () {
            wss.close();
        }
    }

    setInterval(ping, config.PING_INTERVAL);

    return that;
}
