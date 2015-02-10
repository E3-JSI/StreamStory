const IN_STORE = 'drilling';						// TODO
const RESAMPLED_STORE = 'drillingResampled';		// TODO


function initStreamAggregates() {
	// create fields
	var mergerFields = [];
	var resamplerFields = [];
	
	var flds = [
	    {name: 'hook_load', interpolator: 'previous'},
	    {name: 'oil_temp_gearbox', interpolator: 'linear'},
	    {name: 'oil_temp_swivel', interpolator: 'linear'},
	    {name: 'pressure_gearbox', interpolator: 'linear'},
	    {name: 'rpm', interpolator: 'linear'},
	    {name: 'temp_ambient', interpolator: 'previous'},
	    {name: 'torque', interpolator: 'linear'},
	    {name: 'wob', interpolator: 'linear'},
	    {name: 'mru_pos', interpolator: 'linear'},
	    {name: 'mru_vel', interpolator: 'linear'},
	    {name: 'ram_pos_measured', interpolator: 'linear'},
	    {name: 'ram_pos_setpoint', interpolator: 'linear'},
	    {name: 'ram_vel_measured', interpolator: 'linear'},
	    {name: 'ram_vel_setpoint', interpolator: 'linear'}
	];
	
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
		outStore: IN_STORE,
		createStore: false,
		timestamp: 'time',
		fields: mergerFields
	});
	
	base.store(IN_STORE).addStreamAggr({
		type: 'resampler',
		name: 'drilling_resampler',
		outStore: RESAMPLED_STORE,
		createStore: false,
		timestamp: 'time',
		interval: 1000,
		fields: resamplerFields
	});
}

function initTriggers() {
	var inStore = base.store(IN_STORE);
	var resampledStore = base.store(RESAMPLED_STORE);
	
	inStore.addTrigger({
		onAdd: function (val) {
			var len = inStore.length;
			
			if (len % 10000 == 0 && log.debug()) 
				log.debug('Store %s has %d records ...', IN_STORE, len);
			
			if (log.trace())
				log.trace('%s: %s', IN_STORE, JSON.stringify(val));
		}
	});
	
	resampledStore.addTrigger({
		onAdd: function (val) {
			var len = resampledStore.length;
			
			if (len % 10000 == 0 && log.debug()) 
				log.debug('Store %s has %d records ...', RESAMPLED_STORE, len);
			
			if (log.trace())
				log.trace('%s: %s', IN_STORE, JSON.stringify(val));
		}
	});
}

exports.init = function () {
	initStreamAggregates();
	initTriggers();
};