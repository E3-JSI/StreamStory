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
			if (log.trace())
				log.trace('Transforming event: %s', JSON.stringify(val));
			
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
	var MinTimeCalculator = function () {
		var shuttleTimeH = {};
		var minTimeH = {};
		
		return {
			onShuttleStarted: function (timestamp, shuttleId, lacqueringId) {
				shuttleTimeH[shuttleId] = { timestamp: timestamp, lacqueringId: lacqueringId };
			},
			onShuttleArrived: function (timestamp, shuttleId, mouldingId) {
				if (shuttleId in shuttleTimeH) {
					var start = shuttleTimeH[shuttleId].timestamp;
					var lacqueringId = shuttleTimeH[shuttleId].lacqueringId;
					delete shuttleTimeH[shuttleId];
					
					var end = timestamp;
					var time = end - start;
					
					if (!(lacqueringId in minTimeH))
						minTimeH[lacqueringId] = {};
					if (!(mouldingId in minTimeH[lacqueringId]) || time < minTimeH[lacqueringId][mouldingId]) {
						minTimeH[lacqueringId][mouldingId] = time;
						log.info('Min shuttle time updated: %s', JSON.stringify(minTimeH));
					}
				}
			}
		}
	}
	
	var ShuttleConfigTracker = function () {
		var shuttleH = {};
		
		function handleEmpty(shuttleId) {
			if (!(shuttleId in shuttleH))
				shuttleH[shuttleId] = {};
		}
		
		return {
			onFinishedLacquering: function (shuttleId, lacqueringId) {
				handleEmpty(shuttleId);
				shuttleH[shuttleId].lacqueringId = lacqueringId;
			},
			onArrivedMoulding: function (shuttleId, mouldingId) {
				handleEmpty(shuttleId);
				shuttleH[shuttleId].mouldingId = mouldingId;
			},
			getShuttleLacqueringId: function (shuttleId) {
				handleEmpty(shuttleId);
				return shuttleH[shuttleId].lacqueringId;
			},
			getShuttleMouldingId: function (shuttleId) {
				handleEmpty(shuttleId);
				return shuttleH[shuttleId].mouldingId;
			}
		}
	}
	
	log.info('Using Hella use case ...');
	
	var timeCalculator = MinTimeCalculator();
	var shuttleConfig = ShuttleConfigTracker();
	
	var LACQUERING_TIME = 1000*60*15;
	
	var queues = {};
	var lacqueringLine = [];
	
	var prevQueueLengths = {};
	var prevLLSize = -1;
	
	var montracFields = fields.getMontracStores();
	
	log.info('Initializing queues ...');
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
	
	function addToLacquering(timestamp, shuttleId, left, right) {
		lacqueringLine.push({timestamp: timestamp, shuttleId: shuttleId, left: left, right: right});
	}
	
	function cleanLacqueringLine(timestamp) {
		while (lacqueringLine.length > 0 && timestamp - lacqueringLine[0].timestamp > LACQUERING_TIME) {
			lacqueringLine.shift();
		}
	}
	
	function countLacqueredParts() {
		var count = 0;
		for (var i = 0; i < lacqueringLine.length; i++) {
			if (lacqueringLine[i].left) count++;
			if (lacqueringLine[i].right) count++;
		}
		return count;
	}
	
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
	
	function isLocationMM(location) {
		return location == 'IMM1' || 
			location == 'IMM2' || 
			location == 'IMM3' ||
			location == 'IMM4' || 
			location == 'IMM5';
	}
	
	function onArrivedMoulding(timestamp, shuttleId, location) {
		timeCalculator.onShuttleArrived(timestamp, shuttleId, location);
		shuttleConfig.onArrivedMoulding(shuttleId, location);
	}
	
	function onFinishedLacquering(timestamp, shuttleId, location) {
		timeCalculator.onShuttleStarted(timestamp, shuttleId, location);
		shuttleConfig.onFinishedLacquering(shuttleId, location);
	}
	
	var prevTimestamp = 0;
	
	module.exports = {
		transform: function (val) {
			var sensorId = val.sensorId;
			
			if (sensorId != 'montrac') {
				log.warn('Unknown sensorId: %s', sensorId);
				return [];
			}
			
			// TODO handle SW1
			
			var timestamp = val.timestamp;
			
			var props = val.eventProperties;
			
			var location = props.location;
			var event = props.event;
			var shuttleId = props.shuttle;
			var left = props.leftPiece;
			var right = props.rightPiece;
			
			if (event == 'Arrive') {
				if (location == 'PM1' || location == 'PM2') {
					addToLacquering(timestamp, shuttleId, left, right);
				}
				
				if (isLocationMM(location)) {
					onArrivedMoulding(timestamp, shuttleId, location);
				}
				
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
					if (event == 'Start') {
						var lacqueringId = shuttleConfig.getShuttleLacqueringId(shuttleId);
						if (lacqueringId == 'PM1' && (left == true || right == true)) {
							moveToQ('SW8_PM1', shuttleId, left, right);
						} else {
							moveToQ('SW8_SW9', shuttleId, left, right);
						}
						
					}
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
				else if (location == 'PM1' || location == 'PM2') {
					if (isEventWorkDone(event)) {
						moveToQ('MAIN', shuttleId, left, right);
						onFinishedLacquering(timestamp, shuttleId, location)
					} else
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
				
				// lacquering
				cleanLacqueringLine(timestamp);
				var llSize = countLacqueredParts();
				
				if (prevLLSize != llSize) {
					vals.push({
						store: 'LACQUERING',
						timestamp: timestamp,
						value: {
							time_ms: timestamp,
				    		time: utils.dateToQmDate(new Date(timestamp)),
				    		value: llSize
						}
					});
					prevLLSize = llSize;
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
		componentId: 'enricher',
		eventName: config.USE_CASE == config.USE_CASE_MHWIRTH ? 'mhwirth' : 'hella',
		eventProperties: props
	}
	
	return event;
}

module.exports.parseDerivedEvent = function (event) {
	var timestamp = event.timestamp;
	var componentId = event.componentId;
	var eventName = event.eventName;
	var props = event.eventProperties;
	
	var val = utils.clone(props);
	val.time = utils.dateToQmDate(new Date(timestamp));
	
	return val;
}

module.exports.genExpPrediction = function (lambda, timeUnit, timestamp) {
	var msg = {
		timestamp: timestamp,
		eventName: 'prediction',
		params: [lambda],
		eventProperties: { timeUnit: timeUnit },
		pdfType: 'exponential'
	};
	
	return msg;
}

module.exports.genHistPrediction = function (timestamp, eventName, timeV, valV, timeUnit, metadata) {
	var tu;
	if (timeUnit == 'second')
		tu = 1000;
	else if (timeUnit == 'minute')
		tu = 1000*60;
	else if (timeUnit == 'hour')
		tu = 1000*60*60;
	else if (timeUnit == 'day')
		tu = 1000*60*60*24;
	else if (timeUnit == 'month')
		tu = 1000*60*60*24*30;
	else
		throw new Error('Invalid time unit: ' + timeUnit);
	
	var timestampV = [];
	for (var i = 0; i < timeV.length; i++) {
		timestampV.push(timestamp + Math.floor(timeV[i]*tu));
	}
	
	return {
		timestamp: timestamp,
		eventName: eventName,
		params: valV,
		eventProperties: metadata != null ? metadata : {},
		pdfType: 'histogram',
		timestamps: timestampV
	}
}