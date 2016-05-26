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
		// TODO activity recognition is not available yet
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
		'1001379': 'hoist_press_B',
		// activity recognition
		'1012911': 'slips_closed',
		'1012922': 'slips_closing',
		'1012910': 'slips_open',
		'1012920': 'slips_opening',
		// new use-case
		'1000255': 'upper_clamp',
		'1000257': 'lower_clamp',
		'1000304': 'torque_wrench_rot',
		'1000302': 'tr_breakout_dir',
		'1000239': 'hrn_travel',
		'1001545': 'travel_forward',
		'1001546': 'travel_backward',
		'1000249': 'hrn_travel_valve',
		'1000297': 'hrn_spinning_out',
		'1012934': 'hrn_spinner_clamp_closed',
		'1000240': 'hrn_elevation',
		'1000250': 'hrn_elevation_up_down',
		'1001549': 'hrn_elevate_up',
		'1012918': 'brc_load',
		'1000572': 'brc_fwd_travel_valve',
		'1000555': 'brc_travel_pos_fleg',
		'1000568': 'brc_travel_valve',
		'1000553': 'brc_travel_pos',
		'1000573': 'brc_grip_upper_valve',
		'1000575': 'brc_grip_lower_valve',
		'1000570': 'brc_lift_valve',
		'1000564': 'brc_standlift_pos'
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
} else if (config.USE_CASE == config.USE_CASE_HELLA) {
	var MinTimeCalculator = function () {
		var shuttleTimeH = {};
		var minTimeH = {"PM1":{"IMM2":77000,"IMM1":55000},"PM2":{"IMM4":117000,"IMM3":91000,"IMM5":137000}};
		
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
			},
			getMinTime: function (ll, mm) {
				if (ll in minTimeH && mm in minTimeH[ll])
					return minTimeH[ll][mm];
				else return null;
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
				
				if (shuttleH[shuttleId].lacqueringId == null && log.trace())
					log.trace('Shuttle %d doesn\'t have a LL yet!', shuttleId);
				
				return shuttleH[shuttleId].lacqueringId;
			},
			getMouldingId: function (shuttleId) {
				handleEmpty(shuttleId);
				
				if (shuttleH[shuttleId].mouldingId == null && log.trace())
					log.trace('Shuttle %d doesn\'t have a MM yet!', shuttleId);
				
				return shuttleH[shuttleId].mouldingId;
			}
		}
	}
	
	log.info('Using Hella use case ...');
	
	var timeCalculator = MinTimeCalculator();
	var shuttleConfig = ShuttleConfigTracker();
	
	var LACQUERING_TIME = 1000*60*15;
	var MAX_MOULDING_QUEUE_SIZE = 3;
	
	var queues = {};
	var lacqueringLine = [];
	
	var prevQueueLengths = {};
	var prevLLSize = -1;
	var prevTimestamp = 0;	
	var prevEnvironmentTimestamp = 0;
	
	var envPrevTimestamp = 0;
	var environmentBuff = {};
	
	var montracFields = fields.getMontracStores();
	
	log.info('Initializing queues ...');
	for (var i = 0; i < montracFields.length; i++) {
		var queueId = montracFields[i];
		queues[queueId] = [];
		prevQueueLengths[queueId] = -1;
	}
	
	function containsShuttle(queueId, shuttleId) {
		var queue = queues[queueId];
		for (var i = 0; i < queue.length; i++) {
			if (queue[i].shuttleId == shuttleId)
				return true;
		}
		return false;
	}
	
	function getQueueSize(queueId) {
		return queues[queueId].length;
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
			log.warn('Queue %s still contains shuttle %d after removing it!', queueId, shuttleId)
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
		if (log.trace())
			log.trace('Moving shuttle %d to queue %s, isFull ' + (left || right), shuttleId, queueId);
		
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
		return sw == 'SW1' || sw == 'SW2' || sw == 'SW3' || sw == 'SW4' || sw == 'SW5' || sw == 'SW11';
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
	
	function printIncorrectQueue(shuttleId, queueId, location, isFull, ll) {
		var llSize = getQueueSize(ll =='PM1' ? 'SW8_PM1' : 'SW9_PM2');
		log.debug('Shuttle %d should be in queue %s (size %d), but is at %s, full: ' + isFull + ', lacquering line %s, ll size: %d', shuttleId, queueId, getQueueSize(queueId), location, ll, llSize);
	}
	
	function handleQueueCorrections(shuttleId, location, left, right) {
		if (isQC(location)) {
			var nextQ = null;
			
			switch (location) {
			case 'QC1':
				if (!containsShuttle('IMM1_SW2', shuttleId)) {
					nextQ = 'IMM1_SW2';
				}
				break;
			case 'QC2':
				if (!containsShuttle('IMM2_SW3', shuttleId)) {
					nextQ = 'IMM2_SW3';
				}
				break;
			case 'QC3':
				if (!containsShuttle('IMM3_SW4', shuttleId)) {
					nextQ = 'IMM3_SW4';
				}
				break;
			case 'QC4':
				if (!containsShuttle('IMM4_SW5', shuttleId)) {
					nextQ = 'IMM4_SW5';
				}
				break;
			case 'QC5':
				if (!containsShuttle('IMM5_SW11', shuttleId)) {
					nextQ = 'IMM5_SW11';
				}
				break;
			}
			
			if (nextQ != null) {
				if (log.debug())
					log.debug('Correcting the position of shuttle %s. Placing it in queue %s ...', shuttleId, nextQ);
				moveToQ(nextQ, shuttleId, left, right);
			}
		}
	}
	
	function calcNextQueue(shuttleId, location, left, right) {
		var mm = shuttleConfig.getMouldingId(shuttleId);
		var ll = shuttleConfig.getLacqueringId(shuttleId);
		
		if (isSwitch(location)) {
			var sw = getSwitchId(location);
			var switchConfig = getSwitchConfig(location);
			
			if (sw == 'SW1') {
				if (left || right || mm != 'IMM1' || 
						getQueueSize('SW1_IMM1') >= MAX_MOULDING_QUEUE_SIZE) {
					return 'SW1_SW2';
				} else {
					return 'SW1_IMM1';
				}
			}
			if (sw == 'SW2') {
				if (containsShuttle('SW1_IMM1', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW1_IMM1', sw, left || right, ll);
				}
				
				if (left || right || mm != 'IMM2' || 
						getQueueSize('SW2_IMM2') >= MAX_MOULDING_QUEUE_SIZE) {
					return 'SW2_SW3';
				} else {
					return 'SW2_IMM2';
				}
			}
			else if (sw == 'SW3') {					
				if (mm == null) return null;	// TODO return null??
				
				if (containsShuttle('SW2_IMM2', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW2_IMM2', sw, left || right, ll);
				}
				
				if (mm == 'IMM3') {
					if (left || right || 
							getQueueSize('SW3_IMM3') >= MAX_MOULDING_QUEUE_SIZE) {
						return 'SW3_SW4';
					} else {
						return 'SW3_IMM3';
					}
				} else if (mm == 'IMM1' || mm == 'IMM2') {
					// TODO check if this is correct
					if (left || right) {
						return 'SW3_SW8';
					} else {
						return 'SW3_SW4';
					}
				} else {
					return 'SW3_SW4';
				}
			}
			else if (sw == 'SW4') {
				if (containsShuttle('SW3_IMM3', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW3_IMM3', sw, left || right, ll);
				}
				if (containsShuttle('SW3_SW8', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW3_SW8', sw, left || right, ll);
				}
				
				if (left || right || mm != 'IMM4' || 
						getQueueSize('SW4_IMM4') >= MAX_MOULDING_QUEUE_SIZE) {
					return 'SW4_SW5';
				} else {
					return 'SW4_IMM4';
				}
			} else if (sw == 'SW5') {
				if (containsShuttle('SW4_IMM4', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW4_IMM4', sw, left || right, ll);
				}
				
				if (left || right || mm != 'IMM5' || 
						getQueueSize('SW5_IMM5') >= MAX_MOULDING_QUEUE_SIZE) {
					return 'SW5_SW11';
				} else {
					return 'SW5_IMM5';
				}
			} else if (sw == 'SW11') {
				if (containsShuttle('SW5_IMM5', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW5_IMM5', sw, left || right, ll);
				}
				
				return 'SW11_SW8';
			} 
			else if (sw == 'SW8') {
				if ((left || right) && ll == 'PM1') {
					return 'SW8_PM1';
				} else {
					return 'SW8_SW9';
				}
			} else if (sw == 'SW9') {
				if (containsShuttle('SW8_PM1', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW8_PM1', sw, left || right, ll);
				}
				
				if ((left || right) && ll == 'PM2') {
					return 'SW9_PM2';
				} else {
					return 'SW9_SW1';
				}
			} else {
				log.warn('WTF!? Shuttle %d, location %s', shuttleId, location);
			}
		}
		else if (isLacquering(location)) {
			if (location.startsWith('PM2')) {
				if (containsShuttle('SW9_SW1', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW8_SW9', location, left || right, ll);
				}
				
				return 'PM2_SW1';
			} else {
				if (containsShuttle('SW8_SW9', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW8_SW9', location, left || right, ll);
				}
				
				return 'PM1_SW1';
			}
		}
		else if (isMouldingMachine(location)) {	// IMM
			switch (location) {
			case 'IMM1':
				if (containsShuttle('SW1_SW2', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW1_SW2', location, left || right, ll);
				}
				
				return 'IMM1_SW2';
			case 'IMM2':
				if (containsShuttle('SW2_SW3', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW2_SW3', location, left || right, ll);
				}
				
				return 'IMM2_SW3';
			case 'IMM3':
				if (containsShuttle('SW3_SW8', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW3_SW8', location, left || right, ll);
				}
				if (containsShuttle('SW3_SW4', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW3_SW4', location, left || right, ll);
				}
				return 'IMM3_SW4';
			case 'IMM4':
				if (containsShuttle('SW4_SW5', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW4_SW5', location, left || right, ll);
				}
				
				return 'IMM4_SW5';
			case 'IMM5':
				if (containsShuttle('SW5_SW11', shuttleId)) {
					printIncorrectQueue(shuttleId, 'SW5_SW11', location, left || right, ll);
				}
				
				return 'IMM5_SW11';
			default:
				log.warn('Strange moulding machine location: %s', location);
				return null;
			}
		} 
		else {
			log.warn('Strange location %s', location);
		}
	}
	
	function onArrivedMoulding(timestamp, shuttleId, location, left, right) {
		if (log.trace())
			log.trace('Shuttle %d arrived to moulding machine %s', shuttleId, location);
		
		timeCalculator.onShuttleArrived(timestamp, shuttleId, location);
		shuttleConfig.onArrivedMoulding(shuttleId, location);
		moveToQ(calcNextQueue(shuttleId, location, left, right), shuttleId, left, right);
	}
	
	function onFinishedLacquering(timestamp, shuttleId, location, left, right) {
		timeCalculator.onShuttleStarted(timestamp, shuttleId, location);
		shuttleConfig.onFinishedLacquering(shuttleId, location);
	}
	
	function onArrived(timestamp, location, shuttleId, left, right) {
		if (isMouldingMachine(location)) {
			onArrivedMoulding(timestamp, shuttleId, location, left, right);
		} else if (isLacquering(location)) {
			addToLacquering(timestamp, shuttleId, left, right);
		} else if (isQC(location)) {
			handleQueueCorrections(shuttleId, location, left, right)
		}
	}
	
	function onFinished(timestamp, shuttleId, location, left, right) {
		if (!isQC(location)) {
			var nextQ = calcNextQueue(shuttleId, location, left, right);
			moveToQ(nextQ, shuttleId, left, right);
			if (location == 'PM1' || location == 'PM2') {
				onFinishedLacquering(timestamp, shuttleId, location, left, right);
			}
		} else {
			handleQueueCorrections(shuttleId, location, left, right)
		}
	}
		
	module.exports = {
		getMinShuttleTime: function (ll, mm) {
			return timeCalculator.getMinTime(ll, mm);
		},
		transform: function (val) {
			var sensorId = val.sensorId;
			var timestamp = val.timestamp;
			var props = val.eventProperties;
			
			if (sensorId == 'montrac') {				
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
				
				function getQueueSizes() {
					var result = {};
					for (var queueId in queues) {
						var size = getQueueSize(queueId);
						result[queueId] = size;
					}
					return result;
				}
				
				if (timestamp > prevTimestamp) {
					for (var queueId in queues) {
						var length = getQueueSize(queueId);
						
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
				
				if (log.trace())
					log.trace('Transform returning %d values ...', vals.length);
				
				return vals;
			}
			else if ('unit' in props) {	// environmental
				var value = props.value;
				var name = props.name;
				
				var transVal = {
					store: name + ' - ' + sensorId,
					timestamp: timestamp,
					value: {
						time_ms: timestamp,
						time: utils.dateToQmDate(new Date(timestamp)),
						value: value
					}
				};
				var retVal = [];
				
				if (envPrevTimestamp != timestamp) {
					for (var key in environmentBuff)
						retVal.push(environmentBuff[key]);
					environmentBuff = {};
				}
				
				environmentBuff[sensorId] = transVal;
				envPrevTimestamp = timestamp;
				
				return retVal;
			}
			else if (sensorId == 'moulding') {
				log.warn('Unknown moulding sensor: %s', JSON.stirngify(val));
				return [];
			}
			else {
				log.warn('Unknown sensorId: %s', JSON.stirngify(val));
				return [];
			}
		}
	}
} else if (config.USE_CASE == config.USE_CASE_NRG) {
	log.info('Using CSI use case ...');

	var betterName = fields.getBetterNames();
	function sensorToStoreIdMap (name) {
		if (!betterNames[name]) return name;
		return betterNames[name];
	};

	// var tagToStoreIdMap = {
		// '1000693': 'rpm'
	// };
	
//	var storeToSensorIdMap = {};
//
//	for (var key in sensorToStoreIdMap) {
//		storeToSensorIdMap[sensorToStoreIdMap(key)] = key;
//	}
	
	function getStoreId(sensorId) {
		return sensorId;
	}
	
	// function storeFromTag(tag) {
		// return tagToStoreIdMap[tag];
	// }
	
	module.exports = {
		transform: function (val) {
			if (log.trace())
				log.trace('Transforming event: %s', JSON.stringify(val));
			
			var storeNm = sensorToStoreIdMap(val["sensorId"]); // val.sensorId; // TODO 
			var timestamp = val["time"];
			var value = val["value"];

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
} else if (config.USE_CASE == config.USE_CASE_SIMULATION) {
	module.exports = {
		transform: function (val) {
			if (log.trace())
				log.trace('Transforming event: %s', JSON.stringify(val));
			
			var storeNm = val.store;
			var timestamp = val.timestamp;
			
			var result = [];
			for (var key in val) {
				if (key == 'timestamp') continue;
				
				var value = val[key];
				
				result.push({
					store: key,
					timestamp: timestamp,
					value: {
						time_ms: timestamp,
			    		time: utils.dateToQmDate(new Date(timestamp)),
			    		value: value
					}
				});
			}
			
			return result;
		}	
	};
}
else if (config.USE_CASE == config.USE_CASE_TRAFFIC) {
	module.exports = {
		transform: function (val) {
			if (log.trace())
				log.trace('Transforming event: %s', JSON.stringify(val));
			
			var storeNm = val.store;
			var timestamp = val.timestamp;
			
			var result = [];
			for (var key in val) {
				if (key == 'timestamp') continue;
				
				var value = val[key];
				
				result.push({
					store: key,
					timestamp: timestamp,
					value: {
						time_ms: timestamp,
			    		time: utils.dateToQmDate(new Date(timestamp)),
			    		value: value
					}
				});
			}
			
			return result;
		}	
	};
} 
else {
	log.error(new Error('Exception in transform!'), 'Invalid use case: %d', config.USE_CASE);
	process.exit(1);
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
	var timestamp = event.timestamp != null ? event.timestamp : event.time;
	var componentId = event.componentId;
	var eventName = event.eventName;
	var props = event.eventProperties;
	
	var val = utils.clone(props);
	val.timestamp = utils.dateToQmDate(new Date(timestamp));
	
	return val;
}

module.exports.parseDominiksRawEvent = function (msg) {
	return {
		sensorId: 'montrac',
		timestamp: msg.payload.variable_timestamp,
		eventProperties: {
			location: msg.payload.location,
			event: msg.payload.event,
			shuttle: msg.payload.shuttle,
			leftPiece: msg.payload.leftPiece,
			rightPiece: msg.payload.rightPiece
		}
	};
}

module.exports.parseDominiksDerivedEvent = function (event) {
	var val = utils.clone(event);
	
	delete val.pipelineId;
	delete val.time;
	
	return {
		timestamp: event.time != null ? event.time : new Date().getTime(),
		componentId: 'cep',
		eventName: event.pipelineId,
		eventProperties: val
	}
}

module.exports.genExpPrediction = function (lambda, timeUnit, date) {
	var msg = {
		timestamp: date.getTime(),
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