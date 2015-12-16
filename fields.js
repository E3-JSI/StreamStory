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
	
	exports.getInitZeroFields = function () {
		var flds = [];
		if (config.INITIALIZE_ZERO) {
			for (var i = 0; i < rawStores.length; i++) {
				flds.push(rawStores[i].name);
			}
		}
		return flds;
	};
	
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
} else if (config.USE_CASE == config.USE_CASE_HELLA) {
	console.log('Initializing fields for Hella ...');
	
	var montracFields = [
	    // main circle
	    'SW1_SW2',
	    'SW2_SW3',
        'SW3_SW8',
	    'SW3_SW4',
	    'SW4_SW5',
	    'SW5_SW11',
	    'SW11_SW8',
	    'SW8_SW9',
	    'SW9_SW1',
	    // lacquering lines
	    'SW8_PM1',
        'SW9_PM2',
        // after lacquering
        'PM1_SW1',
        'PM2_SW1',
        // moulding machine lines
        'SW1_IMM1',
        'SW2_IMM2',
        'SW3_IMM3',
        'SW4_IMM4',
        'SW5_IMM5',
        // cooling lines
        'IMM1_SW2',
        'IMM2_SW3',
        'IMM3_SW4',
        'IMM4_SW5',
        'IMM5_SW11'
	];
	
	var environmentFields = ['1_3um_20_13_4', 'Temperature_12_11_0', '5um_20_13_9', '6_5um_20_13_10', '0_4um_18_13_0', '1_6um_18_13_5', '0_8um_20_13_2', '4um_20_13_8', 'Temperature_20_11_0', '1_6um_20_13_5', 'Humidity_7_11_1', 'Humidity_9_11_1', '5um_18_13_9', '3um_20_13_7', '0_5um_20_13_1', '8um_20_13_11', 'IRtemp_17_12_0', 'Humidity_4_11_1', '12um_18_13_13', 'Temperature_6_11_0', '0_4um_20_13_0', 'Temperature_10_11_0', '12um_19_13_13', 'Sampling_period_18_13_16', 'Humidity_2_11_1', 'Humidity_13_11_1', 'IRtemp_4_12_0', 'Flow_rate_19_13_17', 'Temperature_17_11_0', 'Humidity_6_11_1', 'Humidity_20_11_1', '14um_18_13_14', 'Temperature_19_11_0', '0_5um_19_13_1', '1um_19_13_3', 'Humidity_16_11_1', '1_3um_19_13_4', 'Temperature_1_11_0', '8um_18_13_11', '0_5um_18_13_1', 'Temperature_2_11_0', 'Humidity_11_11_1', 'Humidity_14_11_1', '16um-17um_18_13_15', 'Humidity_19_11_1', 'IRtemp_14_12_0', 'Humidity_1_11_1', 'Temperature_15_11_0', 'Sampling_period_19_13_16', '3um_19_13_7', 'Flow_rate_20_13_17', '12um_20_13_13', 'Humidity_15_11_1', 'Humidity_18_11_1', '14um_20_13_14', '2_1um_18_13_6', '6_5um_19_13_10', '4um_18_13_8', 'IRtemp_15_12_0', '1_3um_18_13_4', '4um_19_13_8', 'Humidity_8_11_1', 'Humidity_5_11_1', '1_6um_19_13_5', '8um_19_13_11', '0_8um_19_13_2', 'Humidity_17_11_1', '10um_19_13_12', '2_1um_19_13_6', 'Temperature_14_11_0', 'Humidity_10_11_1', 'Temperature_8_11_0', 'Sampling_period_20_13_16', '1um_20_13_3', 'Humidity_3_11_1', 'Temperature_4_11_0', 'Temperature_9_11_0', '14um_19_13_14', 'IRtemp_16_12_0', '0_4um_19_13_0', 'IRtemp_6_12_0', '10um_18_13_12', '2_1um_20_13_6', '6_5um_18_13_10', '16um-17um_20_13_15', 'Temperature_5_11_0', '16um-17um_19_13_15', 'Temperature_11_11_0', '5um_19_13_9', '10um_20_13_12', 'Temperature_13_11_0', 'Temperature_16_11_0', 'Temperature_7_11_0', 'Temperature_3_11_0', 'Humidity_12_11_1', '1um_18_13_3', '0_8um_18_13_2', 'Flow_rate_18_13_17', 'Temperature_18_11_0', '3um_18_13_7'];
	
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
	for (var i = 0; i < environmentFields.length; i++) {
		rawStores.push({
			name: environmentFields[i],
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
	
	exports.getInitZeroFields = function () {
		if (config.INITIALIZE_ZERO)
			return montracFields;
		else {
			return ['SW1_SW2', 'SW8_SW9', 'SW9_SW1'];
		}
	};
	
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
} else {
	throw new Error('Invalid use case!');
}