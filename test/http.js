let assert = require('assert');

let HttpUtils = require('../src/ssmodules').HttpUtils;
let utils = require('./utils/testutils');
let routers = require('../src/util/routers');

class MockRequest {
    constructor(opts) {
        this.path = opts.path;
    }
}

describe('http router', function () {
    it('should route correctly', function () {
        let helloCounter = 0;
        let worldCounter = 0;
        let errorCalled = false;

        let router = new routers.HttpRequestRouter({
            extractRoute: (req) => req.params.api,
            onError: function () {
                errorCalled = true;
            }
        })

        router.register('hello', 'post', function (req, res) {
            assert(req != null, 'Did not pass request to function!');
            assert(res != null, 'Did not pass response to function!');
            helloCounter++;
        })

        router.register('world', 'get', function (req, res) {
            assert(req != null, 'Did not pass request to function!');
            assert(res != null, 'Did not pass response to function!');
            worldCounter++;
        })

        // fire events
        let res = {};
        let req1 = {
            params: {
                api: 'hello'
            },
            method: 'post'
        }
        let req2 = {
            params: {
                api: 'hello'
            },
            method: 'get'
        }
        let req3 = {
            params: {
                api: 'world'
            },
            method: 'post'
        }
        let req4 = {
            params: {
                api: 'world'
            },
            method: 'get'
        }

        // call the router
        router.route(req1, res);
        router.route(req2, res);
        router.route(req3, res);
        router.route(req4, res);

        assert.equal(helloCounter, 1, 'Invalid number of calls to \'hello\'');
        assert.equal(worldCounter, 1, 'Invalid number of calls to \'world\'');
        assert(!errorCalled, 'An error ocurred while routing!');
    })

    it('should throw because no handler is registered', function () {
        let router = new routers.HttpRequestRouter({
            extractRoute: (req) => req.params.api,
            onError: function () {
            }
        })

        router.register('hello', 'post', function () {
        })
        // fire events
        let res = {};
        let req1 = {
            params: {
                api: 'I kill you'
            },
            method: 'post'
        }

        // call the router
        assert.throws(function () {
            router.route(req1, res);
        })
    })

    it('should throw an exception because of missing argument', function () {
        assert.throws(function () {
            new routers.HttpRequestRouter({
                extractRoute: (req) => req.params.api,
            })
        })
        assert.throws(function () {
            new routers.HttpRequestRouter({
                onError: function () {
                }
            })
        })
    })
})

describe('http utilities', function () {
    it('should exptract correct htm page from full URL', function () {
        let reqHtml = new MockRequest({
            path: 'http://www.google.com/hello/world.html'
        })
        let reqEjs = new MockRequest({
            path: 'http://www.google.com/hello.ejs'
        })
        let reqHttps = new MockRequest({
            path: 'https://www.google.com/hello/world.html'
        })
        assert.equal(HttpUtils.getRequestedPage(reqHtml), 'world.html');
        assert.equal(HttpUtils.getRequestedPage(reqEjs), 'hello.ejs');
        assert.equal(HttpUtils.getRequestedPath(reqHtml), 'hello');
        assert.equal(HttpUtils.getRequestedPath(reqEjs), '');
        assert.equal(HttpUtils.getRequestedPath(reqHttps), 'hello');
    })

    it('should save model and file to session', function () {
        let sessionId = 0;
        let session = {};
        let base = new utils.MockBase();
        let model = 2;
        let modelId = 3;
        let fname = 'abc';
        HttpUtils.saveModelToSession(0, session, base, model, modelId, fname);

        let extracted = HttpUtils.extractModel(sessionId, session);

        assert(session.base.id == base.id, 'Invalid base stored to session!');
        assert(extracted === model, 'Extracted invalid model from session object!');
        assert.equal(HttpUtils.extractModelFile(session), fname, 'Failed to store model file!');
    })

    it('should cleanup session before replacing the model', function () {
        let sessionId = 0;
        let session = {};
        let base = new utils.MockBase();
        let model = 2;
        let modelId = 3;
        let fname = 'abc';
        HttpUtils.saveModelToSession(sessionId, session, base, model, modelId, fname);

        let extracted = HttpUtils.extractModel(sessionId, session);

        assert(extracted === model, 'Extracted invalid model from session object!');

        let newBase = new utils.MockBase();
        let newModel = 12;
        let newModelId = 13;
        let newFname = 'adsfjsf';
        HttpUtils.saveModelToSession(sessionId, session, newBase, newModel, newModelId, newFname);

        assert(session.base.id == newBase.id, 'Invalid base stored to session!');
        assert(base.isClosed(), 'The old base is not closed!');
    })

    it('should clear the session', function () {
        let sessionId = 0;
        let session = {};
        let base = new utils.MockBase();
        let model = 2;
        let modelId = 3;
        let fname = 'abc';
        HttpUtils.saveModelToSession(sessionId, session, base, model, modelId, fname);
        HttpUtils.loginUser(session, {
            username: 'hello',
            theme: 'world'
        })

        assert(HttpUtils.isLoggedIn(session), 'Did not login the user!');
        assert(HttpUtils.extractModel(sessionId, session) != null, 'Failed to save a model to session!');

        HttpUtils.clearSession(sessionId, session, new utils.MockBase());

        let extracted = HttpUtils.extractModel(sessionId, session);
        assert(extracted == null, 'Did not clear the model from the session!');
        assert.equal(Object.keys(session).length, 0, 'Failed to delete all keys from the session: ' + JSON.stringify(session) + '!');
    })

    it('should clear the model from the session', function () {
        let sessionId = 0;
        let session = {};
        let base = new utils.MockBase();
        let model = 2;
        let modelId = 3;
        let fname = 'abc';
        HttpUtils.saveModelToSession(sessionId, session, base, model, modelId, fname);
        HttpUtils.clearModelFromSession(sessionId, session, new utils.MockBase());

        let extracted = HttpUtils.extractModel(sessionId, session);
        assert(extracted == null, 'Did not clear the model from the session!');
        assert.equal(Object.keys(session).length, 0, 'Did not clear the session completely!');
    })
})
