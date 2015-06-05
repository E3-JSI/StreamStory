//var broker = require('./broker.js');
var config = require('../config.js');
var fields = require('../fields.js');
var utils = require('./utils.js')
var broker = require('./broker.js');
var math = require('mathjs');

var base;
var hmc;

function initStreamAggregates() {
	// create fields
	var flds = fields.getStreamAggrFields();
	var mergerFields = [];
	var resamplerFields = [];
	
	// create stream aggregates
	var merger = new qm.StreamAggr(base, {
		type: 'stmerger',
		name: 'drilling_merger',
		outStore: fields.ENRICHED_STORE,
		createStore: false,
		timestamp: 'time',
		fields: flds.merger
	});
	
	base.store(fields.OA_IN_STORE).addStreamAggr({
		type: 'resampler',
		name: 'drilling_resampler',
		outStore: fields.STREAM_STORY_STORE,
		createStore: false,
		timestamp: 'time',
		interval: 1000*20,	// 20 secs
		fields: flds.resampler
	});
}

function initGC() {
	// add triggers for garbagge collection
	log.info('Initilizing garbagge collection ...');
	
	var stores = base.getStoreList();
	
	for (var i = 0; i < stores.length; i++) {
		var storeJson = stores[i];
		var storeName = storeJson.storeName;
		
		if (storeJson.window != null) {
			log.info('Adding GC trigger to store %s ...', storeName);
			
			var store = base.store(storeName);
			
			store.addTrigger({
				onAdd: function (val) {
					var len = store.length;
					
					if (len >= 100000) {
						if (log.debug())
							log.debug('Starting garbagge collector ...');
						base.garbageCollect();
					}
				}
			});
		}
	}
	
	log.info('GC initialized!');
}

