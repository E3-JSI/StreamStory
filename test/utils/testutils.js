let currModelId = 0;
let currBaseId = 0;

class MockLogger {
    debug() {}
    log() {}
    info() {}
    error(e, msg) {
        console.error(e);
        console.error(msg);
    }
}

class MockModel {
    constructor() {
        this._id = currModelId++;
        this._active = false;
        this._handlers = {
            stateChanged: function () {},
            anomaly: function () {},
            outlier: function () {},
            prediction: function () {},
            activity: function () {}
        }
    }
    getId() {
        return this._id;
    }
    getModel() {
        return this;
    }
    setActive(active) {
        this._active = active;
    }

    //============================================
    // EVENTS
    //============================================

    onStateChanged(callback) {
        this._handlers.stateChanged = callback != null ? callback : function () {};
    }
    onAnomaly(callback) {
        this._handlers.anomaly = callback != null ? callback : function () {};
    }
    onOutlier(callback) {
        this._handlers.outlier = callback != null ? callback : function () {};
    }
    onPrediction(callback) {
        this._handlers.prediction = callback != null ? callback : function () {};
    }
    onActivity(callback) {
        this._handlers.activity = callback != null ? callback : function () {};
    }

    fire(event, params) {
        let self = this;
        let handler = self._handlers[event];
        handler.apply(handler, params);
    }

    //============================================
    // INSPECT STATE
    //============================================

    get active() {
        return this._active;
    }
}

class MockBase {
    constructor() {
        this._id = currBaseId++;
        this._closed = false;
    }

    isClosed() {
        return this._closed;
    }

    close() {
        this._closed = true;
    }

    //============================================
    // INSPECT STATE
    //============================================

    get id() {
        return this._id;
    }
}

exports.MockLogger = MockLogger;
exports.MockModel = MockModel;
exports.MockBase = MockBase;
