const QM_IN_STORE = 'drilling';
const CORRECT_VEL_STORE = 'drilling_fixed';

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
	
	var flds = QM_FIELDS;
	
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
		outStore: QM_IN_STORE,
		createStore: false,
		timestamp: 'time',
		fields: mergerFields
	});
	
	base.store(CORRECT_VEL_STORE).addStreamAggr({
		type: 'resampler',
		name: 'drilling_resampler',
		outStore: CTMC_STORE_NAME,
		createStore: false,
		timestamp: 'time',
		interval: 1000,
		fields: resamplerFields
	});
}

function initTriggers() {
	var inStore = base.store(QM_IN_STORE);
	var velStore = base.store(CORRECT_VEL_STORE);
	var resampledStore = base.store(CTMC_STORE_NAME);

	// add processing triggers
	log.info('Initilizing triggers ...');
	
	// print progress
	inStore.addTrigger({
		onAdd: function (val) {
			var len = inStore.length;
			
			if (len % 10000 == 0 && log.debug()) 
				log.debug('Store %s has %d records ...', QM_IN_STORE, len);
			
			if (log.trace())
				log.trace('%s: %s', QM_IN_STORE, JSON.stringify(val));
		}
	});
	
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
		
		inStore.addTrigger({
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
	
	
	{	
		var vals = [];
		
		function preprocessExample(val) {
			vals.push(val);
			while (vals.length > 3) {
				vals.shift();
			}
			
			if (vals.length < 2) return;
			
			if (vals.length == 2) {
				var nextVal = vals[1];
				var currVal = vals[0];
				
				var velocity_setpoint = (nextVal.ram_pos_setpoint - currVal.ram_pos_setpoint)/(nextVal.time.getTime() - currVal.time.getTime());
				var velocity_measured = (nextVal.ram_pos_measured - currVal.ram_pos_measured)/(nextVal.time.getTime() - currVal.time.getTime());
				
				currVal.ram_vel_setpoint = velocity_setpoint;
				currVal.ram_vel_measured = velocity_measured;
			}
			else if (vals.length == 3) {
				var nextVal = vals[2];
				var currVal = vals[1];
				var prevVal = vals[0];
				
				var velocity_setpoint = (nextVal.ram_pos_setpoint - prevVal.ram_pos_setpoint)/(nextVal.time.getTime() - prevVal.time.getTime());
				var velocity_measured = (nextVal.ram_pos_measured - prevVal.ram_pos_measured)/(nextVal.time.getTime() - prevVal.time.getTime());
				
				currVal.ram_vel_setpoint = velocity_setpoint;
				currVal.ram_vel_measured = velocity_measured;
			}
			
			var val1 = {};
			
			
			for (var key in val) {
				val1[key] = currVal[key];
				log.debug('Key: %s', key);
			}
			
			velStore.add(val1);
		}
		
		var buff = [];
		var buffLen = 300;

		function addToBuff(val) {
		    buff.unshift(val);    // append element to the beginning
		    while (buff.length > buffLen) {
		        buff.pop();    // remove the last element
		    }
		}
		
		function processExample(val) {
			var dev = val.ram_pos_measured - val.ram_pos_setpoint;
			
			//upper overshoot
			if (0 < val.ram_vel_setpoint && 
					val.ram_vel_setpoint < 5 &&
					Math.sign(val.dev) != Math.sign(buff[1].ram_pos_measured - buff[1].ram_pos_setpoint) &&
					Math.sign(buff[1].ram_pos_measured - buff[1].ram_pos_setpoint) != 0) {
				
				var sum = 0;
				for (var i = 0; i < (buff.length-100); i++) {
					
					if (buff[i].ram_vel_setpoint > 400) {
						sum++;
					}
				}
				if (sum > 40) {
					var upper2 = val;
					var upper1 = [];
					var deviation = [];
					
					for (var u = 0; u < (buff.length - 200); u++) {
						if (Math.abs((val.ram_vel_setpoint - buff[u].ram_vel_setpoint)) < 3) {
							var upper1 = buff[u];
							deviation.push(buff[u].ram_pos_measured - buff[u].ram_pos_setpoint);
						}
					}
					if (upper1 == []) return;
					
					var settlingTime = upper2.time.getTime() - upper1.time.getTime();
					
					if (settling_time < 4 ||
							(upper2.ram_pos_measured < upper1.ram_pos_measured)) return;
					
					var a_s = 0;
					for (var s = buff[u]; s < (buff[u] + 150); s++) {
						a_s = a_s + buff[s].ram_vel_setpoint;
					}
					
					var averageSpeed = a_s/150;
					var maxDeviation = Math.max(deviation);
					var result = maxDeviation + "," + settlingTime + "," + upper1.hook_load + "," + upper1.mru_pos + "," + upper1.mru_vel + "," + averageSpeed + "\n";
					//parameters.push = [upper1.hook_load, upper1.mru_pos, upper1.mru_vel, averageSpeed];
					
				}
				else if (sum < 40) return;
			}
			
			
			//lower overshoot
			if (-5 < val.velocity_setpoint &&
					val.velocity_setpoint < 0 &&
					Math.sign(val.dev) != Math.sign(buff[1].ram_pos_measured - buff[1].ram_pos_setpoint)) {
				
				var sum = 0;
				for (var j = 0; j < (buff.length - 100); j++) {
					
					if (buff[j].ram_vel_setpoint > -100 &&
							buff[j].ram_vel_setpoint < -60) {
						sum++;
					}
				}
				if (sum > 30) { //if the sum of velocities 200 indexes back is at least 30
					var lower2 = val;
					var lower1 = [];
					var deviation = [];
					
					for (var l = 0; l < buff.length; l++) {
						if (Math.abs((val.ram_vel_setpoint - buff[l].ram_vel_setpoint)) <= 3) {
							var lower1 = buff[l];
							deviation.push(buff[l].ram_pos_measured - buff[l].ram_pos_setpoint);
						}
					}
					if (lower1 == []) return;
					
					var sum2 = 0;
					for (var v = 0; v < (buff.length - 200); v++) {
						
						if (buff[v].ram_vel_setpoint > 0 &&
								buff[v].ram_vel_setpoint < 300) {
							sum2++;
						}
					}
					if (sum2 > 10) return;
					
					var settlingTime = lower2.time.getTime() - lower1.time.getTime();
					
					if ((lower2.ram_pos_setpoint - lower1.ram_pos_setpoint) < 15 ||
							(lower2.ram_pos_setpoint > lower1.ram_pos_setpoint)) return;
				
					var a_s = 0;
					for (var s = buff[l]; s < (buff[l] + 150); s++) {
						a_s = a_s + buff[s].ram_vel_setpoint;
					}
					
					var averageSpeed = a_s/150;
					var maxDeviation = Math.min.apply(Math, deviation);
					var result = maxDeviation + "," + settlingTime + "," + lower1.hook_load + "," + lower1.mru_pos + "," + lower1.mru_vel + "," + averageSpeed + "\n";
					
				}
				else if (sum < 30) return;
			}
			
			//result+=result
			
			fs.appendFile('deviations.txt', result, function (err) {
				  if (err) throw err;
				  console.log('The result is appended!');
				});
			
			
			//var y = la.newMat(Y);
			//var X = la.newMat(parameters);
		}
		
		inStore.addTrigger({
			onAdd: function (val) {
				try {
					log.debug('Setpoint trigger called!');
					preprocessExample(val);
				} catch (e) {
					log.error(e, 'Drilling store trigger exception!');
				}
			}
		});
		
		velStore.addTrigger({
			onAdd: function (val) {
				try {
					log.debug('Setpoint trigger called on vel store!');
					processExample(val);
				} catch (e) {
					log.error(e, 'Vel store trigger exception!');
				}
			}
		});
	}
	
	
	resampledStore.addTrigger({
		onAdd: function (val) {
			var len = resampledStore.length;
			
			if (len % 10000 == 0 && log.debug()) 
				log.debug('Store %s has %d records ...', CTMC_STORE_NAME, len);
			
			if (log.trace())
				log.trace('%s: %s', QM_IN_STORE, JSON.stringify(val));
			
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
		inStore.addTrigger({
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
			        
					val.friction_coeff = coeff;
					addToBuff(val);					
				} catch (e) {
					log.error(e, 'Exception while computing the friction coefficient!');
				}
			}
		});
	}
	
	log.info('Triggers initialized!');
}

exports.init = function (base1) {
	base = base1;
	
	initTriggers();
	initStreamAggregates();
	initGC();
};