function calcFriction() {
	var oaInStore = base.store(fields.OA_IN_STORE);
	
	// compute the friction coefficient
	var buffSize = 1;
	var buff = [];
			
	const Q = 600000; //gearbox
//	const L = 8.634e-08;
//	const a = 0.418;
	
	// variables needed to calculate the friction
	var energyGain = 0;
	var energyLostSwivel = 0;
	var energyLostGearbox = 0;
	var tempGainSwivel = 0;
	var tempGainGearbox = 0;
	var coeffSwivel = 0;
	var coeffGearbox = 0;
	
	var swivelCoeffs = [];
	var gearboxCoeffs = [];
	
	function shouldCalcFric() {
		log.warn('Implement shouldCalcFric!');
		return false;
	}
	
	function shouldStopCalc() {
		log.warn('Implement shouldStopCalc!');
		return false;
	}
	
	function resetVars() {
		log.warn('Implement resetVars!');
	}
	
	function checkFinite(c1, c2) {
		return !isNaN(c1) && isNaN(c2) && isFinite(c1) && isFinite(c2);
	}
	
	function addToBuff(val) {
		buff.unshift(val);
		while (buff.length > buffSize) buff.pop();
	}
	
	// compute the friction coefficient
	oaInStore.addTrigger({
		onAdd: function (val) {
			val.coeff_swivel = coeffSwivel;
			val.coeff_gearbox = coeffGearbox;
			return;	// TODO
			
			try {
				// start / stop calculation
				if (!shouldCalcFric()) return;
				
				var prevVal = buff.length > 0 ? buff[0] : null;
				addToBuff(val);
				
				if (prevVal == null) return;
				
				// variables
				var time = val.time.getTime() / 1000.0;
				var prevTime = prevVal.time.getTime() / 1000.0;
				
				var rpm = val.rpm / 60.0;
				var torque = val.torque * 1000;
				
				var tempSwivel = val.oil_temp_swivel;
				var tempGearbox = val.oil_temp_gearbox;
				var tempAmbient = val.temp_ambient;
				
				// calculation
				var dt = time - prevVal;
				var deltaSwivelT = tempSwivel - tempAmbient;
				var deltaGearboxT = tempGearbox - tempAmbient;
				
				var inputPower = 2*Math.PI*torque*rpm;
				
				energyLostSwivel += getSwivelEnergyLoss(tempSwivel, deltaSwivelT, dt);
				energyLostGearbox += getGearboxEnergyLoss(tempGearbox, deltaGearboxT, dt);
				
				energyGain += inputPower * dt;
				
				tempGainSwivel += deltaSwivelT;
				tempGainGearbox += deltaGearboxT;
				
				coeffSwivel = (tempGainSwivel*Q + energyLostSwivel) / energyGain;
				coeffGearbox = (tempGainGearbox*Q + energyLostGearbox) / energyGain;
				
				if (!checkFinite(coeffSwivel, coeffGearbox)) {
		        	log.fatal('One of the coefficients is infinite: (swivel:' + coeffSwivel + ', gearbox: ' + coeffGearbox + ')!');
					utils.exit(3);
		        }
				
				val.coeff_swivel = coeffSwivel;
				val.coeff_gearbox = coeffGearbox;
				
				if (shouldStopCalc()) {
					resetVars();
					return;
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
//		var fname = '/media/lstopar/hdd/data/Aker/new_data/joined/drilling-2015.csv';
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
				var len = enricherOutStore.length;
				
				if (len % 10000 == 0 && log.debug()) 
					log.debug('Store %s has %d records ...', enricherOutStore.name, len);
				
				if (log.trace())
					log.trace('%s: %s', enricherOutStore.name, JSON.stringify(val));
				
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
				
				if (config.useBroker) {
//					log.info('Sending: %s', JSON.stringify(outVal));
					outVal.time = val.time.getTime();
					broker.send(broker.ENRICHED_DATA_PRODUCER_TOPIC, JSON.stringify(outVal));
				} else {
					outVal.time = utils.dateToQmDate(val.time);
					oaInStore.push(outVal);
				}
			}
		});
	}
	
	oaInStore.addTrigger({
		onAdd: function (val) {
			var len = oaInStore.length;
			
			if (len % 10000 == 0 && log.debug()) 
				log.debug('Store %s has %d records ...', oaInStore.name, len);
			if (log.trace())
				log.trace('%s: %s', oaInStore.name, JSON.stringify(val));
		}
	});
	
	{	// StreamStory
		var nProcessed = 0;
		
		streamStoryStore.addTrigger({
			onAdd: function (val) {
				nProcessed++;
				try {
					var len = streamStoryStore.length;
					
					if (len % 10000 == 0 && log.debug()) 
						log.debug('Store %s has %d records ...', streamStoryStore.name, len);
					
					if (log.trace())
						log.trace('%s: %s', streamStoryStore.name, JSON.stringify(val));
					
					if (isNaN(val.coeff_swivel) || isNaN(val.coeff_gearbox)) {
						log.fatal('Resampled store: the friction coefficient is NaN! Store size: %d, friction store size: %d', streamStoryStore.length, oaInStore.length);
						process.exit(2);
					}
					
					if (hmc != null) {
						if (log.debug() && nProcessed % 1000 == 0)
							log.debug('StreamStory processed %d values ...', nProcessed);
						hmc.update(val);
					}
					
					//==========================================================
					// TODO remove
					broker.send(broker.PREDICTION_PRODUCER_TOPIC, {type: 'anomaly', content: 'Hello world'});
					//==========================================================
				} catch (e) {
					log.error(e, 'Exception while printing statistics of the resampled store!');
				}
			}
		});
	}
	
	calcFriction();
	
	// get the friction coefficient on a specific interval and 
	// write them to a special store
//	{
//		var coeffStore = base.store('friction');
//		
//		var drillingSamples = 0;
//		var isDrilling = false;
//		var coefficients = [];
//		var start = 0;
//		var stop = 0;
//		var sum = 0;
//		
//		oaInStore.addTrigger({
//			onAdd: function (val) {
//				try {
//					if (val.rpm > 100) {
//						if (!isDrilling) {
//							start = val.time;
//							isDrilling = true;
//						}
//						drillingSamples++;
//						coefficients.push(val.friction_coeff);
//					}
//					else {
//						stop = val.time;
//						if (start > 0 && stop - start > 2000000) {
//							for (var x = 0; x < coefficients.length; x ++) {
//								sum += coefficients[x];  
//							}
//							var avg = sum / coefficients.length;
//							
//							var sum_std_dev = 0;
//							for (var y = 0; y < coefficients.length; y++) {
//								sum_std_dev += (coefficients[y] - avg)*(coefficients[y] - avg);
//							}
//							var std_dev = Math.sqrt(sum_std_dev / coefficients.lenght);
//							
//							coeffStore.push({
//								start: start,
//								end: stop,
//								samples: drillingSamples,
//								friction_coeff: avg,
//								std_dev: std_dev
//							});							
//						}
//
//						drillingSamples = 0;
//						start = 0;
//						stop = 0;
//						sum = 0;
//						coefficients = [];
//					}				
//				} catch (e) {
//					log.error(e, 'Exception while computing the friction coefficient!');
//				}
//			}
//		});
//	}
	
	log.info('Triggers initialized!');
}

exports.init = function (opts) {
	base = opts.base;
	hmc = opts.hmc;
	
	initTriggers();
	initStreamAggregates();
	initGC();
};