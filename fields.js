var config = require('./config.js');

console.log('Initializing fields ...');

var WINDOW_SIZE = 10000;

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

exports.ENRICHED_STORE = 'enriched';
exports.OA_IN_STORE = 'oa_in';
exports.STREAM_STORY_STORE = 'stream_story';
exports.COEFF_STORE = 'friction_coeffs';

exports.SS_TIME_FIELD = 'time';

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

//exports.getStreamStoryFtrSpaceFields = function () {
//	var result = { obsFields: [], contrFields: [] };
//	var storeFields = realTimeStores.fields;
//	
//	var inFlds = {
//		hook_load: true,
//		oil_temp_gearbox: true,
//		oil_temp_swivel: true,
//		pressure_gearbox: true,
//		wob: true,
//		ram_vel_setpoint: true,
////		ram_pos_setpoint: true,
//		rpm: true,
//		torque: true,
//		ibop: true
//	}
//	
//	for (var i = 0; i < storeFields.length; i++) {
//		var field = storeFields[i];
//		var fieldNm = field.name;
//		
//		if (!(fieldNm in inFlds)) continue;
//		
//		var fldConfig = {
//			field: fieldNm,
//			source: exports.STREAM_STORY_STORE,
//			type: 'numeric',
//			normalize: fieldNm != 'ibop'
//		};
//		
//		if (log.info())
//			log.info('Feature space field: %s', JSON.stringify(fldConfig));
//		
//		if (fieldNm == 'rpm' || fieldNm == 'torque' || fieldNm == 'ibop') {
//			result.contrFields.push(fldConfig);
//		} else {
//			result.obsFields.push(fldConfig);
//		}
//	}
//	
//	return result;
//}

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