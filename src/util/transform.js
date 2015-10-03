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
				
				if (shuttleH[shuttleId].lacqueringId != lacqueringId)
					log.debug('Shuttle %d changed lacquering line to %s ...', shuttleId, lacqueringId);
				
				shuttleH[shuttleId].lacqueringId = lacqueringId;
			},
			onArrivedMoulding: function (shuttleId, mouldingId) {
				handleEmpty(shuttleId);
				
				if (shuttleH[shuttleId].mouldingId != mouldingId)
					log.debug('Shuttle %d changed moulding machine to %s ...', shuttleId, mouldingId);
				
				shuttleH[shuttleId].mouldingId = mouldingId;
			},
			getLacqueringId: function (shuttleId) {
				handleEmpty(shuttleId);
				
				if (shuttleH[shuttleId].lacqueringId == null)
					log.debug('Shuttle %d doesn\'t have a LL yet!', shuttleId);
				
				return shuttleH[shuttleId].lacqueringId;
			},
			getMouldingId: function (shuttleId) {
				handleEmpty(shuttleId);
				
				if (shuttleH[shuttleId].mouldingId == null)
					log.debug('Shuttle %d doesn\'t have a MM yet!', shuttleId);
				
				return shuttleH[shuttleId].mouldingId;
			}
		}
	}
	
	var upperSwitchRules = {
		'SW2': {
			'MAIN': 'SW2_SW3',
			'OUT': 'SW2_SW3'
		},
		'SW3': {},	// no direct rules
		'SW4': {
			'MAIN': 'SW4_SW5',
			'OUT': 'SW4_SW5'
		},
		'SW5': {
			'MAIN': 'SW5_SW11',
			'OUT': 'SW5_SW11'
		},
		'SW11': {
			'MAIN': 'SW11_SW8',
			'OUT': 'SW11_SW8'
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
	var prevTimestamp = 0;
	
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
	
	function removeFromQueues(shuttleId) {
		var prevQId = null;
		for (var key in queues) {
			if (containsShuttle(key, shuttleId))
				prevQId = key;
				
			removeFromQueue(key, shuttleId);
		}
	}
	
	function moveToQ(queueId, shuttleId, left, right) {
		removeFromQueues(shuttleId);
		if (queueId == null) {
			log.debug('Unknown queue for shuttle %d!', shuttleId);
			return;
		}
		
		if (!(queueId in queues))
			log.warn('Unknown queue: %s', queueId);

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
	
	function isUpperSwitch(sw) {
		return sw in upperSwitchRules;
	}
	
	function isLacquering(location) {
		return location.startsWith('PM');
	}
	
	function isSwitch(location) {
		return location.startsWith('SW');
	}
	
	function isMouldingMachine(location) {
		return location.startsWith('IMM');
	}
	
	function isQC(location) {
		return location.startsWith('QC');
	}

	function getSwitchId(location) {
		var match = location.match('SW\\d+');
		return match != null && match.length > 0 ? match[0] : null;
	}
	
	function getSwitchConfig(location) {
		var match = location.match('\\([a-zA-Z]+\\)');
		return match != null && match.length > 0 ? match[0].replace(/\(|\)/g,'') : null;
	}
	
	function calcNextQueue(shuttleId, location) {
		if (isSwitch(location)) {
			var sw = getSwitchId(location);
			var switchConfig = getSwitchConfig(location);
			if (isUpperSwitch(sw)) {
				if (sw != 'SW3')
					return upperSwitchRules[sw][switchConfig];
				else {	// SW3
					var mm = shuttleConfig.getMouldingId(shuttleId);
					
					if (mm == null) return null;	// TODO return null??
					
					if (mm == 'IMM1' || mm == 'IMM2') {
						return 'SW3_SW8';
					} else {
						return 'SW3_SW4';
					}
				}
			} else if (sw == 'SW1') {
				// lower switch, special rules
				return 'SW1_SW2';
			} else {	// SW8,9
				if (sw == 'SW8') {
					var lacqueringId = shuttleConfig.getLacqueringId(shuttleId);
					if (lacqueringId == null) return null;
					return lacqueringId == 'PM1' ? 'SW8_PM1' : 'SW8_SW9';
				} else if (sw == 'SW9') {
					return 'SW9_PM2';
				} else {
					log.warn('WTF!? Shuttle %d, location %s', shuttleId, location);
				}
			}
		}
		else if (isLacquering(location)) {
			var mouldingId = shuttleConfig.getMouldingId(shuttleId);
			if (mouldingId == null) return null;
			return location + '_' + mouldingId;
		}
		else if (isMouldingMachine(location)) {	// IMM
			switch (location) {
			case 'IMM1':
				return 'IMM1_SW2';
			case 'IMM2':
				return 'IMM2_SW3';
			case 'IMM3':
				return 'IMM3_SW4';
			case 'IMM4':
				return 'IMM4_SW5';
			case 'IMM5':
				return 'IMM5_SW11';
			default:
				log.warn('Strange moulding machine location: %s', location);
				return null;
			}
		} else {
			log.warn('Strange location %s', location);
		}
	}
	
	function onArrivedMoulding(timestamp, shuttleId, location) {
		timeCalculator.onShuttleArrived(timestamp, shuttleId, location);
		shuttleConfig.onArrivedMoulding(shuttleId, location);
	}
	
	function onFinishedLacquering(timestamp, shuttleId, location, left, right) {
		timeCalculator.onShuttleStarted(timestamp, shuttleId, location);
		shuttleConfig.onFinishedLacquering(shuttleId, location);
	}
	
	function onArrived(timestamp, location, shuttleId, left, right) {
		if (isMouldingMachine(location)) {
			onArrivedMoulding(timestamp, shuttleId, location);
		} else if (isLacquering(location)) {
			addToLacquering(timestamp, shuttleId, left, right);
		}
	}
	
	function onFinished(timestamp, shuttleId, location, left, right) {
		if (!isQC(location)) {
			var nextQ = calcNextQueue(shuttleId, location);
			moveToQ(nextQ, shuttleId, left, right);
			if (location == 'PM1' || location == 'PM2') {
				onFinishedLacquering(timestamp, shuttleId, location, left, right);
			}
		}
	}
	
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
			
			if (event == 'Arrive')
				onArrived(timestamp, location, shuttleId, left, right);
			else
				onFinished(timestamp, shuttleId, location, left, right);
			
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