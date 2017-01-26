/* jshint node: true */
/* globals qm, log */

var math = require('mathjs');

var fields = require('../fields.js');
var broker = require('./broker.js');
var transform = require('./util/transform.js');
var config = require('../config.js');
var utils = require('./utils.js')

var statistics = qm.statistics;

var base;
var db;

var enricherOutStore;
var oaInStore;
var streamStoryStore;

var resamplerInitialized = false;

var opts = {
    calcCoeff: false,
    coefficientCb: null,
    onValue: null
};

var enricherAggH = {};
var oaInAggregates = {};

function initResampler() {
    if (resamplerInitialized) return;

    var flds = fields.getStreamAggrFields(base);

    // create the resampler used by StreamStory
    oaInStore.addStreamAggr({
        type: 'resampler',
        name: 'drilling_resampler',
        outStore: fields.STREAM_STORY_STORE,
        createStore: false,
        timestamp: 'time',
        interval: config.STREAM_STORY_RESAMPLING_INTERVAL,	// 1 min
        fields: flds.resampler
    });
    resamplerInitialized = true;
}

function initStreamAggregates() {
    // create fields
    var flds = fields.getStreamAggrFields(base);
    var zeroFlds = fields.getInitZeroFields();

    // create the merger used for enrichment
    (function () {
        var mergerConfig = {
            type: 'merger',
            name: 'drilling_merger',
            outStore: fields.ENRICHED_STORE,
            createStore: false,
            timestamp: 'time',
            fields: flds.merger
        };

        if (config.INTERPOLATION == 'current') {
            mergerConfig.onlyPast = true;
        }

        new qm.StreamAggr(base, mergerConfig);
    })();

    // insert zeros now, so they won't get resampled
    (function () {
        log.info('Initializing default values for stores ...');

        var startTm = 0;
        for (var i = 0; i < zeroFlds.length; i++) {
            var name = zeroFlds[i];

            log.trace('Initializing default value for store %s ...', name);

            var val = {
                time_ms: startTm,
                time: utils.dateToQmDate(new Date(startTm)),
                value: 0
            };

            log.trace('Initializing store %s ...', name);
            if (log.trace())
                log.trace('Inserting value %s ...', JSON.stringify(val));

            base.store(name).push(val);
        }
    })();

    (function () {
        log.info('Initializing Enricher stream aggregates ...');
        var aggregates = fields.getEnricherStreamAggregates();
        for (var aggrNm in aggregates) {
            if (log.trace())
                log.trace('Initializing aggregate: %s', aggrNm);

            var aggrConf = aggregates[aggrNm];

            var aggr;
            if (aggrConf.aggr.type != 'javaScript') {
                oaInStore.addStreamAggr(aggrConf.tick);
                aggr = enricherOutStore.addStreamAggr(aggrConf.aggr);
            } else {
                aggr = enricherOutStore.addStreamAggr(aggrConf.aggr.create());
            }

            enricherAggH[aggrNm] = aggr;
        }
    })();

    (function () {
        log.info('Initializing Online Analytics stream aggregates ...');
        var aggregateConfigs = fields.getStreamAggregates();
        for (var aggrNm in aggregateConfigs) {
            if (log.trace())
                log.trace('Initializing aggregate: %s', aggrNm);

            var aggrConf = aggregateConfigs[aggrNm];

            var aggr;
            if (aggrConf.aggr.type != 'javaScript') {
                oaInStore.addStreamAggr(aggrConf.tick);
                aggr = oaInStore.addStreamAggr(aggrConf.aggr);
            } else {
                aggr = oaInStore.addStreamAggr(aggrConf.aggr.create());
            }

            oaInAggregates[aggrNm] = aggr;
        }
    })();

    if (zeroFlds.length == 0) {
        // if we initialize all stores with zeros, then the resampler should be
        // initialized only after at least a single value has gone through the merger
        // otherwise, the resampler will resample from 1970
        initResampler();
    }
}

