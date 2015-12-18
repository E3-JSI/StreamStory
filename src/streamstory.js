var async = require('async')

var analytics = qm.analytics;

/**
 * StreamStory.
 * @class
 * @param {opts} HierarchMarkovParam - parameters. TODO typedef and describe
 */
exports.StreamStory = function (opts) {
	//===================================================
	// CONSTRUCTOR
	//===================================================

	if (opts == null) throw new Error('Missing parameters!');
	if (opts.base == null) throw new Error('Missing parameter base!');

	// create model and feature space
	var mc;
	var base = opts.base;
	var obsFtrSpace;
	var controlFtrSpace;
	var id;
	var active = false;
	var online = false;

	if (opts.base != null && opts.config != null) {
		mc = new analytics._StreamStory(opts.config);
		if (opts.obsFields != null && opts.contrFields != null) {
    		obsFtrSpace = new qm.FeatureSpace(opts.base, opts.obsFields);
    		controlFtrSpace = new qm.FeatureSpace(opts.base, opts.contrFields);
		}
		else if (opts.obsFtrSpace != null && opts.controlFtrSpace != null) {
			obsFtrSpace = opts.obsFtrSpace;
			controlFtrSpace = opts.controlFtrSpace;
		}
		else {
			throw new Error('Missing feature space configuration!');
		}
	}
	else if (opts.fname != null) {
		log.info('Loading StreamStory from:%s ', opts.fname);
		var fin = new qm.fs.FIn(opts.fname);
		
		mc = new analytics._StreamStory(fin);
		log.info('Loading feature spaces ...');
		obsFtrSpace = new qm.FeatureSpace(base, fin);
		controlFtrSpace = new qm.FeatureSpace(base, fin);
		log.info('Loaded!');
	}
	else {
		throw new Error('Missing parameters (base and config) or fname!');
	}

	//===================================================
	// FEATURE HELPER FUNCTIONS
	//===================================================

	function getFtrNames(ftrSpace) {
		var names = [];

		var dims = ftrSpace.dims;
		for (var i = 0; i < dims.length; i++) {
			var ftrDesc = ftrSpace.getFeature(i);
			var match = ftrDesc.match(/\[\w*\]$/)[0];	// remove Numeric[ ]

			if (match != null)
				names.push(match.substring(1, match.length-1));
			else
				names.push(ftrDesc);
		}

		return names;
	}

	function getFtrCount(ftrSpace) {
		return ftrSpace.dims.length
	}

	function getObsFtrCount() {
		return getFtrCount(obsFtrSpace);
	}

	function getContrFtrCount() {
		return getFtrCount(controlFtrSpace);
	}

	function getObsFtrNames() {
		return getFtrNames(obsFtrSpace);
	}

	function getControlFtrNames() {
		return getFtrNames(controlFtrSpace);
	}

	function getFtrDescriptions(stateId) {
		var observations = [];
		var controls = [];

		var obsFtrCount = getObsFtrCount();

		var coords = mc.fullCoords(stateId);
		var obsFtrNames = getObsFtrNames();
		var invObsCoords = obsFtrSpace.invertFeatureVector(coords);
		for (var i = 0; i < invObsCoords.length; i++) {
			observations.push({
				name: obsFtrNames[i],
				value: invObsCoords.at(i),
				isControl: false,
				bounds: getFtrBounds(i)
			});
		}

		var controlCoords = mc.fullCoords(stateId, false);
		var contrFtrNames = getControlFtrNames();
		var invControlCoords = controlFtrSpace.invertFeatureVector(controlCoords);
		for (var i = 0; i < invControlCoords.length; i++) {
			controls.push({
				name: contrFtrNames[i],
				value: invControlCoords.at(i),
				isControl: true,
				bounds: getFtrBounds(i + obsFtrCount)
			});
		}

		return {
			observations: observations,
			controls: controls,
			isBottom: mc.isLeaf(stateId)
		};
	}

	function getFtrCoord(stateId, ftrIdx) {
		if (ftrIdx < obsFtrSpace.dims.length) {
			return obsFtrSpace.invertFeatureVector(mc.fullCoords(stateId))[ftrIdx];
		} else {
			return controlFtrSpace.invertFeatureVector(mc.fullCoords(stateId, false))[ftrIdx - obsFtrSpace.dims.length];
		}
	}
	
	function invertFeature(ftrId, val) {
		var nObsFtrs = getObsFtrCount();

		if (ftrId < nObsFtrs) {
			return obsFtrSpace.invertFeature(ftrId, val);
		} else {
			return controlFtrSpace.invertFeature(ftrId - nObsFtrs, val);
		}
	}

	function getFtrBounds(ftrId) {
		var obsFtrCount = getObsFtrCount();
		var bounds = mc.getFtrBounds(ftrId);

		if (ftrId < obsFtrCount) {
			return {
				min: obsFtrSpace.invertFeature(ftrId, bounds.min),
				max: obsFtrSpace.invertFeature(ftrId, bounds.max)
			}
		} else {
			return {
				min: controlFtrSpace.invertFeature(ftrId - obsFtrCount, bounds.min),
				max: controlFtrSpace.invertFeature(ftrId - obsFtrCount, bounds.max)
			}
		}
	}

	//===================================================
	// HISTOGRAM
	//===================================================


	function toServerHistogram(hist, ftrId) {
		var nObsFtrs = getObsFtrCount();

		if (ftrId < nObsFtrs) {
			for (var i = 0; i < hist.binStartV.length; i++) {
				hist.binStartV[i] = obsFtrSpace.invertFeature(ftrId, hist.binStartV[i]);
			}
		} else {
			for (var i = 0; i < hist.binStartV.length; i++) {
				hist.binStartV[i] = controlFtrSpace.invertFeature(ftrId - nObsFtrs, hist.binStartV[i]);
			}
		}

		return hist;
	}
	
	//===================================================
	// PREPROCESSING
	//===================================================
	
	function preprocessFit(opts, callback) {
		if (opts.recSet == null && opts.recV == null) 
			throw new Error('StreamStory.fit: missing parameters recSet or recV');
		
		var batchEndV = opts.batchEndV;
		var timeField = opts.timeField;
		
		var obsColMat;
		var contrColMat;
		
		if (opts.recV != null) {
			var recV = opts.recV;
			
			async.parallel([
			    function (callback) {
			    	log.debug('Updating observation feature space ...');
			    	obsFtrSpace.updateRecordsAsync(recV, callback);
			    },
			    function (callback) {
			    	log.debug('Updating control feature space ...');
			    	controlFtrSpace.updateRecordsAsync(recV, callback);
			    }
			], function (e) {
				if (e != null) {
					callback(e);
					return;
				}
				
				try {
					log.debug('Feature spaces updated!');
					async.parallel([
					    function (callback) {
					    	if (log.debug())
					    		log.debug('Extracting observation feature matrix!');
					    	obsFtrSpace.extractMatrixAsync(recV, callback);
					    },
					    function (callback) {
					    	if (log.debug())
					    		log.debug('Extracting control feature matrix!');
					    	controlFtrSpace.extractMatrixAsync(recV, callback);
					    }
					], function (e, results) {
						if (e != null) {
							log.error(e, 'Exception while creating feature matrices!');
							callback(e);
							return;
						}
						
						if (log.debug())
							log.debug('Feature matrices extracted!');
						
						callback(undefined, {
		    				obsColMat: results[0],
		    				contrColMat: results[1]
		    			});
					});
				} catch (e) {
					log.error(e, 'Exception while extracting feature matrices!');
					callback(e);
				}
			});
		} else {
			var recSet = opts.recSet;
			
			log.info('Updating feature spaces ...');
			obsFtrSpace.updateRecords(recSet);
			controlFtrSpace.updateRecords(recSet);
			
			obsColMat = obsFtrSpace.extractMatrix(recSet);
			contrColMat = controlFtrSpace.extractMatrix(recSet);
			
			callback(undefined, {
				obsColMat: obsColMat,
				contrColMat: contrColMat
			});
		}
	}

	//===================================================
	// PUBLIC METHODS
	//===================================================

	// public methods
	var that = {
		getId: function () {
			return id;
		},

		setId: function (modelId) {
			id = modelId;
		},

		isActive: function () {
			return active;
		},

		setActive: function (act) {
			active = act;
		},

		isOnline: function () {
			return online;
		},

		setOnline: function (isOnline) {
			online = isOnline;
		},

		/**
		 * Creates a new model out of the record set.
		 */
		fit: function (opts) {
			if (opts.recSet == null && opts.recV == null)
				throw new Error('StreamStory.fit: missing parameters recSet or recV');

			var batchEndV = opts.batchEndV;
			var timeField = opts.timeField;
			var timeV = opts.timeV;
			
			var data = preprocessFit(opts, function (e, data) {
				if (e != null) {
					throw e;
				}
				
				log.info('Creating model ...');
    			mc.fit({
    				observations: data.obsColMat,
    				controls: data.contrColMat,
    				times: timeV,
    				batchV: batchEndV
    			});
    			log.info('Done!');
			});
		},
		
		fitAsync: function (opts, callback) {
			var batchEndV = opts.batchEndV;
			var timeV = opts.timeV;
			
			var data = preprocessFit(opts, function (e, data) {
				if (e != null) {
					callback(e1);
					return;
				}
				
				log.info('Creating model asynchronously ...');
    			mc.fitAsync({
    				observations: data.obsColMat,
    				controls: data.contrColMat,
    				times: timeV,
    				batchV: batchEndV
    			}, callback);
			});
		},

		/**
		 * Adds a new record. Doesn't update the models statistics.
		 */
		update: function (rec) {
			if (rec == null) return;

			var obsFtrVec = obsFtrSpace.extractVector(rec);
			var contFtrVec = controlFtrSpace.extractVector(rec);
			var timestamp = rec.time.getTime();

			mc.update(obsFtrVec, contFtrVec, timestamp);
		},
		
		project: function (rec) {
			var result = {};
			
			var obsNames = getFtrNames(obsFtrSpace);
			var contrNames = getFtrNames(controlFtrSpace);
			
			for (var i = 0; i < obsNames.length; i++) {
				result[obsNames[i]] = rec[obsNames[i]];
			}
			for (var i = 0; i < contrNames.length; i++) {
				result[contrNames[i]] = rec[contrNames[i]];
			}
			
			return result;
		},

		/**
		 * Saves the feature space and model into the specified files.
		 */
		save: function (fname) {
			try {
				console.log('Saving Markov chain ...');

				var fout = new qm.fs.FOut(fname);

    			mc.save(fout);
    			obsFtrSpace.save(fout);
    			controlFtrSpace.save(fout);

    			fout.flush();
    			fout.close();

    			console.log('Done!');
			} catch (e) {
				console.log('Failed to save the model!!' + e.message);
			}
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
			return { observations: obsFtrSpace, controls: controlFtrSpace };
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

		getFtrDesc: function (ftrId) {
			var nObsFtrs = getObsFtrCount();

			if (ftrId == null) {
				var n = nObsFtrs + getContrFtrCount();

				var obsFtrs = [];
    			var contrFtrs = [];

				for (var i = 0; i < n; i++) {
					var ftrDesc = that.getFtrDesc(i);

					if (i < nObsFtrs) {
						obsFtrs.push(ftrDesc);
					} else {
						contrFtrs.push(ftrDesc);
					}
				}

				return {
    				observation: obsFtrs,
	        		control: contrFtrs
	        	}
	    	}
			else {
				if (ftrId < nObsFtrs) {
					var ftrNames = getObsFtrNames();
					return {
						name: ftrNames[ftrId],
						bounds: getFtrBounds(ftrId)
					}
				} else {
					var ftrNames = getControlFtrNames();
					return {
						name: ftrNames[ftrId - nObsFtrs],
						bounds: getFtrBounds(ftrId)
					}
				}
			}
	    },

		/**
		 * Returns state details as a Javascript object.
		 */
		stateDetails: function (stateId, height) {
			var futureStates = mc.futureStates(height, stateId);
			var pastStates = mc.pastStates(height, stateId);
			var isTarget = mc.isTarget(stateId);
			var isLeaf = mc.isLeaf(stateId);
			var stateNm = mc.getStateName(stateId);
			var wgts = mc.getStateWgtV(stateId);
			var classifyTree = mc.getClassifyTree(stateId);

			if (log.trace())
				log.trace('Tree: %s', JSON.stringify(classifyTree));
			
			(function annotateDecisionTree(node) {
    			var features = node.features;
    			var children = node.children;
    			var cutFtr = node.cut;
    			
    			var names = getObsFtrNames();
    			
    			for (var i = 0; i < features.length; i++) {
    				var val = features[i];
    				features[i] = {
    					name: names[i],
    					value: invertFeature(i, val)
    				}
    			}
    			
    			if (cutFtr != null) {
    				node.cut = {
    					name: names[cutFtr.id],
    					value: invertFeature(cutFtr.id, cutFtr.value)
    				}
    				
    				var alt = cutFtr.alternatives;
    				
    				if (alt != null) {
    					for (var i = 0; i < alt.length; i++) {
    						alt[i].name = names[alt[i].id];
    						delete alt[i].id;
    					}
    					node.cut.alternatives = alt;
    				}
    			}
    			
    			for (var i = 0; i < children.length; i++) {
    				annotateDecisionTree(children[i]);
    			}
    		})(classifyTree);
			
			var features = getFtrDescriptions(stateId);

			return {
				id: stateId,
				name: stateNm.length > 0 ? stateNm : null,
				isTarget: isTarget,
				isLeaf: isLeaf,
				features: features,
				futureStates: futureStates,
				pastStates: pastStates,
				featureWeights: wgts,
				classifyTree: classifyTree
			};
		},
		
		explainState: function (stateId) {
			var unionV = mc.explainState(stateId);
			var names = getObsFtrNames();
			
			for (var unionN = 0; unionN < unionV.length; unionN++) {
				var intersect = unionV[unionN].terms;
				for (var termN = 0; termN < intersect.length; termN++) {
					var term = intersect[termN];
					var ftrN = term.ftrId;
					
					term.feature = names[ftrN];
					if (term.le != Number.MAX_VALUE)
						term.le = invertFeature(ftrN, term.le);
					else
						delete term.le;
					if (term.gt != -Number.MAX_VALUE)
						term.gt = invertFeature(ftrN, term.gt);
					else
						delete term.gt;
					
					delete term.ftrId;
				}
			}
			
			return unionV;
		},

		/**
		 * Returns a histogram for the desired feature in the desired state.
		 */
		histogram: function (stateId, ftrId) {
			var hist = mc.histogram(stateId, ftrId);
			return toServerHistogram(hist, ftrId);
		},

		transitionHistogram: function (sourceId, targetId, ftrId) {
			var hist = mc.transitionHistogram(sourceId, targetId, ftrId);
			return toServerHistogram(hist, ftrId);
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
				var invFtrV = obsFtrSpace.invertFeatureVector(ftrV);

				var features = [];
				for (var i = 0; i < invFtrV.length; i++) {
					features.push({name: obsFtrSpace.getFeature(i), value: invFtrV.at(i)});
				}

				callback(features);
			});
		},

		onPrediction: function (callback) {
			mc.onPrediction(callback);
		},

		/**
		 * Returns the distribution of features accross the states on the
		 * specified height.
		 */
		getFtrDist: function (height, ftrIdx) {
			var stateIds = mc.stateIds(height);

			var result = [];
			for (var i = 0; i < stateIds.length; i++) {
				var stateId = stateIds[i];
				var coord = getFtrCoord(stateId, ftrIdx);
				result.push({ state: stateId, value: coord });
			}

			return result;
		},

		setControlVal: function (opts) {
			if (opts.ftrId == null) throw new Error('Missing parameter ftrId!');
			var controlFtrId = opts.ftrId - getObsFtrCount();

			var params = {
				ftrId: opts.ftrId,
				val: controlFtrSpace.extractFeature(controlFtrId, opts.val)
			};

			if (opts.stateId != null) params.stateId = opts.stateId;

			mc.setControlVal(params);
		},

		resetControlVal: function (opts) {
			var params = {};
			if (opts.stateId != null) params.stateId = opts.stateId;
			if (opts.ftrId != null) params.ftrId = opts.ftrId;

			mc.resetControlVal(params);
		}
	};

	return that;
};