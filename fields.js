var config = require('./config.js');

console.log('Initializing fields ...');

var WINDOW_SIZE = 10000;

exports.ENRICHED_STORE = 'enriched';
exports.OA_IN_STORE = 'oa_in';
exports.STREAM_STORY_STORE = 'stream_story';
exports.COEFF_STORE = 'friction_coeffs';

exports.SS_TIME_FIELD = 'time';

if (config.USE_CASE == config.USE_CASE_MHWIRTH) {
	console.log('Initializing fields for MHWirth ...');
	
	var rawStores = [
	 	//MHWirth
	 	{
	 		"name" : "hoist_press_A",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "hoist_press_B",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "hook_load",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "ibop",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "oil_temp_gearbox",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "oil_temp_swivel",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "pressure_gearbox",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "rpm",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "temp_ambient",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "torque",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "wob",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "mru_pos",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "mru_vel",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "ram_pos_measured",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "ram_pos_setpoint",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "ram_vel_measured",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "ram_vel_setpoint",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	}
	]
	
	var otherStores = [
		{
			"name" : "friction_coeffs",
			"fields" : [
			    {name: 'timestamp', type: 'datetime'},
				{name: 'coeff_swivel', 'type': "float"},
				{name: 'coeff_gearbox', 'type': "float"},
				{name: 'interval_start', 'type': 'datetime'},
				{name: 'interval_end', 'type': 'datetime'}
			]
		}
	];
	
	var realTimeStores = {
	 	fields : [
	 		{"name": "time", "type": "datetime"},
	 		{"name": "hook_load", "type": "float"},
	 		{"name": "hoist_press_A", "type": "float"},
	 		{"name": "hoist_press_B", "type": "float"},
	 		{"name": "ibop", "type": "float"},
	 		// friction
	 		{"name": "oil_temp_gearbox", "type": "float"},
	 		{"name": "oil_temp_swivel", "type": "float"},
	 		{"name": "pressure_gearbox", "type": "float"},
	 		{"name": "rpm", "type": "float"},
	 		{"name": "temp_ambient", "type": "float"},
	 		{"name": "torque", "type": "float"},
	 		{"name": "wob", "type": "float"},
	 		// setpoint
	 		{"name": "mru_pos", "type": "float"},
	 		{"name": "mru_vel", "type": "float"},
	 		{"name": "ram_pos_measured", "type": "float"},
	 		{"name": "ram_pos_setpoint", "type": "float"},
	 		{"name": "ram_vel_measured", "type": "float"},
	 		{"name": "ram_vel_setpoint", "type": "float"}
	 	]
	};
	
	var onlineAnalyticsStores = {
		fields: realTimeStores.fields.slice()
	}
	
	// friction coefficients
	onlineAnalyticsStores.fields.push({"name": "coeff_swivel", "type": "float", "null": true});
	onlineAnalyticsStores.fields.push({"name": "coeff_gearbox", "type": "float", "null": true});
	
	var streamStoryIgnoreFields = {}
	
	//==============================================================
	// EXPORTS
	//==============================================================
	
	exports.getRawStores = function () {
		return rawStores;
	}
	
	exports.getQmSchema = function () {
		var enrichedStore = JSON.parse(JSON.stringify(realTimeStores));
	    var oaInStore = JSON.parse(JSON.stringify(onlineAnalyticsStores));
	    var streamStoryStore = JSON.parse(JSON.stringify(onlineAnalyticsStores));
	    
	    enrichedStore.name = exports.ENRICHED_STORE;
	    oaInStore.name = exports.OA_IN_STORE;
	    streamStoryStore.name = exports.STREAM_STORY_STORE;
	    
	    enrichedStore.window = WINDOW_SIZE;
	    oaInStore.window = WINDOW_SIZE;
	    
	    return rawStores.concat(otherStores)
	    					  .concat([enrichedStore, oaInStore, streamStoryStore]);
	}
	
	exports.getStreamAggrFields = function () {
		var result = {
			merger: [],
			resampler: []
		}
		
		var resamplerFields = onlineAnalyticsStores.fields;
		var mergerFields = realTimeStores.fields;
		
		for (var i = 0; i < resamplerFields.length; i++) {
			var fieldNm = resamplerFields[i].name;
			
			if (fieldNm == 'time') continue;
			
			var interpolation = config.INTERPOLATION;
			
			if (fieldNm == 'ibop')
				interpolation = 'current';
			
			log.info('Field %s is using %s interpolation ...', fieldNm, interpolation);
			
			result.resampler.push({
				name: fieldNm,
				interpolator: interpolation
			})
		}
		
		for (var i = 0; i < mergerFields.length; i++) {
			var fieldNm = mergerFields[i].name;
			
			if (fieldNm == 'time') continue;
			
			var interpolation = config.INTERPOLATION;
			
			if (fieldNm == 'ibop')
				interpolation = 'current';
			
			log.info('Field %s is using %s interpolation ...', fieldNm, interpolation);
			
			if (fieldNm != 'coeff_swivel' && fieldNm != 'coeff_gearbox') {
				result.merger.push({
					source: fieldNm,
					inField: 'value',
					outField: fieldNm,
					interpolation: interpolation,
					timestamp: 'time'
				});
			}
		}
		
		return result;
	}
} else {
	console.log('Initializing fields for Hella ...');
	
	var montracFields = [
		'MAIN',
		'IMM1',
		'IMM2',
		'IMM3',
		'IMM4',
		'IMM5',
		'SW1',
		'SW2',
		'SW3',
		'SW4',
		'SW5',
		'SW11',
		'QC1',
		'QC2',
		'QC3',
		'QC4',
		'QC5',
		'PM1',
		'PM2',
		'IMM1_QC1',
		'IMM2_QC2',
		'IMM3_QC3',
		'IMM4_QC4',
		'IMM5_QC5',
		'QC1_SW2',
		'QC2_SW3',
		'QC3_SW4',
		'QC4_SW5',
		'QC5_SW11',
		'SW8_SW9',
		'SW8_PM1',
		'SW9_PM2'               
	];
	
	var rawStores = [{
		name: 'LACQUERING',
		fields: [
		    {name: 'time_ms', type: 'uint64'},
		    {name: "time", type: "datetime"},
 			{name: "value", type: "float"}
		]
	}];
	for (var i = 0; i < montracFields.length; i++) {
		rawStores.push({
			name: montracFields[i],
			fields: [
			    {name: 'time_ms', type: 'uint64'},
			    {name: "time", type: "datetime"},
	 			{name: "value", type: "float"}
			]
		});
	}
	
	function getRealTimeFields() {
		var realTimeFields = [{name: "time", type: "datetime"}];
		
		for (var i = 0; i < rawStores.length; i++) {
			realTimeFields.push({ name: rawStores[i].name, type:  rawStores[i].fields[2].type });
		}
		
		return realTimeFields;
	}
	
	exports.getMontracStores = function () {
		return montracFields;
	};
	
	exports.getRawStores = function () {
		return rawStores;
	};
	
	exports.getStreamAggrFields = function () {
		var result = {
			merger: [],
			resampler: []
		}
		
		var fields = getRealTimeFields();
		
		for (var i = 0; i < fields.length; i++) {
			var fieldNm = fields[i].name;
			
			if (fieldNm == 'time') continue;
			
			var interpolation = config.INTERPOLATION;
			
			log.info('Field %s is using %s interpolation ...', fieldNm, interpolation);
			
			result.resampler.push({
				name: fieldNm,
				interpolator: interpolation
			});
			result.merger.push({
				source: fieldNm,
				inField: 'value',
				outField: fieldNm,
				interpolation: interpolation,
				timestamp: 'time'
			})
		}
		
		return result;
	}
	
	exports.getQmSchema = function () {
		var realTimeFields = getRealTimeFields();
		
		var enrichedStore = {
			name: exports.ENRICHED_STORE,
			fields: realTimeFields,
			window: WINDOW_SIZE
		}
		
		var oaInStore = {
			name: exports.OA_IN_STORE,
			fields: realTimeFields,
			window: WINDOW_SIZE
		}
		
		var streamStoryStore = {
			name: exports.STREAM_STORY_STORE,
			fields: realTimeFields
		}
		
		return rawStores.concat([enrichedStore, oaInStore, streamStoryStore]);
	};
}