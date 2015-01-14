var qm = require(global.qmModulePath + 'qm.node');
var analytics = require(global.qmModulePath + 'analytics.node');

function createFeatureSpace(store) {
	try {
		log.info('Creating feature space ...');
		log.info('================================================');
		
		var fieldConfigV = [];
		store.fields.forEach(function (field) {
			log.info('Field: \'%s\', type: \'%s\'', field.name, field.type);
			
			if (field.type == 'float') {
				fieldConfigV.push({
					type: 'numeric',
					source: {store: store.name},
					field: field.name,
					normalize: true
				});
			}
		});
		
		log.info('================================================');
		
		var ftrSpace = new qm.FeatureSpace(base, fieldConfigV);
		
		return ftrSpace;
	} catch (e) {
		log.error(e, 'Failed to create feature space!');
		throw e;
	}
}

var HMC = function (mc, ftrSpace) {
	return {
		fit: function (recSet) {
			log.info('Updating feature space ...');
			ftrSpace.updateRecords(recSet);
			
			var colMat = ftrSpace.ftrColMat(recSet);
			var timeV = recSet.getVec('time');
			
			log.info('Creating model ...');
			mc.fit(colMat, timeV);
			log.info('Done!');
		},
		
		update: function (rec) {
			var ftrVec = ftrSpace.ftrVec(rec);
			var recTm = rec.time;
			var timestamp = recTm.getTime();
			
			mc.update(ftrVec, timestamp);
		},
		
		save: function (mcFName, ftrFname) {
			log.info('Saving Markov chain ...');
			mc.save(mcFName);
			log.info('Saving feature space ...');
			ftrSpace.save(ftrFname);
			log.info('Done!');
		},
		
		getVizState: function () {
			log.debug('Fetching visualization ...');
			return mc.toJSON();
		},
		
		getModel: function () {
			return mc;
		},
		
		getFtrSpace: function () {
			return ftrSpace;
		},
		
		currStates: function () {
			return mc.currStates();
		},
		
		futureStates: function (level, state, time) {
			return mc.futureStates(level, state, time);
		},
		
		stateDetails: function (state, level) {
			var coords = mc.fullCoords(state);
			var invCoords = ftrSpace.invFtrVec(coords);
			var futureStates = mc.futureStates(level, state);
			
			var features = [];
			for (var i = 0; i < invCoords.length; i++) {
				features.push({name: ftrSpace.getFtr(i), value: invCoords.at(i)});
			}
			
			return {
				features: features,
				futureStates: futureStates
			};
		},
		
		onStateChanged: function (callback) {
			mc.onStateChanged(callback);
		},
		
		onAnomaly: function (callback) {
			mc.onAnomaly(callback);
		}
	};
};

exports.create = function (recSet, ctmcParams) {
	log.info('Creating hierarchical Markov chain ...');
	
	var ftrSpace = createFeatureSpace(recSet.store);

	var mc = new analytics.HMC(ctmcParams);
	
	var result = HMC(mc, ftrSpace);
	result.fit(recSet);
	
	log.info('Done!');
	
	return result;
};

exports.load = function (mcFName, ftrFname) {
	log.info('Loading a HMC model ...');
	
	var mc = new analytics.HMC(mcFName);
	var ftrSpace = new qm.FeatureSpace(base, ftrFname);
	
	if (log.debug())
		log.debug('Setting verbocity to ' + CTMC_VERBOSE);
	mc.setParams({verbose: CTMC_VERBOSE});
	
	var result = HMC(mc, ftrSpace);
	
	log.info('Done!');
	
	return result;
};
