let assert = require('assert');

let HttpUtils = require('../src/ssmodules').HttpUtils;
let utils = require('./utils/testutils');

class MockRequest {
    constructor(opts) {
        this.path = opts.path;
    }
}

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
