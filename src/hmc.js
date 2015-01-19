var qm = require(global.qmModulePath + 'qm.node');
var analytics = require(global.qmModulePath + 'analytics.node');

exports.HMC = function (opts) {
	// constructor
	if (opts == null) throw 'Missing parameters!';
	if (opts.base == null) throw 'Missing parameter base!';
	
	// create model and feature space
	var mc;
	var ftrSpace;
	
	if (opts.hmcConfig != null && opts.ftrSpaceConfig != null && opts.base != null) {
		mc = new analytics.HMC(opts.hmcConfig);
		ftrSpace = new qm.FeatureSpace(opts.base, opts.ftrSpaceConfig);
	} 
	else if (opts.hmcFile != null && opts.ftrSpaceFile != null) {
		mc = new analytics.HMC(opts.hmcFile);
		ftrSpace = new qm.FeatureSpace(opts.base, opts.ftrSpaceFile);
	}
	
	// public methods
	var that = {
		/**
		 * Creates a new model out of the record set.
		 */
		fit: function (recSet) {
			log.info('Updating feature space ...');
			ftrSpace.updateRecords(recSet);
			
			var colMat = ftrSpace.ftrColMat(recSet);
			var timeV = recSet.getVec('time');
			
			log.info('Creating model ...');
			mc.fit(colMat, timeV);
			log.info('Done!');
			
			return that;
		},
		
		
		update: function (rec) {
			var ftrVec = ftrSpace.ftrVec(rec);
			var recTm = rec.time;
			var timestamp = recTm.getTime();
			
			mc.update(ftrVec, timestamp);
		},
		
		/**
		 * Saves the feature space and model into the specified files.
		 */
		save: function (mcFName, ftrFname) {
			log.info('Saving Markov chain ...');
			mc.save(mcFName);
			log.info('Saving feature space ...');
			ftrSpace.save(ftrFname);
			log.info('Done!');
		},
		
		/**
		 * Returns the state used in the visualization.
		 */
		getVizState: function () {
			log.debug('Fetching visualization ...');
			return mc.toJSON();
		},
		
		/**
		 * Returns the hierarchical Markov chain model.
		 */
		getModel: function () {
			return mc;
		},
		
		/**
		 * Returns the feature space.
		 */
		getFtrSpace: function () {
			return ftrSpace;
		},
		
		/**
		 * Returns the current state at the specified height. If the height is not specified it
		 * returns the current states through the hierarchy.
		 */
		currState: function (height) {
			return mc.currState(height);
		},
		
		/**
		 * Returns the most likely future states.
		 */
		futureStates: function (level, state, time) {
			return mc.futureStates(level, state, time);
		},
		
		/**
		 * Returns the most likely future states.
		 */
		pastStates: function (level, state, time) {
			return mc.pastStates(level, state, time);
		},
		
		/**
		 * Returns state details as a Javascript object.
		 */
		stateDetails: function (stateId, level) {
			var coords = mc.fullCoords(stateId);
			var invCoords = ftrSpace.invFtrVec(coords);
			var futureStates = mc.futureStates(level, stateId);
			var pastStates = mc.pastStates(level, stateId);
			
			var features = [];
			for (var i = 0; i < invCoords.length; i++) {
				features.push({name: ftrSpace.getFtr(i), value: invCoords.at(i)});
			}
			
			return {
				id: stateId,
				features: features,
				futureStates: futureStates,
				pastStates: pastStates
			};
		},
		
		/**
		 * Callback when the current state changes.
		 */
		onStateChanged: function (callback) {
			mc.onStateChanged(callback);
		},
		
		/**
		 * Callback when an anomaly is detected.
		 */
		onAnomaly: function (callback) {
			mc.onAnomaly(callback);
		},
		
		onOutlier: function (callback) {
			mc.onOutlier(function (ftrV) {
				var invFtrV = ftrSpace.invFtrVec(ftrV);
				
				var features = [];
				for (var i = 0; i < invFtrV.length; i++) {
					features.push({name: ftrSpace.getFtr(i), value: invFtrV.at(i)});
				}
				
				callback(features);
			});
		}
	};
	
	return that;
};