//var broker = require('./broker.js');
var config = require('../config.js');
var fields = require('../fields.js');
var utils = require('./utils.js')
var broker = require('./broker.js');
var math = require('mathjs');
var statistics = qm.statistics;

var base;
var hmc;

function initStreamAggregates() {
	// create fields
	var flds = fields.getStreamAggrFields();
	var mergerFields = [];
	var resamplerFields = [];
	
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
	
	// create the resampler used by StreamStory
	base.store(fields.OA_IN_STORE).addStreamAggr({
		type: 'resampler',
		name: 'drilling_resampler',
		outStore: fields.STREAM_STORY_STORE,
		createStore: false,
		timestamp: 'time',
		interval: 1000*20,	// 20 secs
		fields: flds.resampler
	});
	
	// insert zeros now, so they won't get resampled
	if (config.INITIALIZE_ZERO) {
		var startTm = 100000;
		
		log.info('Initializing default values ...');
		var stores = fields.getRawStores();
		
		for (var i = 0; i < stores.length; i++) {
			var storeConf = stores[i];
			var name = storeConf.name;
			
			if (name == 'rpm') continue;
			
			var val = {
				time_ms: startTm,
				time: utils.dateToQmDate(new Date(startTm)),
				value: 0
			};
			
			log.info('Initializing store %s ...', name);
			log.info('Inserting value %s ...', JSON.stringify(val));
			
			base.store(name).push(val);
		}
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
	const BUFF_SIZE = 1;
	var buff = [];
	
	const CALC_START_THRESHOLD = 7;//1000;				TODO Mihas units???
//	const CALC_START_THRESHOLD = 1000;
	const MIN_DRILL_TIME = 1000*60*5;	// 5mins
	const DEFAULT_COEFF = 0;
	
//	const Q = 600000; //gearbox
	const Q = 1;
	
	const COOLING_ALPHA_SWIVEL = [-1.3, 6.5e-08];	// 	TODO Mihas version
//	const COOLING_ALPHA_SWIVEL = [-1.3, 6.5e-05];
	const COOLING_ALPHA_GEARBOX = COOLING_ALPHA_SWIVEL;	// TODO
	
	const LINREG_ALPHA_SWIVEL = [3.445e-08, -4.884e-10];
	const LINREG_ALPHA_GEARBOX = LINREG_ALPHA_SWIVEL;	// TODO
	
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
		buff = [];
		
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
	
	function getTempLoss(deltaT, dt, alpha) {
		return (deltaT - alpha[0]) * (1 - Math.exp(-alpha[1]*dt));
	}
	
	function getSwivelTempLoss(deltaT, dt) {
		return getTempLoss(deltaT, dt, COOLING_ALPHA_SWIVEL);
	}
	
	function getGearboxTempLoss(deltaT, dt) {
		return getTempLoss(deltaT, dt, COOLING_ALPHA_GEARBOX);
	}
	
	function checkOutlier(coeff, temp, alpha, time) {
		var yHat = alpha[0] + temp*alpha[1];
		var residual = coeff - yHat;
		var zScore = statistics.getZScore(residual, 0, 5.3808e-09);
		
		if (log.info())
			log.info('Residual: %d, z=%d, time=%d', residual, zScore, time);
		
		if (Math.abs(zScore) > .1) {	// TODO hardcoded
			log.info('Sending prediction based on the friction coefficient!');
			var msg = {
				type: 'prediciton',
				content: {
					time: time,
					pdf: {
						type: 'exponential',
						lambda: 2
					}
				}
			};
			broker.send(broker.PREDICTION_PRODUCER_TOPIC, JSON.stringify(msg));
		}
	}
	
	function startCalc(val) {
		log.info('Starting calculation of the friction coefficient ...');
		isCalculating = true;
		startTime = val.time.getTime();
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
			checkOutlier(coeffSwivel, avgTemp, LINREG_ALPHA_SWIVEL, intervalEnd);
			checkOutlier(coeffGearbox, avgTemp, LINREG_ALPHA_GEARBOX, intervalEnd);
		} else {
			log.info('Drilling didn not take long enough, the coefficient will be ignored!');
		}
		
		resetVars();
	}
	
	// compute the friction coefficient
	oaInStore.addTrigger({
		onAdd: function (val) {
			try {
				var prevVal = buff.length > 0 ? buff[0] : null;
				addToBuff(val);
				
				if (prevVal == null) return;
				
				if (isCalculating && val.rpm * val.torque < CALC_START_THRESHOLD) {
					finishCalc(val);
				}
				
				if (!isCalculating && val.rpm * val.torque >= CALC_START_THRESHOLD) {
					startCalc(val);
				}
				
				if (isCalculating) {
					recN++;
					
					// variables
					var time = val.time.getTime();//				TODO Mihas units???
					var prevTime = prevVal.time.getTime();//		TODO Mihas units???
//					var time = val.time.getTime() / 1000.0;
//					var prevTime = prevVal.time.getTime() / 1000.0;
					
					var tempAmbient = val.temp_ambient;
					
					var rpm = val.rpm / (60.0 * 1000);// / 60.0;	TODO should 1000 be here Mihas? units???
//					var rpm = val.rpm / 60.0;
					var torque = val.torque * 1000;
					
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
					val.coeff_swivel = DEFAULT_COEFF;
					val.coeff_gearbox = DEFAULT_COEFF;
				}
			} catch (e) {
				log.error(e, 'Exception while computing the friction coefficient!');
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
//		var fname = '/mnt/raidM2T/data/Aker/high_coeff/joined/drilling-high-coeff.csv';
//		var outFields = [
//		    'hoist_press_A',
//		    'hoist_press_B',
//		    'hook_load',
//		    'ibop',
//		    'oil_temp_gearbox',
//		    'oil_temp_swivel',
//		    'pressure_gearbox',
//		    'rpm',
//		    'temp_ambient',
//		    'torque',
//		    'wob',
//		    'mru_pos',
//		    'mru_vel',
//		    'ram_pos_measured',
//		    'ram_pos_setpoint',
//		    'ram_vel_measured',
//		    'ram_vel_setpoint'
//		]
//		
//		
//		var fout = new qm.fs.FOut(fname, false);
//		
//		var line = 'time,';
//		for (var i = 0; i < outFields.length; i++) {
//			line += outFields[i];
//			if (i < outFields.length-1)
//				line += ',';
//		}
//		fout.writeLine(line);
//		fout.flush();
//		fout.close();
		
		enricherOutStore.addTrigger({
			onAdd: function (val) {				
//				fout = new qm.fs.FOut(fname, true);
//				line = '' + val.time.getTime() + ',';
//				for (var i = 0; i < outFields.length; i++) {
//					line += val[outFields[i]];
//					if (i < outFields.length-1)
//						line += ',';
//				}
//				
//				fout.writeLine(line);
//				fout.flush();
//				fout.close();
				
				var outVal = val.toJSON(false, false, false);
				
				if (config.USE_BROKER) {
//					log.info('Sending: %s', JSON.stringify(outVal));
					outVal.time = val.time.getTime();
					broker.send(broker.ENRICHED_DATA_PRODUCER_TOPIC, JSON.stringify(outVal));
					
//					if (len % 100 == 0) {
//						if (log.debug())
//							log.debug('Sending prediction ...');
//						var msg = {"type":"statePrediction","content":{"time":1387555906718,"currState":6,"targetState":2,"probability":0.45410531166992496,"pdf":{"probV":[0,0.011817991130292017,0.03282373075287707,0.05643973695098126,0.07926276055741609,0.09969209781742874,0.11712857667718435,0.13150929048992957,0.14303997078839495,0.15204356801701335,0.15887691616584387,0.163887003205463,0.16738999653423012,0.16966307372367606,0.17094321299535833,0.17142954058650212,0.17128728471637922,0.17065224678235674,0.16963520727720696,0.16832597888520248,0.16679698760367428,0.1651063558668065,0.1633005104142524,0.16141636063357837,0.15948310145867511,0.15752369526905402,0.15555608352458616,0.1535941733563747,0.15164863829565609,0.1497275664458762,0.14783698402656306,0.1459812774786875,0.14416353324470343,0.14238581088857594,0.14064936233980238,0.13895480765907922,0.13730227576010473,0.13569151691509357,0.13412199256175072,0.13259294686481662,0.13110346362231418,0.12965251140824213,0.1282389792793936,0.1268617049186671,0.1255194967203665,0.1242111510274006,0.12293546549240247,0.12169124934338263,0.12047733118063031,0.11929256480781353,0.1181358335008238,0.11700605303795615,0.11590217375087757,0.11482318180422642,0.11376809987032337,0.11273598733218064,0.11172594012134067,0.1107370902756006,0.10976860528452796,0.10881968727680388,0.10788957209241663,0.10697752827379277,0.1060828560028546,0.10520488600526677,0.1043429784385645,0.10349652177717407,0.1026649317044308,0.10184765001933091,0.10104414356387438,0.10025390317537744,0.09947644266695801,0.0987112978383812,0.09795802551882801,0.09721620264237774,0.09648542535677102,0.09576530816534645,0.09505548310211734,0.09435559893939574,0.09366532042744885,0.09298432756545663,0.0923123149028871,0.09164899087049605,0.09099407713996743,0.0903473080112355,0.08970842982656516,0.08907720041040801,0.08845338853400789,0.08783677340389817,0.08722714417330024,0.08662429947549125,0.0860280469782882,0.08543820295873361,0.08485459189717057,0.08427704608990663,0.08370540527959189,0.08313951630262753,0.08257923275285498,0.08202441466078911,0.081474928187728,0.08093064533410929],"timeV":[0,0.03900000000000009,0.07800000000000121,0.11700000000000232,0.15599999999999914,0.19499999999999484,0.23399999999999055,0.27299999999998625,0.31199999999998196,0.35099999999997766,0.38999999999997337,0.4289999999999691,0.4679999999999648,0.5069999999999605,0.5459999999999562,0.5849999999999519,0.6239999999999476,0.6629999999999433,0.701999999999939,0.7409999999999347,0.7799999999999304,0.8189999999999261,0.8579999999999218,0.8969999999999175,0.9359999999999132,0.9749999999999089,1.0139999999999048,1.0529999999999005,1.0919999999998962,1.1309999999998919,1.1699999999998876,1.2089999999998833,1.247999999999879,1.2869999999998747,1.3259999999998704,1.364999999999866,1.4039999999998618,1.4429999999998575,1.4819999999998532,1.520999999999849,1.5599999999998446,1.5989999999998403,1.637999999999836,1.6769999999998317,1.7159999999998274,1.7549999999998231,1.7939999999998189,1.8329999999998146,1.8719999999998103,1.910999999999806,1.9499999999998017,1.9889999999997974,2.0279999999998553,2.0669999999999376,2.10600000000002,2.145000000000102,2.1840000000001845,2.2230000000002668,2.262000000000349,2.3010000000004314,2.3400000000005137,2.379000000000596,2.4180000000006783,2.4570000000007606,2.496000000000843,2.535000000000925,2.5740000000010075,2.61300000000109,2.652000000001172,2.6910000000012544,2.7300000000013367,2.769000000001419,2.8080000000015013,2.8470000000015836,2.886000000001666,2.925000000001748,2.9640000000018305,3.003000000001913,3.042000000001995,3.0810000000020774,3.1200000000021597,3.159000000002242,3.1980000000023243,3.2370000000024066,3.276000000002489,3.3150000000025712,3.3540000000026535,3.393000000002736,3.432000000002818,3.4710000000029004,3.5100000000029827,3.549000000003065,3.5880000000031473,3.6270000000032296,3.666000000003312,3.7050000000033942,3.7440000000034765,3.783000000003559,3.822000000003641,3.8610000000037235]}}};
//						broker.send(broker.PREDICTION_PRODUCER_TOPIC, JSON.stringify(msg));
//					}
				} else {
					outVal.time = utils.dateToQmDate(val.time);
					oaInStore.push(outVal);
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
					if (isNaN(val.coeff_swivel) || isNaN(val.coeff_gearbox)) {
						log.fatal('Resampled store: the friction coefficient is NaN! Store size: %d, friction store size: %d', streamStoryStore.length, oaInStore.length);
						process.exit(2);
					}
					
					if (hmc != null) {
						if (log.debug() && nProcessed % config.STREAM_STORY_PRINT_INTERVAL == 0)
							log.debug('StreamStory processed %d values ...', nProcessed);
						hmc.update(val);
					}
					
//					//==========================================================
//					// TODO remove
//					broker.send(broker.PREDICTION_PRODUCER_TOPIC, JSON.stringify({type: 'anomaly', content: 'Hello world'}));
//					//==========================================================
				} catch (e) {
					log.error(e, 'Exception while printing statistics of the resampled store!');
				}
			}
		});
	}
	
	calcFriction();
	
	log.info('Triggers initialized!');
}

exports.init = function (opts) {
	base = opts.base;
	hmc = opts.hmc;
	
	initTriggers();
	initStreamAggregates();
	initGC();
};