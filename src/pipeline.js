//var broker = require('./broker.js');
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
	coefficientCb: null
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
	if (config.INITIALIZE_ZERO) {
		var startTm = 100000;
		
		log.info('Initializing default values ...');
		var stores = fields.getRawStores();
		
		for (var i = 0; i < stores.length; i++) {
			var storeConf = stores[i];
			var name = storeConf.name;
			
			if (name == 'hook_load') continue;
			
			var val = {
				time_ms: startTm,
				time: utils.dateToQmDate(new Date(startTm)),
				value: 0
			};
			
			log.info('Initializing store %s ...', name);
			log.info('Inserting value %s ...', JSON.stringify(val));
			
			base.store(name).push(val);
		}
	} else {
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
		var yHat = type == 'exp' ? alpha[0] * math.exp(alpha[1] * temp) :
								   alpha[0] + temp*alpha[1];
		
		var residual = coeff - yHat;
		var zScore = statistics.getZScore(residual, dist_mean, dist_std);
		
		if (log.info())
			log.info('Residual: use-case=%s, %d, z=%d, time=%d', useCase, residual, zScore, time);

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
			
			var avgTemp = (firstVal.tempAmbient + lastVal.tempAmbient) / 2;
			checkOutlierSwivel(coeffSwivel, avgTemp, intervalEnd);
			checkOutlierGearbox(coeffGearbox, avgTemp, intervalEnd);
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
						tempAmbient: tempAmbient 
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
						throw 'enricherOutStore.addTrigger: Current time lower than previous time: ' + utils.dateToQmDate(new Date(currTime)) + ' < ' + utils.dateToQmDate(new Date(prevTime));
					
					if (resamplerInitialized) {
						if (config.USE_BROKER) {
							broker.send(broker.ENRICHED_DATA_PRODUCER_TOPIC, JSON.stringify(transform.toDerivedEvent(currTime, outVal)));
						} else {
							outVal.time = utils.dateToQmDate(val.time);
							oaInStore.push(outVal);
						}
					}
					
					//==========================================================
//					// TODO remove
					
					if (nProcessed % 10 == 0) {
						if (log.debug())
							log.debug('Sending prediction ...');
//						var msg = {"type":"prediction","content":{"time":1387555900212,"currState":6,"targetState":2,"probability":0.13657759234055278,"pdf":{"type":"histogram","probV":,"timeV":}}};
//						var msg1 = {
//							type: 'prediction',
//							content: {
//								time: 1387555900212,
//								pdf: {
//									type: 'exponential',
//									lambda: 2
//								}
//							}
//						};
						
						var probV = [0,0.0016107379534262077,0.004329364048523429,0.007945622266524855,0.012279006233673631,0.0171748694895307,0.022501034236937098,0.028144834617611223,0.03401053883531261,0.04001710164349095,0.0460962049694949,0.05219054988679418,0.05825236787780093,0.06424212344597487,0.07012738371780362,0.07588183379306515,0.08148441931631308,0.0869186001065448,0.09217170074129585,0.09723434578569722,0.10209996892083485,0.10676438658902047,0.11122542796234072,0.11548261407770369,0.11953687988619112,0.12339033375391804,0.12704604964064847,0.1305078877840153,0.13378034024257604,0.13686839810986404,0.13977743761256933,0.14251312265641003,0.14508132168955223,0.1474880370212438,0.14973934496751873,0.1518413454006502,0.15380011945822522,0.1556216943244775,0.1573120141337288,0.15887691616584387,0.1603221116087112,0.16165317025477002,0.16287550857914213,0.16399438071745978,0.1650148719232143,0.16594189413851668,0.16678018335948736,0.16753429851895216,0.16820862164535083,0.168807359088581,0.16933454363122835,0.16979403732798415,0.17018953493730332,0.17052456782796765,0.17080250825944998,0.17102657394920898,0.17119983285243184,0.1713252080905708,0.17140548297446176,0.17144330607604627,0.1714411963098835,0.17140154799186086,0.17132663584794666,0.17121861995051127,0.17107955056382124,0.17091137288383956,0.17071593166048954,0.1704949756931815,0.17025016219263772,0.1699830610039838,0.16969515868772816,0.16938786245665557,0.16906250396783362,0.16872034296995747,0.16836257080707548,0.16799031378044943,0.1676046363708787,0.16720654432427695,0.16679698760367428,0.16637686321112377,0.16594701788319333,0.16550825066393002,0.16506131535927782,0.1646069228770098,0.16414574345628896,0.16367840879097062,0.16320551405073874,0.1627276198041433,0.1622452538475345,0.16175891294383035,0.1612690644749572,0.1607761480117258,0.16028057680478358,0.15978273920019842,0.15928299998310425,0.15878170165272928,0.158279165632005,0.15777569341486147,0.15727156765416045,0.156767053193137];
						var timeV = [0,0.009999999999999995,0.019999999999999934,0.029999999999999874,0.04000000000000012,0.050000000000000405,0.06000000000000069,0.07000000000000098,0.08000000000000126,0.09000000000000155,0.10000000000000184,0.11000000000000212,0.12000000000000241,0.130000000000002,0.1400000000000009,0.1499999999999998,0.1599999999999987,0.1699999999999976,0.1799999999999965,0.1899999999999954,0.1999999999999943,0.2099999999999932,0.2199999999999921,0.229999999999991,0.2399999999999899,0.2499999999999888,0.2599999999999877,0.2699999999999866,0.2799999999999855,0.2899999999999844,0.2999999999999833,0.3099999999999822,0.3199999999999811,0.32999999999998,0.3399999999999789,0.3499999999999778,0.35999999999997667,0.36999999999997557,0.37999999999997447,0.38999999999997337,0.39999999999997227,0.40999999999997117,0.41999999999997006,0.42999999999996896,0.43999999999996786,0.44999999999996676,0.45999999999996566,0.46999999999996456,0.47999999999996346,0.48999999999996235,0.49999999999996125,0.5099999999999602,0.519999999999959,0.529999999999958,0.5399999999999568,0.5499999999999557,0.5599999999999546,0.5699999999999535,0.5799999999999524,0.5899999999999513,0.5999999999999502,0.6099999999999491,0.619999999999948,0.6299999999999469,0.6399999999999458,0.6499999999999447,0.6599999999999436,0.6699999999999425,0.6799999999999414,0.6899999999999403,0.6999999999999392,0.7099999999999381,0.719999999999937,0.7299999999999359,0.7399999999999348,0.7499999999999337,0.7599999999999326,0.7699999999999315,0.7799999999999304,0.7899999999999293,0.7999999999999282,0.8099999999999271,0.819999999999926,0.8299999999999249,0.8399999999999238,0.8499999999999227,0.8599999999999216,0.8699999999999205,0.8799999999999194,0.8899999999999183,0.8999999999999172,0.9099999999999161,0.919999999999915,0.9299999999999139,0.9399999999999128,0.9499999999999117,0.9599999999999106,0.9699999999999095,0.9799999999999084,0.9899999999999073];
						
						var brokerMsg1 = transform.genExpPrediction(2, 'month', new Date().getTime());
						var brokerMsg2 = transform.genHistPrediction(new Date().getTime(), '6 to 2', timeV, probV, 'hour');
						broker.send(broker.PREDICTION_PRODUCER_TOPIC, JSON.stringify(brokerMsg1));
						broker.send(broker.PREDICTION_PRODUCER_TOPIC, JSON.stringify(brokerMsg2));
					}
					
					//==========================================================
					
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
