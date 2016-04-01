var config = require('./config.js');

console.log('Initializing fields ...');

var WINDOW_SIZE = 100000;

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
	
	var aggregateConfigs = {
		'hl > Threshold': {
			tick: {
				name: 'HlThresholdTick',
				type: 'timeSeriesTick',
				timestamp: 'time',
				value: 'hook_load'
			},
			aggr: {
				name: 'hookLoadThreshold',
		    	type: 'threshold',
		    	inAggr: 'HlThresholdTick',
		    	threshold: 12
			}
		},
		'RAM pos > Threshold': {
			tick: {
				name: 'RamPosThresholdTick',
				type: 'timeSeriesTick',
				timestamp: 'time',
				value: 'ram_pos_setpoint'
			},
			aggr: {
				name: 'ramPosThreshold',
		    	type: 'threshold',
		    	inAggr: 'RamPosThresholdTick',
		    	threshold: 2e4
			}
		},
		'Hook load 3h mean': {
			tick: {
				name: 'hlMaWindow',
				type: 'timeSeriesWinBuf',
				timestamp: 'time',
				value: 'hook_load',
				winsize: 1000*60*60*3
			},
			aggr: {
				name: 'HlMA',
				type: 'ma',
				inAggr: 'hlMaWindow'
			}
		},
		'HL rel mean diff': {
			aggr: {
				type: 'javaScript',
				name: 'hlMeanDiffRel',
				create: function () {
					var MAX_VAL = 1e3;
					
					var val = 0;
					
					return {
						type: 'javaScript',
						name: 'hlMeanDiffRel',
						saveJson: function () {
							return { val: val };
						},
						save: function (fout) {
							fout.write(val + '');
						},
						load: function (fin) {
							val = parseFloat(fin.readString());
						},
						onAdd: function (rec) {
							var mean = rec['Hook load 3h mean'];
							var hl = rec['hook_load'];
							
							val = (hl - mean) / mean;
							
							if (isNaN(val)) { val = 0; }
							else if (val > MAX_VAL) { val = MAX_VAL; }
							else if (val < -MAX_VAL) { val = -MAX_VAL; }
						},
						getFloat: function () {
							return val;
						}
					}
				}
			},
			'HL mean diff': {
				aggr: {
					type: 'javaScript',
					name: 'hlMeanDiff',
					create: function () {
						var val = 0;
						
						return {
							type: 'javaScript',
							name: 'hlMeanDiff',
							saveJson: function () {
								return { val: val };
							},
							save: function (fout) {
								fout.write(val + '');
							},
							load: function (fin) {
								val = parseFloat(fin.readString());
							},
							onAdd: function (rec) {
								var mean = rec['Hook load 3h mean'];
								var hl = rec['hook_load'];
								val = hl - mean;
							},
							getFloat: function () {
								return val;
							}
						}
					}
				}
			}
		}
	};
	
	for (var i = 0; i < rawStores.length; i++) {
		var storeConf = rawStores[i];
		
		var storeNm = storeConf.name;
		var aggrNm = storeNm + ' (EMA)';
		var tickNm = 'emaTick-' + i;
		
		aggregateConfigs[aggrNm] = {
			tick: {
				name: tickNm,
				type: 'timeSeriesTick',
				timestamp: 'time',
				value: storeNm
			},
			aggr: {
				name: 'ema-' + i,
				type: 'ema',
				emaType: 'linear',
				inAggr: tickNm,
				interval: 1000*60*60*3,
				initWindow: 1000*60*9
			}
		};
	}
	
	var onlineAnalyticsStores = {
		fields: realTimeStores.fields.slice()
	}
	
	// friction coefficients
	onlineAnalyticsStores.fields.push({name: "coeff_swivel", type: "float", "null": true});
	onlineAnalyticsStores.fields.push({name: "coeff_gearbox", type: "float", "null": true});
	
	for (var aggrNm in aggregateConfigs) {
		onlineAnalyticsStores.fields.push({name: aggrNm, type: 'float', 'null': true});
	}
	
	var streamStoryIgnoreFields = {}
	
	//==============================================================
	// EXPORTS
	//==============================================================
	
	exports.getRawStores = function () {
		return rawStores;
	}
	
	exports.getStreamAggregates = function () {
		return aggregateConfigs;
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
} 
else if (config.USE_CASE == config.USE_CASE_HELLA) {
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
	
	var environmentFields = [
	    'Temperature - 9.11.0',
	    'Humidity - 9.11.1',
	    'Humidity - 3.11.1',
	    'Bin1(0,5um) - 18.13.1',
	    'Temperature - 11.11.0',
	    'Bin10(6,5um) - 20.13.10',
	    'Humidity - 12.11.1',
	    'Flow_rate - 19.13.17',
	    'Flow_rate - 18.13.17',
	    'Humidity - 15.11.1',
	    'Bin8(4um) - 19.13.8',
	    'Temperature - 4.11.0',
	    'Bin11(8um) - 19.13.11',
	    'Bin15(16um-17um) - 19.13.15',
	    'Humidity - 5.11.1',
	    'Bin2(0,8um) - 18.13.2',
	    'Bin13(12um) - 19.13.13',
	    'Humidity - 17.11.1',
	    'Temperature - 2.11.0',
	    'Humidity - 13.11.1',
	    'IRtemp - 15.12.0',
	    'Bin12(10um) - 20.13.12',
	    'Bin14(14um) - 19.13.14',
	    'Temperature - 12.11.0',
	    'Temperature - 13.11.0',
	    'Bin8(4um) - 18.13.8',
	    'Temperature - 5.11.0',
	    'Bin10(6,5um) - 18.13.10',
	    'Bin6(2,1um) - 19.13.6',
	    'IRtemp - 6.12.0',
	    'Humidity - 4.11.1',
	    'Bin9(5um) - 20.13.9',
	    'Flow_rate - 20.13.17',
	    'Bin0(0,4um) - 20.13.0',
	    'Bin5(1,6um) - 19.13.5',
	    'Sampling_period - 18.13.16',
	    'Bin0(0,4um) - 18.13.0',
	    'Bin12(10um) - 19.13.12',
	    'Temperature - 18.11.0',
	    'Bin1(0,5um) - 19.13.1',
	    'Humidity - 11.11.1',
	    'Bin7(3um) - 20.13.7',
	    'Humidity - 8.11.1',
	    'Bin0(0,4um) - 19.13.0',
	    'IRtemp - 17.12.0',
	    'IRtemp - 4.12.0',
	    'Bin4(1,3um) - 19.13.4',
	    'Humidity - 14.11.1',
	    'Bin2(0,8um) - 20.13.2',
	    'Bin3(1um) - 19.13.3',
	    'Temperature - 20.11.0',
	    'Bin3(1um) - 18.13.3',
	    'Bin1(0,5um) - 20.13.1',
	    'Bin15(16um-17um) - 18.13.15',
	    'Bin11(8um) - 20.13.11',
	    'Bin15(16um-17um) - 20.13.15',
	    'Sampling_period - 20.13.16',
	    'Temperature - 7.11.0',
	    'Temperature - 1.11.0',
	    'Bin10(6,5um) - 19.13.10',
	    'Bin5(1,6um) - 18.13.5',
	    'Humidity - 20.11.1',
	    'Bin2(0,8um) - 19.13.2',
	    'Bin9(5um) - 18.13.9',
	    'Bin6(2,1um) - 18.13.6',
	    'Humidity - 7.11.1',
	    'IRtemp - 14.12.0',
	    'Bin8(4um) - 20.13.8',
	    'Temperature - 16.11.0',
	    'Humidity - 2.11.1',
	    'Humidity - 1.11.1',
	    'Humidity - 6.11.1',
	    'Bin11(8um) - 18.13.11',
	    'Humidity - 19.11.1',
	    'Bin13(12um) - 18.13.13',
	    'Humidity - 10.11.1',
	    'Bin13(12um) - 20.13.13',
	    'Humidity - 16.11.1',
	    'Temperature - 6.11.0',
	    'Temperature - 8.11.0',
	    'Temperature - 17.11.0',
	    'Bin6(2,1um) - 20.13.6',
	    'Temperature - 15.11.0',
	    'Bin7(3um) - 19.13.7',
	    'IRtemp - 16.12.0',
	    'Bin5(1,6um) - 20.13.5',
	    'Temperature - 3.11.0',
	    'Bin3(1um) - 20.13.3',
	    'Bin12(10um) - 18.13.12',
	    'Bin4(1,3um) - 20.13.4',
	    'Bin14(14um) - 20.13.14',
	    'Sampling_period - 19.13.16',
	    'Temperature - 10.11.0',
	    'Temperature - 19.11.0',
	    'Humidity - 18.11.1',
	    'Bin9(5um) - 19.13.9',
	    'Temperature - 14.11.0',
	    'Bin7(3um) - 18.13.7',
	    'Bin4(1,3um) - 18.13.4',
	    'Bin14(14um) - 18.13.14'
	];
	
	var moldingFields = [
	    'movementDifferential',
	    'meltCushion',
	    'jetTemperation',
	    'dosingTime',
	    'injectionTime',
	    'cycleTime',
	    'cavityPressure'
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
	for (var i = 0; i < moldingFields.length; i++) {
		rawStores.push({
			name: moldingFields[i],
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
	
	exports.getStreamAggregates = function () {
		return {};
	}
	
	exports.getInitZeroFields = function () {
		if (config.INITIALIZE_ZERO)
			return ['LACQUERING'].concat(montracFields.concat(environmentFields.concat(moldingFields)));
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
			});
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
else if (config.USE_CASE == config.USE_CASE_NRG) {

	betterNames = {
		//All
		"timestamp": "time",
		"dayOfWeek": "day_of_week",
		"dayOfYear": "day_of_year",
		"monthOfYear": "month_of_year",
		"weekEnd": "weekend",
		//CSI 
		"turin-building-CSI_BUILDING-buildingtotalconsumption": "csi_total_consumption",
		"turin-building-CSI_BUILDING-buildingcooling": "csi_cooling",
		"turin-building-CSI_BUILDING-buildingconsumptionnocooling": "csi_no_cooling_consumption",
		"turin-building-CSI_BUILDING-datacentrecooling": "csi_datacenter_cooling",
		"FIO-Turin-FIO-temperature": "csi_temperature",
		"FIO-Turin-FIO-humidity": "csi_humudity",
		"FIO-Turin-FIO-windSpeed": "csi_wind_speed",
		"FIO-Turin-FIO-windBearing": "csi_wind_bearing",
		"FIO-Turin-FIO-cloudCover": "csi_cloud_cover",
		"dayAfterHolidayTurin": "csi_day_after_holiday",
		"holidayTurin": "csi_holiday",
		"dayBeforeHolidayTurin": "csi_day_before_holiday",
		"heatingSeasonTurin": "csi_heating_season",
		//Iren
		"nubi-plant-IREN_THERMAL-Thermal_Production": "iren_thermal_production",
		"FIO-ReggioEmilia-FIO-temperature": "iren_temperature",
		"FIO-ReggioEmilia-FIO-humidity": "iren_humidity",
		"FIO-ReggioEmilia-FIO-windSpeed": "iren_wind_speed",
		"FIO-ReggioEmilia-FIO-windBearing": "iren_wind_bearing",
		"FIO-ReggioEmilia-FIO-cloudCover": "iren_cloud_cover",
		"dayAfterHolidayReggioEmilia": "iren_day_after_holiday",
		"holidayReggioEmilia": "iren_holiday",
        "workingHoursTurin": "turin_working_hours",
		"dayBeforeHolidayReggioEmilia": "iren_day_before_holiday",
		"heatingSeasonReggioEmilia": "iren_heating_season",
		// Ntua
		"ntua-BUILDING-NTUA_LAMPADARIO-energy": "ntua_energy",
		"FIO-Athens-FIO-temperature": "ntua_temperature",
		"FIO-Athens-FIO-humidity": "ntua_humidity",
		"FIO-Athens-FIO-windSpeed": "ntua_wind_speed",
		"FIO-Athens-FIO-windBearing": "ntua_wind_bearing",
		"dayAfterHolidayAthens": "ntua_day_after_holiday",
		"holidayAthens": "ntua_holiday",
		"dayBeforeHolidayAthens": "ntua_day_before_holiday",
		"workingHoursAthens": "ntua_working_hours",
		// Miren
		"miren-lamp-0025.0006.0019-MeasuredConsumption": "miren_lamp_consumption",
		"miren-traffic-kromberk-0209-21-circulation": "miren_traffic_circulation",
		"FIO-Miren-FIO-temperature": "miren_temperature",
		"FIO-Miren-FIO-humidity": "miren_humidity",
		"FIO-Miren-FIO-windSpeed": "miren_wind_speed",
		"FIO-Miren-FIO-cloudCover": "miren_wind_bearing",
		"dayAfterHolidayMiren": "miren_day_after_holiday",
		"holidayMiren": "miren_holiday",
		"dayBeforeHolidayMiren": "miren_day_before_holiday"		
	}
	console.log('Initializing fields for NRG4CAST ...');
	
	var rawStores = [];
	
	for (var key in betterNames) {
		if (key !== "timestamp") {
			rawStores.push({
				"name" : betterNames[key],
				"fields" : [
					{"name": "time_ms", "type": "uint64"},
					{"name": "time", "type": "datetime"},
					{"name": "value", "type": "float"}
				],
				"window": WINDOW_SIZE
			});
		}
	}
	
	var otherStores = [];
	
	var realTimeStores = {
	 	fields : [
	 		{"name": "time", "type": "datetime"}
	 	]
	};
	
	for (var i = 0; i < rawStores.length; i++) {
		realTimeStores.fields.push({ "name": rawStores[i].name, "type":  rawStores[i].fields[2].type });
		// console.log(rawStores[i].fields[2].type);
	}
	
	var onlineAnalyticsStores = {
		fields: realTimeStores.fields.slice()
	}
	
	// friction coefficients
	// onlineAnalyticsStores.fields.push({"name": "coeff_swivel", "type": "float", "null": true});
	// onlineAnalyticsStores.fields.push({"name": "coeff_gearbox", "type": "float", "null": true});
	
	var streamStoryIgnoreFields = {}
	
	//==============================================================
	// EXPORTS
	//==============================================================
	
	exports.getRawStores = function () {
		return rawStores;
	}
	
	exports.getBetterNames = function() {return betterNames;};
	
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

			
			log.info('Field %s is using %s interpolation ...', fieldNm, interpolation);

			result.merger.push({
				source: fieldNm,
				inField: 'value',
				outField: fieldNm,
				interpolation: interpolation,
				timestamp: 'time'
			});

		}
		
		return result;
	}
} 
else if (config.USE_CASE == config.USE_CASE_SIMULATION) {
	var fields = [
        'Torque',
        'Angular Acceleration',
        'Angular Speed',
        'Power',
        'Temperature',
        'Switch On'
	];
	
	var rawStores = [];
	for (var i = 0; i < fields.length; i++) {
		rawStores.push({
			name: fields[i],
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
	
	exports.getStreamAggregates = function () {
		return {};
	};
	
	exports.getInitZeroFields = function () {
		return fields;
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
			});
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
else if (config.USE_CASE == config.USE_CASE_TRAFFIC) {
	var fields = [
//	    "Timestamp",
		"0178-21 - Occupancy",
		"0178-21 - Gap",
		"0178-21 - Status",
		"0178-21 - Speed",
		"0178-21 - NoC",
		"0178-22 - Occupancy",
		"0178-22 - Gap",
		"0178-22 - Status",
		"0178-22 - Speed",
		"0178-22 - NoC",
		"0178-11 - Occupancy",
		"0178-11 - Gap",
		"0178-11 - Status",
		"0178-11 - Speed",
		"0178-11 - NoC",
		"0178-12 - Occupancy",
		"0178-12 - Gap",
		"0178-12 - Status",
		"0178-12 - Speed",
		"0178-12 - NoC",
		"0180-11 - Occupancy",
		"0180-11 - Gap",
		"0180-11 - Status",
		"0180-11 - Speed",
		"0180-11 - NoC",
		"0180-12 - Occupancy",
		"0180-12 - Gap",
		"0180-12 - Status",
		"0180-12 - Speed",
		"0180-12 - NoC",
		"0180-21 - Occupancy",
		"0180-21 - Gap",
		"0180-21 - Status",
		"0180-21 - Speed",
		"0180-21 - NoC",
		"0180-22 - Occupancy",
		"0180-22 - Gap",
		"0180-22 - Status",
		"0180-22 - Speed",
		"0180-22 - NoC",
		"0855-11 - Occupancy",
		"0855-11 - Gap",
		"0855-11 - Status",
		"0855-11 - Speed",
		"0855-11 - NoC",
		"0855-12 - Occupancy",
		"0855-12 - Gap",
		"0855-12 - Status",
		"0855-12 - Speed",
		"0855-12 - NoC",
		"0855-21 - Occupancy",
		"0855-21 - Gap",
		"0855-21 - Status",
		"0855-21 - Speed",
		"0855-21 - NoC",
		"0855-22 - Occupancy",
		"0855-22 - Gap",
		"0855-22 - Status",
		"0855-22 - Speed",
		"0855-22 - NoC",
		"0199-11 - Occupancy",
		"0199-11 - Gap",
		"0199-11 - Status",
		"0199-11 - Speed",
		"0199-11 - NoC",
		"0199-12 - Occupancy",
		"0199-12 - Gap",
		"0199-12 - Status",
		"0199-12 - Speed",
		"0199-12 - NoC",
		"0179-21 - Occupancy",
		"0179-21 - Gap",
		"0179-21 - Status",
		"0179-21 - Speed",
		"0179-21 - NoC",
		"0179-22 - Occupancy",
		"0179-22 - Gap",
		"0179-22 - Status",
		"0179-22 - Speed",
		"0179-22 - NoC",
		"0174-11 - Occupancy",
		"0174-11 - Gap",
		"0174-11 - Status",
		"0174-11 - Speed",
		"0174-11 - NoC",
		"0174-12 - Occupancy",
		"0174-12 - Gap",
		"0174-12 - Status",
		"0174-12 - Speed",
		"0174-12 - NoC",
		"0178-21 - Occupancy (1h)",
		"0178-21 - Gap (1h)",
		"0178-21 - Status (1h)",
		"0178-21 - Speed (1h)",
		"0178-21 - NoC (1h)",
		"0178-22 - Occupancy (1h)",
		"0178-22 - Gap (1h)",
		"0178-22 - Status (1h)",
		"0178-22 - Speed (1h)",
		"0178-22 - NoC (1h)",
		"0178-11 - Occupancy (1h)",
		"0178-11 - Gap (1h)",
		"0178-11 - Status (1h)",
		"0178-11 - Speed (1h)",
		"0178-11 - NoC (1h)",
		"0178-12 - Occupancy (1h)",
		"0178-12 - Gap (1h)",
		"0178-12 - Status (1h)",
		"0178-12 - Speed (1h)",
		"0178-12 - NoC (1h)",
		"0180-11 - Occupancy (1h)",
		"0180-11 - Gap (1h)",
		"0180-11 - Status (1h)",
		"0180-11 - Speed (1h)",
		"0180-11 - NoC (1h)",
		"0180-12 - Occupancy (1h)",
		"0180-12 - Gap (1h)",
		"0180-12 - Status (1h)",
		"0180-12 - Speed (1h)",
		"0180-12 - NoC (1h)",
		"0180-21 - Occupancy (1h)",
		"0180-21 - Gap (1h)",
		"0180-21 - Status (1h)",
		"0180-21 - Speed (1h)",
		"0180-21 - NoC (1h)",
		"0180-22 - Occupancy (1h)",
		"0180-22 - Gap (1h)",
		"0180-22 - Status (1h)",
		"0180-22 - Speed (1h)",
		"0180-22 - NoC (1h)",
		"0855-11 - Occupancy (1h)",
		"0855-11 - Gap (1h)",
		"0855-11 - Status (1h)",
		"0855-11 - Speed (1h)",
		"0855-11 - NoC (1h)",
		"0855-12 - Occupancy (1h)",
		"0855-12 - Gap (1h)",
		"0855-12 - Status (1h)",
		"0855-12 - Speed (1h)",
		"0855-12 - NoC (1h)",
		"0855-21 - Occupancy (1h)",
		"0855-21 - Gap (1h)",
		"0855-21 - Status (1h)",
		"0855-21 - Speed (1h)",
		"0855-21 - NoC (1h)",
		"0855-22 - Occupancy (1h)",
		"0855-22 - Gap (1h)",
		"0855-22 - Status (1h)",
		"0855-22 - Speed (1h)",
		"0855-22 - NoC (1h)",
		"0199-11 - Occupancy (1h)",
		"0199-11 - Gap (1h)",
		"0199-11 - Status (1h)",
		"0199-11 - Speed (1h)",
		"0199-11 - NoC (1h)",
		"0199-12 - Occupancy (1h)",
		"0199-12 - Gap (1h)",
		"0199-12 - Status (1h)",
		"0199-12 - Speed (1h)",
		"0199-12 - NoC (1h)",
		"0179-21 - Occupancy (1h)",
		"0179-21 - Gap (1h)",
		"0179-21 - Status (1h)",
		"0179-21 - Speed (1h)",
		"0179-21 - NoC (1h)",
		"0179-22 - Occupancy (1h)",
		"0179-22 - Gap (1h)",
		"0179-22 - Status (1h)",
		"0179-22 - Speed (1h)",
		"0179-22 - NoC (1h)",
		"0174-11 - Occupancy (1h)",
		"0174-11 - Gap (1h)",
		"0174-11 - Status (1h)",
		"0174-11 - Speed (1h)",
		"0174-11 - NoC (1h)",
		"0174-12 - Occupancy (1h)",
		"0174-12 - Gap (1h)",
		"0174-12 - Status (1h)",
		"0174-12 - Speed (1h)",
		"0174-12 - NoC (1h)",
		"0178-21 - Occupancy (3h)",
		"0178-21 - Gap (3h)",
		"0178-21 - Status (3h)",
		"0178-21 - Speed (3h)",
		"0178-21 - NoC (3h)",
		"0178-22 - Occupancy (3h)",
		"0178-22 - Gap (3h)",
		"0178-22 - Status (3h)",
		"0178-22 - Speed (3h)",
		"0178-22 - NoC (3h)",
		"0178-11 - Occupancy (3h)",
		"0178-11 - Gap (3h)",
		"0178-11 - Status (3h)",
		"0178-11 - Speed (3h)",
		"0178-11 - NoC (3h)",
		"0178-12 - Occupancy (3h)",
		"0178-12 - Gap (3h)",
		"0178-12 - Status (3h)",
		"0178-12 - Speed (3h)",
		"0178-12 - NoC (3h)",
		"0180-11 - Occupancy (3h)",
		"0180-11 - Gap (3h)",
		"0180-11 - Status (3h)",
		"0180-11 - Speed (3h)",
		"0180-11 - NoC (3h)",
		"0180-12 - Occupancy (3h)",
		"0180-12 - Gap (3h)",
		"0180-12 - Status (3h)",
		"0180-12 - Speed (3h)",
		"0180-12 - NoC (3h)",
		"0180-21 - Occupancy (3h)",
		"0180-21 - Gap (3h)",
		"0180-21 - Status (3h)",
		"0180-21 - Speed (3h)",
		"0180-21 - NoC (3h)",
		"0180-22 - Occupancy (3h)",
		"0180-22 - Gap (3h)",
		"0180-22 - Status (3h)",
		"0180-22 - Speed (3h)",
		"0180-22 - NoC (3h)",
		"0855-11 - Occupancy (3h)",
		"0855-11 - Gap (3h)",
		"0855-11 - Status (3h)",
		"0855-11 - Speed (3h)",
		"0855-11 - NoC (3h)",
		"0855-12 - Occupancy (3h)",
		"0855-12 - Gap (3h)",
		"0855-12 - Status (3h)",
		"0855-12 - Speed (3h)",
		"0855-12 - NoC (3h)",
		"0855-21 - Occupancy (3h)",
		"0855-21 - Gap (3h)",
		"0855-21 - Status (3h)",
		"0855-21 - Speed (3h)",
		"0855-21 - NoC (3h)",
		"0855-22 - Occupancy (3h)",
		"0855-22 - Gap (3h)",
		"0855-22 - Status (3h)",
		"0855-22 - Speed (3h)",
		"0855-22 - NoC (3h)",
		"0199-11 - Occupancy (3h)",
		"0199-11 - Gap (3h)",
		"0199-11 - Status (3h)",
		"0199-11 - Speed (3h)",
		"0199-11 - NoC (3h)",
		"0199-12 - Occupancy (3h)",
		"0199-12 - Gap (3h)",
		"0199-12 - Status (3h)",
		"0199-12 - Speed (3h)",
		"0199-12 - NoC (3h)",
		"0179-21 - Occupancy (3h)",
		"0179-21 - Gap (3h)",
		"0179-21 - Status (3h)",
		"0179-21 - Speed (3h)",
		"0179-21 - NoC (3h)",
		"0179-22 - Occupancy (3h)",
		"0179-22 - Gap (3h)",
		"0179-22 - Status (3h)",
		"0179-22 - Speed (3h)",
		"0179-22 - NoC (3h)",
		"0174-11 - Occupancy (3h)",
		"0174-11 - Gap (3h)",
		"0174-11 - Status (3h)",
		"0174-11 - Speed (3h)",
		"0174-11 - NoC (3h)",
		"0174-12 - Occupancy (3h)",
		"0174-12 - Gap (3h)",
		"0174-12 - Status (3h)",
		"0174-12 - Speed (3h)",
		"0174-12 - NoC (3h)",
		"0178-21 - Occupancy (1d)",
		"0178-21 - Gap (1d)",
		"0178-21 - Status (1d)",
		"0178-21 - Speed (1d)",
		"0178-21 - NoC (1d)",
		"0178-22 - Occupancy (1d)",
		"0178-22 - Gap (1d)",
		"0178-22 - Status (1d)",
		"0178-22 - Speed (1d)",
		"0178-22 - NoC (1d)",
		"0178-11 - Occupancy (1d)",
		"0178-11 - Gap (1d)",
		"0178-11 - Status (1d)",
		"0178-11 - Speed (1d)",
		"0178-11 - NoC (1d)",
		"0178-12 - Occupancy (1d)",
		"0178-12 - Gap (1d)",
		"0178-12 - Status (1d)",
		"0178-12 - Speed (1d)",
		"0178-12 - NoC (1d)",
		"0180-11 - Occupancy (1d)",
		"0180-11 - Gap (1d)",
		"0180-11 - Status (1d)",
		"0180-11 - Speed (1d)",
		"0180-11 - NoC (1d)",
		"0180-12 - Occupancy (1d)",
		"0180-12 - Gap (1d)",
		"0180-12 - Status (1d)",
		"0180-12 - Speed (1d)",
		"0180-12 - NoC (1d)",
		"0180-21 - Occupancy (1d)",
		"0180-21 - Gap (1d)",
		"0180-21 - Status (1d)",
		"0180-21 - Speed (1d)",
		"0180-21 - NoC (1d)",
		"0180-22 - Occupancy (1d)",
		"0180-22 - Gap (1d)",
		"0180-22 - Status (1d)",
		"0180-22 - Speed (1d)",
		"0180-22 - NoC (1d)",
		"0855-11 - Occupancy (1d)",
		"0855-11 - Gap (1d)",
		"0855-11 - Status (1d)",
		"0855-11 - Speed (1d)",
		"0855-11 - NoC (1d)",
		"0855-12 - Occupancy (1d)",
		"0855-12 - Gap (1d)",
		"0855-12 - Status (1d)",
		"0855-12 - Speed (1d)",
		"0855-12 - NoC (1d)",
		"0855-21 - Occupancy (1d)",
		"0855-21 - Gap (1d)",
		"0855-21 - Status (1d)",
		"0855-21 - Speed (1d)",
		"0855-21 - NoC (1d)",
		"0855-22 - Occupancy (1d)",
		"0855-22 - Gap (1d)",
		"0855-22 - Status (1d)",
		"0855-22 - Speed (1d)",
		"0855-22 - NoC (1d)",
		"0199-11 - Occupancy (1d)",
		"0199-11 - Gap (1d)",
		"0199-11 - Status (1d)",
		"0199-11 - Speed (1d)",
		"0199-11 - NoC (1d)",
		"0199-12 - Occupancy (1d)",
		"0199-12 - Gap (1d)",
		"0199-12 - Status (1d)",
		"0199-12 - Speed (1d)",
		"0199-12 - NoC (1d)",
		"0179-21 - Occupancy (1d)",
		"0179-21 - Gap (1d)",
		"0179-21 - Status (1d)",
		"0179-21 - Speed (1d)",
		"0179-21 - NoC (1d)",
		"0179-22 - Occupancy (1d)",
		"0179-22 - Gap (1d)",
		"0179-22 - Status (1d)",
		"0179-22 - Speed (1d)",
		"0179-22 - NoC (1d)",
		"0174-11 - Occupancy (1d)",
		"0174-11 - Gap (1d)",
		"0174-11 - Status (1d)",
		"0174-11 - Speed (1d)",
		"0174-11 - NoC (1d)",
		"0174-12 - Occupancy (1d)",
		"0174-12 - Gap (1d)",
		"0174-12 - Status (1d)",
		"0174-12 - Speed (1d)",
		"0174-12 - NoC (1d)"
	];
	
	var rawStores = [];
	for (var i = 0; i < fields.length; i++) {
		rawStores.push({
			name: fields[i],
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
	
	exports.getStreamAggregates = function () {
		return {};
	};
	
	exports.getInitZeroFields = function () {
		return fields;
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
			});
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
else {
	throw new Error('Invalid use case!');
}