function initGC() {
    // add triggers for garbagge collection
    log.info('Initilizing garbagge collection ...');

    var stores = base.getStoreList();

    function gcaggr(store) {
        return {
            onAdd: function () {
                try {
                    if (store.length >= config.GC_INTERVAL) {
                        if (log.debug())
                            log.debug('Store %s triggered GC ...', store.name);
                        base.garbageCollect();
                    }
                } catch (e) {
                    log.error(e, 'Exception while checking GC!');
                }
            }
        }
    }

    function loggerAggr(store) {
        return {
            onAdd: function () {
                try {
                    var len = store.length;
                    if (len % config.STORE_PRINT_INTERVAL == 0 && log.debug())
                        log.debug('Store %s has %d records ...', store.name, len);
                } catch (e) {
                    log.error(e, 'Exception while printing store statistics!');
                }
            }
        }
    }

    for (var i = 0; i < stores.length; i++) {
        var storeJson = stores[i];
        var storeName = storeJson.storeName;

        var store = base.store(storeName);

        if (log.trace())
            log.trace('Initializing store %s ...', store.name);

        // garbagge collector for the stores that have a window
        if (storeJson.window != null) {
            if (log.trace())
                log.trace('Adding GC trigger to store %s ...', storeName);

            store.addTrigger(gcaggr(store));
        }

        if (log.trace())
            log.trace('Adding print trigger to store %s ...', storeName);

        // print statistics on all the stores
        try {
            store.addTrigger(loggerAggr(store));
        } catch (e) {
            log.error(e, 'Failed to add print trigger to store: %s', storeName);
        }
    }

    log.info('GC initialized!');
}

