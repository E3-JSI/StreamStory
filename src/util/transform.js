var utils = require('../utils.js');
var fields = require('../../fields.js');
var config = require('../../config.js');

log.info('Initializing transform tools ...');
if (config.USE_CASE == config.USE_CASE_MHWIRTH) {
	log.info('Using MHWirth use case ...');
	
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

	for (var key in sensorToStoreIdMap) {
		storeToSensorIdMap[sensorToStoreIdMap[key]] = key;
	}
	
	function getStoreId(sensorId) {
		return sensorId;
	}
	
	function storeFromTag(tag) {
		return tagToStoreIdMap[tag];
	}
	
	module.exports = {
		transform: function (val) {
			var storeNm = storeFromTag(val.sensorId);
			var timestamp = val.timestamp;
			var value = val.eventProperties.value;

			return [
			    {
			    	store: storeNm,
			    	timestamp: timestamp,
			    	value: {
			    		time_ms: timestamp,
			    		time: utils.dateToQmDate(new Date(timestamp)),
			    		value: value
			    	}
			    }
			]
		}
	}
} else {
	log.info('Using Hella use case ...');
	
	var montracFields = fields.getMontracStores();
	
	log.info('Initializing queues ...');
	var queues = {};
	var prevQueueLengths = {};
	for (var i = 0; i < montracFields.length; i++) {
		var queueId = montracFields[i];
		queues[queueId] = [];
		prevQueueLengths[queueId] = 0;
	}
	
	function containsShuttle(queueId, shuttleId) {
		var queue = queues[queueId];
		for (var i = 0; i < queue.length; i++) {
			if (queue[i].shuttleId == shuttleId)
				return true;
		}
		return false;
	}
	
	function removeFromQueue(queueId, shuttleId) {
		var queue = queues[queueId];
		for (var i = 0; i < queue.length; i++) {
			if (queue[i].shuttleId == shuttleId) {
				queue.splice(i, 1);
				break;
			}
		}
		
		if (containsShuttle(queueId, shuttleId))
			log.warn('Queue %s still contains shuttle %d after removing it!')
	}
	
	function moveToQ(queueId, shuttleId, left, right) {
		if (!(queueId in queues))
			log.warn('Unknown queue: %s', queueId);
		
		var prevQId = null;
		for (var key in queues) {
			if (containsShuttle(key, shuttleId))
				prevQId = key;
				
			removeFromQueue(key, shuttleId);
		}
		
		if (prevQId != null) {
			if (prevQId == 'SW9' && queueId != 'PM2')
				log.warn('WTF!? Went from SW9 to %s', queueId);
		}
		
		queues[queueId].push({shuttleId: shuttleId, left: left, right: right});
	}
	
	var prevTimestamp = 0;
	
	module.exports = {
		transform: function (val) {
			var sensorId = val.sensorId;
			
			if (sensorId != 'montrac') {
				log.warn('Unknown sensorId: %s', sensorId);
				return [];
			}
			
			var timestamp = val.timestamp;
			
			var props = val.eventProperties;
			
			var location = props.location;
			var event = props.event;
			var shuttleId = props.shuttle;
			var left = props.leftPiece;
			var right = props.rightPiece;
			
			function isEventWorkDone(event) {
				return event == 'WorkDone (Automatic)' || event == 'WorkDone (Manual)' ||
					event == 'WorkDone(Automatic)' || event == 'WorkDone(Manual)';
			}
			
			function isEventTimeElapsed(event) {
				return event == 'CoolingTimeElapsed' || event == 'WorkDone (ManualControl)' ||
					event == 'WorkDone(ManualControl)';
			}
			
			function isLocationSw(location, switchNum) {
				return location == 'SW' + switchNum + ' (OUT)' || 
					location == 'SW' + switchNum + ' (MAIN)' ||
					location == 'SW' + switchNum + '(OUT)' || 
					location == 'SW' + switchNum + '(MAIN)'
			}
			
			if (event == 'Arrive') {
				var modLoc = location.replace(/\s*\(MAIN\)|\s*\(OUT\)/g, '');
				moveToQ(modLoc, shuttleId, left, right);
			} else {
				// moulding machines
				if (location == 'IMM1') {
					if (isEventWorkDone(event))
						moveToQ('IMM1_QC1', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (location == 'IMM2') {
					if (isEventWorkDone(event))
						moveToQ('IMM2_QC2', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (location == 'IMM3') {
					if (isEventWorkDone(event))
						moveToQ('IMM3_QC3', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (location == 'IMM4') {
					if (isEventWorkDone(event))
						moveToQ('IMM4_QC4', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (location == 'IMM5') {
					if (isEventWorkDone(event))
						moveToQ('IMM5_QC5', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				
				// cooling
				else if (location == 'QC1') {
					if (isEventTimeElapsed(event)) {
						moveToQ('QC1_SW2', shuttleId, left, right);
					} else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (location == 'QC2') {
					if (isEventTimeElapsed(event)) {
						moveToQ('QC2_SW3', shuttleId, left, right);
					} else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (location == 'QC3') {
					if (isEventTimeElapsed(event)) {
						moveToQ('QC3_SW4', shuttleId, left, right);
					} else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (location == 'QC4') {
					if (isEventTimeElapsed(event)) {
						moveToQ('QC4_SW5', shuttleId, left, right);
					} else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (location == 'QC5') {
					if (isEventTimeElapsed(event)) {
						moveToQ('QC5_SW11', shuttleId, left, right);
					} else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				
				// upper switches
				else if (isLocationSw(location, 2)) {
					// if the location is MAIN, then the shuttle was already on MAIN
					// and we have nothing to worry about
					if (event == 'Start')
						moveToQ('MAIN', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (isLocationSw(location, 3)) {
					// if the location is MAIN, then the shuttle was already on MAIN
					// and we have nothing to worry about
					if (event == 'Start')
						moveToQ('MAIN', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (isLocationSw(location, 4)) {
					// if the location is MAIN, then the shuttle was already on MAIN
					// and we have nothing to worry about
					if (event == 'Start')
						moveToQ('MAIN', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (isLocationSw(location, 5)) {	// TODO SW5 (OUT)
					if (event == 'Start')
						moveToQ('MAIN', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (isLocationSw(location, 11)) {
					if (event == 'Start')
						moveToQ('MAIN', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				
				// lower switches
				else if (location == 'SW1 (OUT)' || location == 'SW1(OUT)') {
					log.warn('Received SW1 (OUT) not sure how to handle!');
				}
				else if (isLocationSw(location, 1)) {
					if (event == 'Start')
						moveToQ('MAIN', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (location == 'SW8') {
					if (event == 'Start')
						moveToQ('SW8_PM1orSW9', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (location == 'SW9') {
					if (event == 'Start')
						moveToQ('SW9_PM2', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				
				// lacquering lines
				else if (location == 'PM1') {
					if (isEventWorkDone(event))
						moveToQ('MAIN', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
				else if (location == 'PM2') {
					if (isEventWorkDone(event))
						moveToQ('MAIN', shuttleId, left, right);
					else
						log.warn('Unknown event: %s for location %s', event, location);
				}
			}
			
			var vals = [];
			
			if (timestamp > prevTimestamp) {
				for (var queueId in queues) {
					var length = queues[queueId].length;
					
					if (length != prevQueueLengths[queueId]) {
						vals.push({
							store: queueId,
							timestamp: timestamp,
							value: {
								time_ms: timestamp,
					    		time: utils.dateToQmDate(new Date(timestamp)),
					    		value: length
							}
						});
						prevQueueLengths[queueId] = length;
					}
				}
				
				prevTimestamp = timestamp;
			}
			
			return vals;
		}
	}
}

module.exports.toDerivedEvent = function (timestamp, val) {
	var props = {};
	for (var key in val) {
		if (key == 'time') continue;
		props[key] = val[key];
	}
	
	var event = {
		timestamp: timestamp,
		componentId: 'Enricher',
		eventName: 'EnrichedEvent',
		eventProperties: props
	}
	
	if (log.debug())
		log.debug('Derived event: %s', JSON.stringify(event));
	
	return event;
}