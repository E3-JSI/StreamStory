
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
	
	inStore.addTrigger({
		onAdd: function (val) {
			var len = inStore.length;
			
			if (len % 10000 == 0 && log.debug()) 
				log.debug('Store %s has %d records ...', QM_IN_STORE, len);
			
			if (log.trace())
				log.trace('%s: %s', QM_IN_STORE, JSON.stringify(val));
			
			// TODO compute the friction coeff here
			val.friction_coeff = 0;
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
	
	log.info('Triggers initialized!');
}

exports.init = function () {
	initStreamAggregates();
	initGC();
	initTriggers();
};