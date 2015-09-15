var fs = require('fs');
var mkdirp = require('mkdirp');
var config = require('../config.js');

//=============================================
// INTERNAL/EXTERNAL CONVERSION
//=============================================

var sensorToStoreIdMap = {
	'MHWirth.DDM.DrillingRPM': 'rpm',
	'MHWirth.DDM.DrillingTorque': 'torque',
	'MHWirth.DDM.HookLoad': 'hook_load',
	'MHWirth.DDM.GearLubeOilTemp': 'oil_temp_gearbox',
	'MHWirth.DDM.GearBoxPressure': 'pressure_gearbox',
	'MHWirth.DDM.SwivelOilTemp': 'oil_temp_swivel',
	'MHWirth.DrillBit.WeightOnBit': 'wob',
	'MHWirth.Env.OutdoorTemp': 'temp_ambient',
	'MHWirth.Ram.PositionSetPoint': 'ram_pos_setpoint',
	'MHWirth.Ram.PositionMeasuredValue': 'ram_pos_measured',
	'MHWirth.Ram.VelocitySetPoint': 'ram_vel_setpoint',
	'MHWirth.Ram.VelocityMeasuredValue': 'ram_vel_measured',
	'MHWirth.Rig.MRUPosition': 'mru_pos',
	'MHWirth.Rig.MRUVelocity': 'mru_vel'
};

var tagToStoreIdMap = {
	'1000693': 'rpm',
	'1000700': 'torque',
	'1002311': 'hook_load',
	'1000695': 'oil_temp_gearbox',
	'1000692': 'pressure_gearbox',
	'1000696': 'oil_temp_swivel',
	'1002123': 'wob',
	'1033619': 'temp_ambient',
	'1002113': 'ram_pos_setpoint',
	'1002115': 'ram_pos_measured',
	'1002114': 'ram_vel_setpoint',
	'1002116': 'ram_vel_measured',
	'1002127': 'mru_pos',
	'1002128': 'mru_vel',
	'1012923': 'ibop',
	'1001378': 'hoist_press_A',
	'1001379': 'hoist_press_B'
};

var storeToSensorIdMap = {};
var storeToTagMap = {};

for (var key in sensorToStoreIdMap) {
	storeToSensorIdMap[sensorToStoreIdMap[key]] = key;
}

function getStoreId(sensorId) {
	return sensorId;	// TODO this is just for testing
//	return sensorToStoreIdMap[sensorId];	for the deployment
}

function getSensorId(storeId) {
	return storeToSensorIdMap[storeId];
}

function convertRawExternal(batch) {
	var result = [];
	
	batch.forEach(function (val) {
		if (val.sensorId == 'MHWirth.DDM.HookLoad')
			return;
		
		result.push({
			store: getStoreId(val.sensorId),
			timestamp: val.timestamp,
			value: val.value
		});
	});
	
	return result;
}


//=============================================
// EXIT FUNCTIONS
//=============================================

function closeBase(base) {
	log.info('Closing base ...');
	
	if (base != null) {
		log.info('Closing ...');
		base.garbageCollect()
		base.close();
	}
	
	log.info('Done!');
}

function exit(base) {
	log.info('Closing application ...');
	closeBase(base);
	process.exit(1);
}

//=============================================
// EXPORTS
//=============================================

module.exports = {
	closeBase: closeBase,
	exit: exit,

	getStoreId: getStoreId,
	
	storeFromTag: function (tag) {
		if (config.USE_CASE == config.USE_CASE_MHWIRTH)
			return tagToStoreIdMap[tag];
		else
			return tag;
	},
	
	tagFromStore: function (store) {
		if (config.USE_CASE == config.USE_CASE_MHWIRTH)
			return storeToTagMap[store];
		else
			return store;
	},
	
	dateToQmDate: function (date) {
		return date.toISOString().split('Z')[0];
	},
	
	isFinite: function (num) {
		return !isNaN(num) && isFinite(num);
	},
	
	RecBuffer: function (size) {
		var buff = [];
		
		this.add = function (rec) {
			buff.unshift(rec);
			while (buff.length > size) 
				buff.pop();
		};
		
		this.getLast = function () {
			return buff.length > 0 ? buff[0] : null;
		}
		
		this.clear = function () {
			buff = [];
		};
	},
	
	createDirSync: function (dir) {
		if (!fs.existsSync(dir)) {
			log.info('Creating directory %s ...', dir);
			mkdirp.sync(dir);
		}
	},
	
	clone: function (obj) {
		return JSON.parse(JSON.stringify(obj));
	}
}