function calcFriction() {
    // compute the friction coefficient
    var BUFF_SIZE = 1;
    var EXPONENTIAL_FIT = true;
    var buff = new utils.RecBuffer(BUFF_SIZE);

    var CALC_START_THRESHOLD = 7;
    //	const CALC_START_THRESHOLD = 1000;
    var MIN_DRILL_TIME = 1000*60*8;	// 8mins
    var DEFAULT_COEFF = 0;

    //	const Q = 600000; //gearbox
    var Q = 1;
    var outputQ = 600000;

    var MEAN_SWIVEL = 0;
    var MEAN_SWIVEL_EXP = 0;
    var STD_SWIVEL = 5.3808e-09;
    var STD_SWIVEL_EXP = 5.3138e-09;
    var COOLING_ALPHA_SWIVEL = [-1.3, 6.5e-08];
    var LINREG_ALPHA_SWIVEL = [3.445e-08, -4.884e-10];
    var LINREG_ALPHA_SWIVEL_EXP = [4.445e-08, -0.02771];

    var MEAN_GEARBOX = 0;
    var MEAN_GEARBOX_EXP = 0;
    var STD_GEARBOX = 1.1589e-08;
    var STD_GEARBOX_EXP = 1.1634e-08;
    //	var COOLING_ALPHA_GEARBOX = [-1.1, 1.196889526367186e-07];	// file 2015-37
    var COOLING_ALPHA_GEARBOX = [-2.1, 1.5e-07];
    var LINREG_ALPHA_GEARBOX = [2.18613087894122e-08, 7.31514680122367e-11];
    var LINREG_ALPHA_GEARBOX_EXP = [2.87e-08, -0.004355];

    // variables needed to calculate the friction
    var energyGain = 0;
    var energyLostSwivel = 0;
    var energyLostGearbox = 0;
    var swivelTempGain = 0;
    var gearboxTempGain = 0;
    var coeffSwivel = 0;
    var coeffGearbox = 0;

    var coeffBuff = [];

    var isCalculating = false;
    var startTime = 0;
    var prevEvalTime = 0;

    var recN = 0;

    function resetVars() {
        buff.clear();

        energyGain = 0;
        energyLostSwivel = 0;
        energyLostGearbox = 0;
        swivelTempGain = 0;
        gearboxTempGain = 0;
        coeffSwivel = 0;
        coeffGearbox = 0;

        coeffBuff = [];

        isCalculating = false;
        startTime = 0;
        prevEvalTime = 0;

        recN = 0;
    }

    function setDefaultVals(rec) {
        rec.coeff_swivel = DEFAULT_COEFF;
        rec.coeff_gearbox = DEFAULT_COEFF;
    }

    function getTempLoss(deltaT, dt, alpha) {
        return (deltaT - alpha[0]) * (1 - Math.exp(-alpha[1]*dt));
    }

    function getSwivelTempLoss(deltaT, dt) {
        return getTempLoss(deltaT, dt, COOLING_ALPHA_SWIVEL);
    }

    function getGearboxTempLoss(deltaT, dt) {
        return getTempLoss(deltaT, dt, COOLING_ALPHA_GEARBOX);
    }

    function checkOutlier(coeff, temp, alpha, dist_mean, dist_std, time, useCase, type) {
        var yHat;
        if (type == 'linear') {
            yHat = alpha[0] + temp*alpha[1];
        } else {
            yHat = alpha[0] * math.exp(alpha[1] * temp)
        }

        var residual = coeff - yHat;
        var zScore = statistics.getZScore(coeff, yHat, dist_std);
        //		var pVal = statistics.studentCdf(coeff, yHat, dist_std, 2);
        var pVal = statistics.studentCdf((coeff - yHat) / dist_std, 1);

        if (log.debug())
            log.debug('use-case=%s, mean: %d, std: %d, coeff: %d', useCase, yHat, dist_std, coeff);
        if (log.info())
            log.info('Residual: use-case=%s, %d, z=%d, p=%d, time=%d', useCase, residual, zScore, pVal, time);

        var opts = {
            eventId: useCase,
            time: time,
            zScore: zScore,
            value: coeff*outputQ,
            std: dist_std*Math.abs(outputQ)
        }

        if (opts.coefficientCb != null) {
            opts.coefficientCb(opts);
        } else {
            log.warn('Coefficient callback is not defined!');
        }

        return opts;
    }

    function checkOutlierSwivel(coeff, temp, time) {
        if (log.debug())
            log.debug('Checking swivel coefficient outlier ...');

        if (EXPONENTIAL_FIT) {
            return checkOutlier(coeff, temp, LINREG_ALPHA_SWIVEL_EXP, MEAN_SWIVEL_EXP, STD_SWIVEL_EXP, time, 'swivel', 'exp');
        } else {
            return checkOutlier(coeff, temp, LINREG_ALPHA_SWIVEL, MEAN_SWIVEL, STD_SWIVEL, time, 'swivel', 'linear');
        }
    }

    function checkOutlierGearbox(coeff, temp, time) {
        if (log.debug())
            log.debug('Checking gearbox coefficient outlier ...');

        if (EXPONENTIAL_FIT) {
            return checkOutlier(coeff, temp, LINREG_ALPHA_GEARBOX_EXP, MEAN_GEARBOX_EXP, STD_GEARBOX_EXP, time, 'gearbox', 'exp');
        } else {
            return checkOutlier(coeff, temp, LINREG_ALPHA_GEARBOX, MEAN_GEARBOX, STD_GEARBOX, time, 'gearbox', 'linear');
        }
    }

    function startCalc(val) {
        isCalculating = true;
        startTime = val.time.getTime();
        log.info('Starting calculation of the friction coefficient, time=%d ...', startTime);
    }

    function checkFrictionCoeffs(val, save) {
        try {
            var firstVal = coeffBuff[0];
            var lastVal = coeffBuff[coeffBuff.length-1];

            var intervalStartTm = firstVal.timestamp;
            var intervalEndTm = lastVal.timestamp;

            var coeffSwivel = lastVal.coeffSwivel;
            var coeffGearbox = lastVal.coeffGearbox;

            var avgTempSwivel = (firstVal.tempSwivel + lastVal.tempSwivel) / 2;
            var avgTempGearbox = (firstVal.tempGearbox + lastVal.tempGearbox) / 2;

            if (log.debug())
                log.debug('Coeffs: (swivel: %d, gearbox: %d) at time %s', coeffSwivel, coeffGearbox, val.time.toISOString());

            var swivelResult = checkOutlierSwivel(coeffSwivel, avgTempSwivel, intervalEndTm);
            var gearboxResult = checkOutlierGearbox(coeffGearbox, avgTempGearbox, intervalEndTm);

            if (save && config.SAVE_FRICTION) {
                utils.outputLine('friction-coeff.txt', JSON.stringify({
                    start: intervalStartTm,
                    end: intervalEndTm,
                    gearbox: gearboxResult,
                    swivel: swivelResult
                    // gearbox: {
                    //     value: coeffGearbox * outputQ,
                    //     meanTemperature: avgTempGearbox
                    // },
                    // swivel: {
                    //     value: coeffSwivel * outputQ,
                    //     meanTemperature: avgTempSwivel
                    // }
                }));
            }
        } catch (e) {
            log.error(e, 'Failed to check friction coefficients!');
        }
    }

    function finishCalc(val) {
        if (val.time.getTime() - startTime > MIN_DRILL_TIME) {
            if (log.info())
                log.info('Finishing calculation of the friction coefficient ...');

            checkFrictionCoeffs(val, true);
        } else {
            log.info('Drilling didn not take long enough, the coefficient will be ignored!');
        }

        resetVars();
    }

    var rpmStartTime = 0;

    // compute the friction coefficient
    oaInStore.addTrigger({
        onAdd: function (val) {
            try {
                if (!opts.calcCoeff) {
                    setDefaultVals(val);
                    return;
                }

                var prevVal = buff.getLast();
                buff.add(val);

                if (prevVal == null) {
                    setDefaultVals(val);
                    return;
                }

                var rpm = val.rpm / (60.0 * 1000);
                var torque = val.torque * 1000;
                var time = val.time.getTime();

                if (isCalculating && rpm * torque < CALC_START_THRESHOLD) {
                    rpmStartTime = 0;
                    finishCalc(val);
                }

                if (!isCalculating && rpm * torque >= CALC_START_THRESHOLD) {
                    rpmStartTime = time;
                    startCalc(val);
                }

                if (isCalculating && time - rpmStartTime > 1000*60*5) {	// only start the calculation after 5 minutes
                    recN++;

                    // variables
                    var prevTime = prevVal.time.getTime();//		TODO Mihas units???

                    var tempAmbient = val.temp_ambient;

                    // calculation
                    var dt = time - prevTime;
                    var deltaSwivelT = val.oil_temp_swivel - prevVal.oil_temp_swivel;
                    var deltaGearboxT = val.oil_temp_gearbox - prevVal.oil_temp_gearbox;

                    var inputPower = 2*Math.PI*torque*rpm;

                    energyLostSwivel += Q * getSwivelTempLoss(val.oil_temp_swivel - tempAmbient, dt);
                    energyLostGearbox += Q * getGearboxTempLoss(val.oil_temp_gearbox - tempAmbient, dt);

                    energyGain += inputPower * dt;

                    swivelTempGain += deltaSwivelT;
                    gearboxTempGain += deltaGearboxT;

                    coeffSwivel = (swivelTempGain*Q + energyLostSwivel) / energyGain;
                    coeffGearbox = (gearboxTempGain*Q + energyLostGearbox) / energyGain;

                    if (!utils.isFinite(coeffSwivel) || !utils.isFinite(coeffGearbox)) {
                        log.fatal('One of the coefficients is infinite: (swivel:' + coeffSwivel + ', gearbox: ' + coeffGearbox + ')!');
                        utils.exit(3);
                    }

                    coeffBuff.push({
                        timestamp: val.time,
                        coeffSwivel: coeffSwivel,
                        coeffGearbox: coeffGearbox,
                        tempAmbient: tempAmbient,
                        tempSwivel: val.oil_temp_swivel,
                        tempGearbox: val.oil_temp_gearbox
                    });

                    val.coeff_swivel = coeffSwivel;
                    val.coeff_gearbox = coeffGearbox;

                    if (log.debug() && recN % config.COEFF_PRINT_INTERVAL == 0)
                        log.debug('Current friction coefficients: (swivel: %d, gearbox: %d)', coeffSwivel, coeffGearbox);

                    // evaluate the friction coefficients every 10 minutes of drilling
                    if (prevEvalTime == 0) {
                        prevEvalTime = time;
                    }
                    else if (time - prevEvalTime > 1000*60*15) {	// evaluate the coefficient every 10 minutes
                        if (log.debug())
                            log.debug('Periodic coefficient check ...');

                        checkFrictionCoeffs(val, false);
                        prevEvalTime = time;
                    }
                }
                else {
                    setDefaultVals(val);
                }
            } catch (e) {
                log.error(e, 'Exception while computing the friction coefficient!');
                setDefaultVals(val);
            }
        }
    });
}

