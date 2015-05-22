//var broker = require('./broker.js');
var config = require('../config.js');
var utils = require('./utils.js')
var broker = require('./broker.js');

var base;

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
						base.gc();
					}
				}
			});
		}
	}
	
	log.info('GC initialized!');
}

function initStreamAggregates() {
	// create fields
	var mergerFields = [];
	var resamplerFields = [];
	
	var fldConfig = config.getFieldConfig();
	var flds = fldConfig.obsFields;
	flds = flds.concat(fldConfig.contrFields);
	
	for (var i = 0; i < flds.length; i++) {
		var field = flds[i];
				
		if (field.isRaw) {
			mergerFields.push({
				source: field.name,
				inField: 'value',
				outField: field.name,
				interpolation: field.interpolator,
				timestamp: 'time'
			});
		}
		
		resamplerFields.push({
			name: field.name,
			interpolator: field.interpolator
		});
	}
	
	// create stream aggregates
	var merger = new qm.StreamAggr(base, {
		type: 'stmerger',
		name: 'drilling_merger',
		outStore: config.ENRICHER_OUT_STORE,
		createStore: false,
		timestamp: 'time',
		fields: mergerFields
	});
	
	base.store(config.OA_IN_STORE).addStreamAggr({
		type: 'resampler',
		name: 'drilling_resampler',
		outStore: config.STREAM_STORY_STORE,
		createStore: false,
		timestamp: 'time',
		interval: 1000*20,	// 20 secs
		fields: resamplerFields
	});
}

function initTriggers() {
	var enricherOutStore = base.store(config.ENRICHER_OUT_STORE);
	var oaInStore = base.store(config.OA_IN_STORE);
	var streamStoryStore = base.store(config.STREAM_STORY_STORE);

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
					outVal.time = val.time.getTime();
					broker.send(broker.ENRICHED_DATA_PRODUCER_TOPIC, JSON.stringify(outVal));
				} else {
					outVal.time = utils.dateToQmDate(val.time);
					oaInStore.add(outVal);
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
	
	streamStoryStore.addTrigger({
		onAdd: function (val) {
			try {
				var len = streamStoryStore.length;
				
				if (len % 10000 == 0 && log.debug()) 
					log.debug('Store %s has %d records ...', streamStoryStore.name, len);
				
				if (log.trace())
					log.trace('%s: %s', streamStoryStore.name, JSON.stringify(val));
				
				if (isNaN(val.friction_coeff)) {
					log.fatal('Resampled store: the friction coefficient is NaN! Store size: %d, friction store size: %d', streamStoryStore.length, inStore.length);
					process.exit(2);
				}
				
				if (len == 186998) {
					log.info('Reached critical point!');	// TODO remove this
				}
				
	//			if (log.debug())	// TODO remove
	//	        	log.debug('Coefficient: %d', val.friction_coeff);
	//			
	//			if (resampledStore.length == 5000) {	// TODO remove
	//				log.info('saving store ...');
	//				resampledStore.recs.saveCSV({fname: 'store_trig.csv'}, function (e) {
	//					if (e != null)
	//						log.error(e, 'Failed to save store!');
	//					log.info('Done!');
	//				});
	//			}
			} catch (e) {
				log.error(e, 'Exception while printing statistics of the resampled store!');
			}
		}
	});
	
	// compute the friction coefficient
	{
		var buffSize = 1;
		var buff = [];
				
		const Q = 600000; //gearbox
		const L = 8.634e-08;
		const a = 0.418;
		
		function addToBuff(val) {
			buff.unshift(val);
			while (buff.length > buffSize) buff.pop();
		}
		
		// compute the friction coefficient
		oaInStore.addTrigger({
			onAdd: function (val) {
				try {
					var prevVal = buff.length > 0 ? buff[0] : null;
					
					if (prevVal == null) {
						val.friction_coeff = 0;
						addToBuff(val);
						return;
					}
					
					//friction coefficient	
					var diff_time = val.time.getTime() - prevVal.time.getTime();
			        var diff_oil_temp_swivel = val.oil_temp_swivel - prevVal.oil_temp_swivel;
			        var avg_oil_temp_swivel = (val.oil_temp_swivel + prevVal.oil_temp_swivel) / 2; 
			        var avg_rpm = (val.rpm + prevVal.rpm) / (2 * 60000);
			        var avg_torque = (val.torque + prevVal.torque) * 1000 / 2;
			        var avg_temp_ambient = (val.temp_ambient + prevVal.temp_ambient) / 2;
			        var P = 2 * Math.PI * avg_torque * avg_rpm;
			        
			        var coeff = ((diff_oil_temp_swivel/diff_time + (avg_oil_temp_swivel - avg_temp_ambient - a)*L)*Q) / P;
			        
			        // fixes because the coefficient can be infinity and
			        // we'll get NaNs later on
			        // TODO is this OK?
			        coeff = Math.max(0, Math.min(1, coeff));
			        			        
			        if (!isFinite(coeff)) {
			        	log.fatal('Friction store: the friction coefficient is infinite! Store size: %d', streamStoryStore.length);
			        	process.exit(2);
			        }
			        if (isNaN(coeff)) {
			        	log.fatal('Friction store: the friction coefficient is NaN! Store size: %d', streamStoryStore.length);
						process.exit(2);
			        }
			        
					val.friction_coeff = coeff;
					addToBuff(val);					
				} catch (e) {
					log.error(e, 'Exception while computing the friction coefficient!');
				}
			}
		});
	}
	
	// get the friction coefficient on a specific interval and 
	// write them to a special store
	{
		var coeffStore = base.store('friction');
		
		var drillingSamples = 0;
		var isDrilling = false;
		var coefficients = [];
		var start = 0;
		var stop = 0;
		var sum = 0;
		
		oaInStore.addTrigger({
			onAdd: function (val) {
				try {
					if (val.rpm > 100) {
						if (!isDrilling) {
							start = val.time;
							isDrilling = true;
						}
						drillingSamples++;
						coefficients.push(val.friction_coeff);
					}
					else {
						stop = val.time;
						if (start > 0 && stop - start > 2000000) {
							for (var x = 0; x < coefficients.length; x ++) {
								sum += coefficients[x];  
							}
							var avg = sum / coefficients.length;
							
							var sum_std_dev = 0;
							for (var y = 0; y < coefficients.length; y++) {
								sum_std_dev += (coefficients[y] - avg)*(coefficients[y] - avg);
							}
							var std_dev = Math.sqrt(sum_std_dev / coefficients.lenght);
							
							coeffStore.add({
								start: start,
								end: stop,
								samples: drillingSamples,
								friction_coeff: avg,
								std_dev: std_dev
							});							
						}

						drillingSamples = 0;
						start = 0;
						stop = 0;
						sum = 0;
						coefficients = [];
					}				
				} catch (e) {
					log.error(e, 'Exception while computing the friction coefficient!');
				}
			}
		});
	}
	
	log.info('Triggers initialized!');
}

exports.init = function (opts) {
	base = opts.base;
	
	initTriggers();
	initStreamAggregates(opts.fieldConfig);
	initGC();
};