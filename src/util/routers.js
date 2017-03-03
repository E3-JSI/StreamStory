let assert = require('assert');

class HttpRequestRouter {
    constructor(opts) {
        let self = this;

        if (opts.extractRoute == null) throw new Error('Extract route is NULL!');
        if (opts.onError == null) throw new Error('Missing error callback!');

        self._extractRoute = opts.extractRoute;
        self._handleError = opts.onError;
        self._routes = {};
    }

    route(req, res) {
        let self = this;
        let route = self._extractRoute(req, res);
        let method = req.method;
        let handlers = self._getHandlers(route, method);
        try {
            for (let handler of handlers) {
                handler(req, res);
            }
        } catch (e) {
            self._handleError(e, req, res);
        }
    }

    register(route, method, handler) {
        let self = this;
        if (!self._isRegistered(route)) {
            self._routes[route] = {
                get: [],
                post: []
            };
        }
        self._routes[route][method.toLowerCase()].push(handler);
    }

    _isRegistered(route) {
        return route in this._routes;
    }

    _getHandlers(route, method) {
        let self = this;
        let methodLc = method.toLowerCase();
        assert(self._isRegistered(route), 'Route ' + route + ' is not registered!');
        assert(methodLc == 'get' || methodLc == 'post', 'Invalid mehtod: ' + method);
        let handlers = self._routes[route][methodLc];
        return handlers;
    }

    static wrap(router) {
        return function (req, res) {
            router.route(req, res);
        }
    }
}

exports.HttpRequestRouter = HttpRequestRouter;