function initTriggers() {
    // add processing triggers
    log.info('Initilizing triggers ...');

    (function () {
        var nreceived = 0;

        enricherOutStore.addTrigger({
            onAdd: function (rec) {
                if (log.trace() && nreceived % 100 == 0)
                    log.trace('Received %d records in Enricher out store ...', nreceived);

                for (var fieldNm in enricherAggH) {
                    rec[fieldNm] = enricherAggH[fieldNm].getFloat();
                }
            }
        });
    })();

    (function () {
        var prevTime = 0;
        var nProcessed = 0;

        enricherOutStore.addTrigger({
            onAdd: function (val) {
                nProcessed++;
                try {
                    var outVal = val.toJSON(false, false, false);

                    var currTime = val.time.getTime();

                    if (currTime < prevTime)
                        throw new Error('enricherOutStore.addTrigger: Current time lower than previous time: ' + utils.dateToQmDate(new Date(currTime)) + ' < ' + utils.dateToQmDate(new Date(prevTime)));

                    if (resamplerInitialized) {
                        if (false/*config.USE_BROKER*/) {	// TODO uncomment this !important
                            broker.send(broker.ENRICHED_DATA_PRODUCER_TOPIC, JSON.stringify(transform.toDerivedEvent(currTime, outVal)));
                        } else {
                            outVal.time = utils.dateToQmDate(val.time);
                            oaInStore.push(outVal);
                        }
                    }

                    prevTime = currTime;
                } catch (e) {
                    log.error(e, 'Failed to send enriched data!');
                }
            }
        });
    })();

    (function () {
        var nreceived = 0;
        oaInStore.addTrigger({
            onAdd: function (rec) {
                if (log.trace() && nreceived % 100 == 0)
                    log.trace('Received %d records in OA in store ...', nreceived);

                for (var fieldNm in oaInAggregates) {
                    var aggr = oaInAggregates[fieldNm];
                    var val = aggr.getFloat();
                    rec[fieldNm] = val;
                }
            }
        });
    })();

    (function () {
        var nProcessed = 0;

        streamStoryStore.addTrigger({
            onAdd: function (val) {
                nProcessed++;
                try {
                    if (nProcessed % config.STREAM_STORY_PRINT_INTERVAL == 0 && log.debug())
                        log.debug('Store %s has %d records ...', val.$store.name, val.$store.length);

                    if (config.USE_CASE == config.USE_CASE_MHWIRTH &&
                        (isNaN(val.coeff_swivel) || isNaN(val.coeff_gearbox))) {
                            log.fatal('Resampled store: the friction coefficient is NaN! Store size: %d, friction store size: %d', streamStoryStore.length, oaInStore.length);
                            process.exit(2);
                        }

                    if (opts.onValue != null)
                        opts.onValue(val);
                } catch (e) {
                    log.error(e, 'Exception while printing statistics of the resampled store!');
                }
            }
        });
    })();

    if (config.USE_CASE == config.USE_CASE_MHWIRTH)
        calcFriction();

    log.info('Triggers initialized!');
}

