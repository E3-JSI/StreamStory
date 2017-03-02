let assert = require('assert');

let utils = require('./utils/testutils');

// set the necessary global variables
global.log = new utils.MockLogger();

let ModelManager = require('../src/ssmodules').ModelManager;
let MockModel = utils.MockModel;

class MockModelStore {
    constructor() {
        this._models = {};
    }

    add(model) {
        this._models[model.getId()] = model;
    }

    remove(model) {
        delete this._models[model.getId()];
    }

    hasModel(model) {
        return model.getId() in this._models;
    }
}

class MockDb {
    constructor() {

    }
}

describe('Model Manager', function () {
    it('should activate and deactivate the model', function () {
        let store = new MockModelStore();
        let manager = new ModelManager({
            db: new MockDb(),
            modelStore: store
        })
        let model = new MockModel();

        manager.activate(model);

        assert(model.active);
        assert(store.hasModel(model));

        manager.deactivate(model);

        assert(!model.active, 'The model was not deactivated!');
        assert(!store.hasModel(model));
    })

    it('should activate and fire events and then deactivate', function () {
        let manager = new ModelManager({
            db: new MockDb(),
            modelStore: new MockModelStore()
        })
        let model = new MockModel();

        let param1 = 1,
            param2 = 2;

        let counts = {
            stateChanged: 0,
            anomaly: 0,
            outlier: 0,
            prediction: 0,
            activity: 0
        }

        let genHandler = function (event) {
            return function (p1, p2) {
                assert(this == model);
                assert(p1 == param1, 'Did not pass parameter 1 to the handler!');
                assert(p2 == param2, 'Did not pass parameter 2 to the handler!');
                counts[event]++;
            }
        }

        manager.activate(model);

        for (let event in counts) {
            manager.on(event, genHandler(event));
        }

        for (let event in counts) {
            model.fire(event, [param1, param2]);
            assert.equal(counts[event], 1, 'Did not fire the event handler!');
        }

        manager.deactivate(model);

        for (let event in counts) {
            model.fire(event, [param1, param2]);
            assert.equal(counts[event], 1, 'Fired an event handler even though it was deactivated!');
        }
    })
})
