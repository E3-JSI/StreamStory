var math = require('mathjs');

var fields = require('../fields.js');
var broker = require('./broker.js');
var transform = require('./util/transform.js');
var config = require('../config.js');
var utils = require('./utils.js')

var statistics = qm.statistics;

var base;
var db;

var resamplerInitialized = false;

var opts = { 
	calcCoeff: false,
	coefficientCb: null,
	onValue: null
};

function initResampler() {
	if (resamplerInitialized) return;
	
	var flds = fields.getStreamAggrFields();
	
	// create the resampler used by StreamStory
	base.store(fields.OA_IN_STORE).addStreamAggr({
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
	var flds = fields.getStreamAggrFields();
	var zeroFlds = fields.getInitZeroFields();
	
	// create the merger used for enrichment
	var mergerConfig = {
		type: 'stmerger',
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
	
	// insert zeros now, so they won't get resampled
	var startTm = 100000;
	for (var i = 0; i < zeroFlds.length; i++) {
		var name = zeroFlds[i];
		
		log.info('Initializing default value for store %s ...', name);
							
		var val = {
			time_ms: startTm,
			time: utils.dateToQmDate(new Date(startTm)),
			value: 0
		};
		
		log.info('Initializing store %s ...', name);
		log.info('Inserting value %s ...', JSON.stringify(val));
		
		base.store(name).push(val);
	} 
	
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
	
	for (var i = 0; i < stores.length; i++) {
		var storeJson = stores[i];
		var storeName = storeJson.storeName;
		
		var store = base.store(storeName);
		
		log.info('Initializing store %s ...', JSON.stringify(store));
				
		// garbagge collector for the stores that have a window
		if (storeJson.window != null) {
			log.info('Adding GC trigger to store %s ...', storeName);
			
			store.addTrigger({
				onAdd: function (val) {
					try {
						if (val.$store.length >= config.GC_INTERVAL) {
							if (log.debug())
								log.debug('Store %s triggered GC ...', val.$store.name);
							base.garbageCollect();
						}
					} catch (e) {
						log.error(e, 'Exception while checking GC!');
					}
				}
			});
		}
		
		log.info('Adding print trigger to store %s ...', storeName);
		
		// print statistics on all the stores
		store.addTrigger({
			onAdd: function (val) {
				try {
					var len = val.$store.length;
					
					if (len % config.STORE_PRINT_INTERVAL == 0 && log.debug()) 
						log.debug('Store %s has %d records ...', val.$store.name, len);
					
					if (log.trace())
						log.trace('%s: %s', val.$store.name, JSON.stringify(val));
				} catch (e) {
					log.error(e, 'Exception while printing store statistics!');
				}
			}
		})
	}
	
	log.info('GC initialized!');
}

function calcFriction() {
	var oaInStore = base.store(fields.OA_IN_STORE);
	
	// compute the friction coefficient
	var BUFF_SIZE = 1;
	var EXPONENTIAL_FIT = false;
	var buff = new utils.RecBuffer(BUFF_SIZE);
	
	var CALC_START_THRESHOLD = 7;//1000;				TODO Mihas units???
//	const CALC_START_THRESHOLD = 1000;
	var MIN_DRILL_TIME = 1000*60*10;	// 10mins
	var DEFAULT_COEFF = 0;
	
//	const Q = 600000; //gearbox
	var Q = 1;
	
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
	
	var recN = 0;
	
	function addToBuff(val) {
		buff.unshift(val);
		while (buff.length > BUFF_SIZE) 
			buff.pop();
	}
	
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
		var y = coeff;
		var yHat;
		if (type == 'linear') {
			yHat = alpha[0] + temp*alpha[1];
		} else {
			yHat = alpha[0] * math.exp(alpha[1] * temp)
		}
		
		var residual = coeff - yHat;
		var zScore = statistics.getZScore(coeff, yHat, dist_std);
		var pVal = statistics.studentCdf(coeff, yHat, dist_std, 2);
		
		if (log.debug())
			log.debug('use-case=%s, mean: %d, std: %d, coeff: %d', useCase, yHat, dist_std, coeff);
		if (log.info())
			log.info('Residual: use-case=%s, %d, z=%d, p=%d, time=%d', useCase, residual, zScore, pVal, time);

		if (opts.coefficientCb != null) {
			opts.coefficientCb({
				eventId: useCase,
				time: time,
				zScore: zScore
			});
		} else {
			log.warn('Coefficient callback is not defined!');
		}
	}
	
	function checkOutlierSwivel(coeff, temp, time) {
		if (log.debug())
			log.debug('Checking swivel coefficient outlier ...');
		
		if (EXPONENTIAL_FIT) {
			checkOutlier(coeff, temp, LINREG_ALPHA_SWIVEL_EXP, MEAN_SWIVEL_EXP, STD_SWIVEL_EXP, time, 'swivel', 'exp');
		} else {
			checkOutlier(coeff, temp, LINREG_ALPHA_SWIVEL, MEAN_SWIVEL, STD_SWIVEL, time, 'swivel', 'linear');
		}
	}
	
	function checkOutlierGearbox(coeff, temp, time) {
		if (log.debug())
			log.debug('Checking gearbox coefficient outlier ...');
		
		if (EXPONENTIAL_FIT) {
			checkOutlier(coeff, temp, LINREG_ALPHA_GEARBOX_EXP, MEAN_GEARBOX_EXP, STD_GEARBOX_EXP, time, 'gearbox', 'exp');
		} else {
			checkOutlier(coeff, temp, LINREG_ALPHA_GEARBOX, MEAN_GEARBOX, STD_GEARBOX, time, 'gearbox', 'linear');
		}
	}
	
	function startCalc(val) {
		isCalculating = true;
		startTime = val.time.getTime();
		log.info('Starting calculation of the friction coefficient, time=%d ...', startTime);
	}
	
	function finishCalc(val) {
		if (val.time.getTime() - startTime > MIN_DRILL_TIME) {
			log.info('Finishing calculation of the friction coefficient ...');
			if (log.debug())
				log.debug('Storing %d values ...', coeffBuff.length);
			
			var coeffStore = base.store(fields.COEFF_STORE);
			
			var firstVal = coeffBuff[0];
			var lastVal = coeffBuff[coeffBuff.length-1];
			
			var intervalStart = firstVal.timestamp;
			var intervalEnd = lastVal.timestamp;
			
			for (var i = 0; i < coeffBuff.length; i++) {
				var coeffInfo = coeffBuff[i];
				
				coeffStore.push({
					timestamp: utils.dateToQmDate(coeffInfo.timestamp),
					coeff_swivel: coeffInfo.coeffSwivel,
					coeff_gearbox: coeffInfo.coeffGearbox,
					interval_start: utils.dateToQmDate(intervalStart),
					interval_end: utils.dateToQmDate(intervalEnd)
				});
			}
			
			if (log.debug())
				log.debug('Stored coefficients!');
			
			var coeffSwivel = lastVal.coeffSwivel;
			var coeffGearbox = lastVal.coeffGearbox;
			
			log.info('Coeffs: (swivel: %d, gearbox: %d) at time %s', coeffSwivel, coeffGearbox, val.time.toISOString());
			
			var avgTempSwivel = (firstVal.tempSwivel + lastVal.tempSwivel) / 2;
			var avgTempGearbox = (firstVal.tempGearbox + lastVal.tempGearbox) / 2;
			
			checkOutlierSwivel(coeffSwivel, avgTempSwivel, intervalEnd);
			checkOutlierGearbox(coeffGearbox, avgTempGearbox, intervalEnd);
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
				
				var rpm = val.rpm / (60.0 * 1000);// / 60.0;	TODO should 1000 be here Mihas? units???
//				var rpm = val.rpm / 60.0;
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
				
				if (isCalculating && time - rpmStartTime > 1000*60*5) {	// only start the calculation after 3 minutes
					recN++;
					
					// variables
					var prevTime = prevVal.time.getTime();//		TODO Mihas units???
//					var time = val.time.getTime() / 1000.0;
//					var prevTime = prevVal.time.getTime() / 1000.0;
					
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
	var enricherOutStore = base.store(fields.ENRICHED_STORE);
	var oaInStore = base.store(fields.OA_IN_STORE);
	var streamStoryStore = base.store(fields.STREAM_STORY_STORE);

	// add processing triggers
	log.info('Initilizing triggers ...');
	
	// print progress
	{
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
						if (config.USE_BROKER) {
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
	}
	
	{	// StreamStory
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
	}
	
	if (config.USE_CASE == config.USE_CASE_MHWIRTH)
		calcFriction();
	
	log.info('Triggers initialized!');
}

exports.insertRaw = function (storeNm, val) {
	base.store(storeNm).push(val);
	
	// if we initialize all stores with zeros, then the resampler should be
	// initialized only after at least a single value has gone through the merger
	// otherwise, the resampler will resample from 1970
	if (!resamplerInitialized)
		initResampler();
}

exports.onCoefficient = function (cb) {
	opts.coefficientCb = cb;
	log.info('Coefficient callback defined!');
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
