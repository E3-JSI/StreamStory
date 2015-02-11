var analytics = qm.analytics;

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
		
		getFtrNames: function () {
			var names = [];
			
			var dims = ftrSpace.dims;
			for (var i = 0; i < dims.length; i++) {
				names.push(ftrSpace.getFtr(i));
			}
			
			return names;
		},
		
		/**
		 * Returns state details as a Javascript object.
		 */
		stateDetails: function (stateId, level) {
			var coords = mc.fullCoords(stateId);
			var invCoords = ftrSpace.invFtrVec(coords);
			var futureStates = mc.futureStates(level, stateId);
			var pastStates = mc.pastStates(level, stateId);
			var stateNm = mc.getStateName(stateId);
			
			var ftrNames = that.getFtrNames();
			var features = [];
			for (var i = 0; i < invCoords.length; i++) {
				features.push({name: ftrNames[i], value: invCoords.at(i)});
			}
			
			return {
				id: stateId,
				name: stateNm.length > 0 ? stateNm : null,
				features: features,
				futureStates: futureStates,
				pastStates: pastStates
			};
		},
		
		/**
		 * Returns a histogram for the desired feature in the desired state.
		 */
		histogram: function (stateId, ftrIdx) {
			var hist = mc.histogram(stateId, ftrIdx);
			
			for (var i = 0; i < hist.binStartV.length; i++) {
				hist.binStartV[i] = ftrSpace.invFtr(ftrIdx, hist.binStartV[i]);
			}
			
			return hist;
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
		},
		
		getFtrDist: function (height, ftrIdx) {
			var stateIds = mc.stateIds(height);
			
			var result = [];
			for (var i = 0; i < stateIds.length; i++) {
				var stateId = stateIds[i];
				var coords = ftrSpace.invFtrVec(mc.fullCoords(stateId));
				
				result.push({ state: stateId, value: coords[ftrIdx] });
			}
			
			return result;
		}
	};
	
	return that;
};