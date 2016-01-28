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
	 	},
	 	
	 	// for activity detection
	 	{
	 		"name" : "slips_closed",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "slips_closing",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "slips_open",
	 		"fields" : [
	 			{"name": "time_ms", "type": "uint64"},
	 			{"name": "time", "type": "datetime"},
	 			{"name": "value", "type": "float"}
	 		],
	 		"window": WINDOW_SIZE
	 	},
	 	{
	 		"name" : "slips_opening",
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
	 		{"name": "ram_vel_setpoint", "type": "float"},
	 		// activity recognition
	 		{"name": "slips_closed", "type": "float"},
	 		{"name": "slips_closing", "type": "float"},
	 		{"name": "slips_open", "type": "float"},
	 		{"name": "slips_opening", "type": "float"}
	 	]
	};
	
	var onlineAnalyticsStores = {
		fields: realTimeStores.fields.slice()
	}
	
	// friction coefficients
	onlineAnalyticsStores.fields.push({name: "coeff_swivel", type: "float", "null": true});
	onlineAnalyticsStores.fields.push({name: "coeff_gearbox", type: "float", "null": true});
	onlineAnalyticsStores.fields.push({name: "hl > Threshold", type: "float", "null": true});
	 		
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
			if (fieldNm == 'hl > Threshold')
				interpolation = 'current';
			if (fieldNm == 'slips_closed')
				interpolation = 'current';
			if (fieldNm == 'slips_closing')
				interpolation = 'current';
			if (fieldNm == 'slips_open')
				interpolation = 'current';
			if (fieldNm == 'slips_opening')
				interpolation = 'current';
			
			if (log.info())
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
			if (fieldNm == 'hl > Threshold')
				interpolation = 'current';
			if (fieldNm == 'slips_closed')
				interpolation = 'current';
			if (fieldNm == 'slips_closing')
				interpolation = 'current';
			if (fieldNm == 'slips_open')
				interpolation = 'current';
			if (fieldNm == 'slips_opening')
				interpolation = 'current';
			
			if (log.info())
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
	
	var environmentFields = ['Temperature - 9.11.0', 'Humidity - 9.11.1', 'Humidity - 3.11.1', 'Bin1(0,5um) - 18.13.1', 'Temperature - 11.11.0', 'Bin10(6,5um) - 20.13.10', 'Humidity - 12.11.1', 'Flow_rate - 19.13.17', 'Flow_rate - 18.13.17', 'Humidity - 15.11.1', 'Bin8(4um) - 19.13.8', 'Temperature - 4.11.0', 'Bin11(8um) - 19.13.11', 'Bin15(16um-17um) - 19.13.15', 'Humidity - 5.11.1', 'Bin2(0,8um) - 18.13.2', 'Bin13(12um) - 19.13.13', 'Humidity - 17.11.1', 'Temperature - 2.11.0', 'Humidity - 13.11.1', 'IRtemp - 15.12.0', 'Bin12(10um) - 20.13.12', 'Bin14(14um) - 19.13.14', 'Temperature - 12.11.0', 'Temperature - 13.11.0', 'Bin8(4um) - 18.13.8', 'Temperature - 5.11.0', 'Bin10(6,5um) - 18.13.10', 'Bin6(2,1um) - 19.13.6', 'IRtemp - 6.12.0', 'Humidity - 4.11.1', 'Bin9(5um) - 20.13.9', 'Flow_rate - 20.13.17', 'Bin0(0,4um) - 20.13.0', 'Bin5(1,6um) - 19.13.5', 'Sampling_period - 18.13.16', 'Bin0(0,4um) - 18.13.0', 'Bin12(10um) - 19.13.12', 'Temperature - 18.11.0', 'Bin1(0,5um) - 19.13.1', 'Humidity - 11.11.1', 'Bin7(3um) - 20.13.7', 'Humidity - 8.11.1', 'Bin0(0,4um) - 19.13.0', 'IRtemp - 17.12.0', 'IRtemp - 4.12.0', 'Bin4(1,3um) - 19.13.4', 'Humidity - 14.11.1', 'Bin2(0,8um) - 20.13.2', 'Bin3(1um) - 19.13.3', 'Temperature - 20.11.0', 'Bin3(1um) - 18.13.3', 'Bin1(0,5um) - 20.13.1', 'Bin15(16um-17um) - 18.13.15', 'Bin11(8um) - 20.13.11', 'Bin15(16um-17um) - 20.13.15', 'Sampling_period - 20.13.16', 'Temperature - 7.11.0', 'Temperature - 1.11.0', 'Bin10(6,5um) - 19.13.10', 'Bin5(1,6um) - 18.13.5', 'Humidity - 20.11.1', 'Bin2(0,8um) - 19.13.2', 'Bin9(5um) - 18.13.9', 'Bin6(2,1um) - 18.13.6', 'Humidity - 7.11.1', 'IRtemp - 14.12.0', 'Bin8(4um) - 20.13.8', 'Temperature - 16.11.0', 'Humidity - 2.11.1', 'Humidity - 1.11.1', 'Humidity - 6.11.1', 'Bin11(8um) - 18.13.11', 'Humidity - 19.11.1', 'Bin13(12um) - 18.13.13', 'Humidity - 10.11.1', 'Bin13(12um) - 20.13.13', 'Humidity - 16.11.1', 'Temperature - 6.11.0', 'Temperature - 8.11.0', 'Temperature - 17.11.0', 'Bin6(2,1um) - 20.13.6', 'Temperature - 15.11.0', 'Bin7(3um) - 19.13.7', 'IRtemp - 16.12.0', 'Bin5(1,6um) - 20.13.5', 'Temperature - 3.11.0', 'Bin3(1um) - 20.13.3', 'Bin12(10um) - 18.13.12', 'Bin4(1,3um) - 20.13.4', 'Bin14(14um) - 20.13.14', 'Sampling_period - 19.13.16', 'Temperature - 10.11.0', 'Temperature - 19.11.0', 'Humidity - 18.11.1', 'Bin9(5um) - 19.13.9', 'Temperature - 14.11.0', 'Bin7(3um) - 18.13.7', 'Bin4(1,3um) - 18.13.4', 'Bin14(14um) - 18.13.14'];
	
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
			return ['LACQUERING'].concat(montracFields.concat(environmentFields));
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