exports.insertRaw = function (storeNm, val) {
    if (storeNm == null) throw new Error('Store name is undefined!');

    var store = base.store(storeNm);

    if (store == null) throw new Error('Could not find store with name: ' + storeNm);

    store.push(val);

    // if we initialize all stores with zeros, then the resampler should be
    // initialized only after at least a single value has gone through the merger
    // otherwise, the resampler will resample from 1970
    if (!resamplerInitialized)
        initResampler();
}

exports.onCoefficient = function (cb) {
    opts.coefficientCb = cb;
    log.info('Coefficient outlier callback defined!');
}

exports.onValue = function (cb) {
    opts.onValue = cb;
    log.info('Registered StreamStory store callback ...');
}

exports.setCalcCoeff = function (calc) {
    opts.calcCoeff = calc;

    if (opts.calcCoeff)
        log.info('From now on calculating the coefficient ...');
    else
        log.info('Not calculating the coefficient anymore!');
}

exports.init = function (opts) {
    base = opts.base;
    db = opts.db;

    enricherOutStore = base.store(fields.ENRICHED_STORE);
    oaInStore = base.store(fields.OA_IN_STORE);
    streamStoryStore = base.store(fields.STREAM_STORY_STORE);

    initTriggers();
    initStreamAggregates();
    initGC();

    log.debug('Fetching the status of friction coeff calcualtion ...');
    db.getConfig('calc_coeff', function (e, result) {
        if (e != null) {
            log.error(e, 'Failed to fetch the status of the friction coefficient calculation!');
            return;
        }
        if (result == null) {
            log.warn('Friction coefficient calculation status not present in the DB! Will not calculate!');
            return;
        }
        exports.setCalcCoeff(result.value == 'true');
    });
};
