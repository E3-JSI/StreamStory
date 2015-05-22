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

var storeToSensorIdMap = {};

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
		base.gc();
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
	
	dateToQmDate: function (date) {
		return date.toISOString().split('Z')[0];
	}
}