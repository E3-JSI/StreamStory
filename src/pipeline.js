const QM_IN_STORE = 'drilling';

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
		
		mergerFields.push({
			source: field.name,
			inField: 'value',
			outField: field.name,
			interpolation: field.interpolator,
			timestamp: 'time'
		});
		
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
	
	base.store(QM_IN_STORE).addStreamAggr({
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
	
	resampledStore.addTrigger({
		onAdd: function (val) {
			var len = resampledStore.length;
			
			if (len % 10000 == 0 && log.debug()) 
				log.debug('Store %s has %d records ...', CTMC_STORE_NAME, len);
			
			if (log.trace())
				log.trace('%s: %s', QM_IN_STORE, JSON.stringify(val));
			
			
		}
	});
	
	// friction coefficient
	{
		var coeffStore = base.store('friction');
		
		var buffSize = 1;
		var buff = [];
				
		const Q = 600000; //gearbox
		const L = 8.634e-08;
		const a = 0.418;
		
		const STORE_SIZE = 20000;//200000;	
		
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
					
					val.friction_coeff = ((diff_oil_temp_swivel/diff_time + (avg_oil_temp_swivel - avg_temp_ambient - a)*L)*Q) / P;
					
					addToBuff(val);					
				} catch (e) {
					log.error(e, 'Exception while computing the friction coefficient!');
				}
			}
		});
		
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
							for(var y = 0; y < coefficients.length; y++) {
								sum_std_dev += (coefficients[y] - avg)*(coefficients[y] - avg);
							}
							var std_dev = Math.sqrt(sum_std_dev / coefficients.lenght);
							
							coeffStore.add({start: start, end: stop, samples: drillingSamples, friction_coeff: avg, std_dev: std_dev});							
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

exports.init = function (base1) {
	base = base1;
	
	initStreamAggregates();
	initGC();
	initTriggers();
};