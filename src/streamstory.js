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
	
	var N_FTR_SPACES = 3;
	var ftrSpaces = [];
	var allFtrNames;
	
	var id;
	var active = false;
	var online = false;

	if (opts.base != null && opts.config != null) {
		mc = new analytics._StreamStory(opts.config);
		if (opts.obsFields != null && opts.contrFields != null && opts.ignoredFields != null) {
    		ftrSpaces = [
    		    new qm.FeatureSpace(opts.base, opts.obsFields),
    		    new qm.FeatureSpace(opts.base, opts.contrFields),
    		    new qm.FeatureSpace(opts.base, opts.ignoredFields)
    		];
		}
		else if (opts.obsFtrSpace != null && opts.controlFtrSpace != null && opts.ignoredFtrSpace != null) {
			ftrSpaces = [
			    opts.obsFtrSpace,
			    opts.controlFtrSpace,
			    opts.ignoredFtrSpace
			];
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
		for (var i = 0; i < N_FTR_SPACES; i++) {
			ftrSpaces.push(new qm.FeatureSpace(base, fin));
		}
		log.info('Loaded!');
	}
	else {
		throw new Error('Missing parameters (base and config) or fname!');
	}

	//===================================================
	// FEATURE HELPER FUNCTIONS
	//===================================================

	function getObsFtrSpace() {
		return ftrSpaces[0];
	}
	
	function getContrFtrSpace() {
		return ftrSpaces[1];
	}
	
	function getIgnoredFtrSpace() {
		return ftrSpaces[2];
	}
	
	function getFtrNames(ftrSpace) {
		var names = [];
		
		var dims = ftrSpace.dims;
		for (var i = 0; i < dims.length; i++) {
			var ftrDesc = ftrSpace.getFeature(i);
			var match = ftrDesc.match(/\[[\W\w]*\]$/);	// remove Numeric[ ]

			if (match != null) {
				match = match[0];
				names.push(match.substring(1, match.length-1));
			} else
				names.push(ftrDesc);
		}

		return names;
	}

	function getFtrCount(ftrSpace) {
		return ftrSpace.dims.length
	}

	function getObsFtrCount() {
		return getFtrCount(getObsFtrSpace());
	}

	function getContrFtrCount() {
		return getFtrCount(getContrFtrSpace());
	}
	
	function getIgnoredFtrCount() {
		return getFtrCount(getIgnoredFtrSpace());
	}
	
	function getAllFtrCount() {
		return getObsFtrCount() + getContrFtrCount() + getIgnoredFtrCount();
	}

	function getObsFtrNames() {
		return getFtrNames(getObsFtrSpace());
	}

	function getControlFtrNames() {
		return getFtrNames(getContrFtrSpace());
	}
	
	function getIgnoredFtrNames() {
		return getFtrNames(getIgno)
	}
	
	function getFtrName(ftrId) {
		return allFtrNames[ftrId];
	}

	function getFtrDescriptions(stateId) {
		var result = [];
		
		var currFtrN = 0;
		for (var ftrSpaceN = 0; ftrSpaceN < ftrSpaces.length; ftrSpaceN++) {
			result.push([]);
			
			var ftrSpace = ftrSpaces[ftrSpaceN];
			var coords = mc.fullCoords(stateId, ftrSpaceN);
			var names = getFtrNames(ftrSpace);
			var invCoords = ftrSpace.invertFeatureVector(coords);
			
			for (var ftrN = 0; ftrN < invCoords.length; ftrN++) {
				result[ftrSpaceN].push({
					name: names[ftrN],
					value: invCoords[ftrN],
					ftrSpaceN: ftrSpaceN,
					bounds: getFtrBounds(currFtrN)
				});
				
				currFtrN++;
			}
		}

		return {
			observations: result[0],
			controls: result[1],
			ignored: result[2],
			isBottom: mc.isLeaf(stateId)
		};
	}
	
	function getFtrSpaceNFtrOffset(ftrId) {
		var obsFtrCount = getObsFtrCount();
		var contrFtrCount = getContrFtrCount();
		
		var ftrSpaceN;
		var ftrOffset;
		if (ftrId < obsFtrCount) {
			ftrSpaceN = 0;
			ftrOffset = 0;
		} else if (ftrId < obsFtrCount + contrFtrCount) {
			ftrSpaceN = 1;
			ftrOffset = obsFtrCount;
		} else {
			ftrSpaceN = 2;
			ftrOffset = obsFtrCount + contrFtrCount;
		}
		
		return { ftrSpaceN: ftrSpaceN, ftrOffset: ftrOffset };
	}

	function getFtrCoord(stateId, ftrId) {
		var ftrConfig = getFtrSpaceNFtrOffset(ftrId);
		
		var coords = mc.fullCoords(stateId, ftrConfig.ftrSpaceN);
		return ftrSpaces[ftrConfig.ftrSpaceN].invertFeatureVector(coords)[ftrId - ftrConfig.ftrOffset];
	}
	
	function invertFeature(ftrId, val) {
		var ftrConfig = getFtrSpaceNFtrOffset(ftrId);
		return ftrSpaces[ftrConfig.ftrSpaceN].invertFeature(ftrId - ftrConfig.ftrOffset, val);
	}

	function getFtrBounds(ftrId) {
		var ftrConfig = getFtrSpaceNFtrOffset(ftrId);
		var bounds = mc.getFtrBounds(ftrId);

		return {
			min: ftrSpaces[ftrConfig.ftrSpaceN].invertFeature(ftrId - ftrConfig.ftrOffset, bounds.min),
			max: ftrSpaces[ftrConfig.ftrSpaceN].invertFeature(ftrId - ftrConfig.ftrOffset, bounds.max)
		}
	}

	//===================================================
	// HISTOGRAM
	//===================================================


	function toServerHistogram(hist, ftrId) {
		var ftrConfig = getFtrSpaceNFtrOffset(ftrId);
		var ftrSpace = ftrSpaces[ftrConfig.ftrSpaceN];
		var offset = ftrConfig.ftrOffset;
		
		for (var i = 0; i < hist.binStartV.length; i++) {
			hist.binStartV[i] = ftrSpace.invertFeature(ftrId - offset, hist.binStartV[i]);
		}

		return hist;
	}
	
	//===================================================
	// PREPROCESSING
	//===================================================
	
	function preprocessFit(opts, callback) {
		if (opts.recSet == null && opts.recV == null) 
			throw new Error('StreamStory.fit: missing parameters recSet or recV');
		
		if (opts.recV != null) {
			var recV = opts.recV;
			
			var parallelUpdates = [];
			var parallelExtracts = [];
			for (var i = 0; i < ftrSpaces.length; i++) {
				(function () {
					var ftrSpaceN = i;
					var ftrSpace = ftrSpaces[i];
					
					parallelUpdates.push(function (callback) {
						if (log.debug())
							log.debug('Updating feature space %d ...', ftrSpaceN);
						ftrSpace.updateRecordsAsync(recV, callback);
					});
					parallelExtracts.push(function (callback) {
						if (log.debug())
				    		log.debug('Extracting feature matrix %d ...', ftrSpaceN);
						ftrSpace.extractMatrixAsync(recV, callback);
					});
				})();
			}
			
			async.parallel(parallelUpdates, function (e) {
				if (e != null) {
					callback(e);
					return;
				}
				
				try {
					log.debug('Feature spaces updated!');
					async.parallel(parallelExtracts, function (e, results) {
						if (e != null) {
							log.error(e, 'Exception while creating feature matrices!');
							callback(e);
							return;
						}
						
						if (log.debug())
							log.debug('Feature matrices extracted!');
						
						callback(undefined, {
		    				obsColMat: results[0],
		    				contrColMat: results[1],
		    				ignoredColMat: results[2]
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
			var results = [];
			for (var i = 0; i < ftrSpaces.length; i++) {
				var ftrSpace = ftrSpaces[i];
				
				if (log.debug())
					log.debug('Updating feature space %d ...', i);
				
				ftrSpace.updateRecords(recSet);
				
				if (log.debug())
		    		log.debug('Extracting feature matrix %d ...', i);
				
				results.push(ftrSpace.extractMatrix(recSet));
			}
			
			callback(undefined, {
				obsColMat: results[0],
				contrColMat: results[1],
				ignoredColMat: results[2]
			});
		}
	}
	
	//===================================================
	// VARIABLE INITIALIZATION
	//===================================================
	
	allFtrNames = getObsFtrNames().concat(getControlFtrNames().concat(getIgnoredFtrSpace()));

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
    				ignored: data.ignoredColMat,
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
    				ignored: data.ignoredColMat,
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

			var timestamp = rec.time.getTime();
			
			var obsFtrSpace = getObsFtrSpace();
			var contrFtrSpace = getContrFtrSpace();

			mc.update(
				obsFtrSpace.extractVector(rec),
				contrFtrSpace.extractVector(rec),
				timestamp
			);
		},
		
		project: function (rec) {
			var result = {};
			
			for (var ftrSpaceN = 0; ftrSpaceN < ftrSpaces.length; ftrSpaceN++) {
				var names = getFtrNames(ftrSpaces[ftrSpaceN]);
				
				for (var ftrN = 0; ftrN < names.length; ftrN++) {
					result[names[ftrN]] = rec[names[ftrN]];
				}
			}
			
			return result;
		},

		/**
		 * Saves the feature space and model into the specified files.
		 */
		save: function (fname) {
			try {
				if (log.info())
					log.info('Saving StreamStory model to file %s ...', fname);

				var fout = new qm.fs.FOut(fname);

    			mc.save(fout);
    			for (var i = 0; i < ftrSpaces.length; i++) {
    				ftrSpaces[i].save(fout);
    			}

    			fout.flush();
    			fout.close();

    			if (log.debug())
    				log.debug('Done!');
			} catch (e) {
				log.error(e, 'Failed to save StreamStory model!');
			}
		},

		/**
		 * Returns the state used in the visualization.
		 */
		getVizState: function () {
			log.debug('Fetching visualization ...');
			var json = mc.toJSON();
						
			// transform the automatic state names
			for (var heightN = 0; heightN < json.length; heightN++) {
				var level = json[heightN];
				for (var stateN = 0; stateN < level.states.length; stateN++) {
					var state = level.states[stateN];
					var ftrId = state.autoName.ftrId;
					
					if (ftrId < 0) {
						state.autoName = state.autoName.range;
					} else {
						state.autoName = getFtrName(state.autoName.ftrId) + ' ' + state.autoName.range;
					}
				}
			}
			
			return json;
		},

		/**
		 * Returns the hierarchical Markov chain model.
		 */
		getModel: function () {
			return mc;
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
			if (ftrId == null) {
				var allFtrCount = getAllFtrCount();
				
				var result = [];
				for (var i = 0; i < ftrSpaces.length; i++) {
					result.push([]);
				}
    			
				for (var ftrN = 0; ftrN < allFtrCount; ftrN++) {
					var ftrConfig = getFtrSpaceNFtrOffset(ftrN);
					var ftrDesc = that.getFtrDesc(ftrN);
					
					result[ftrConfig.ftrSpaceN].push(ftrDesc);
				}

				return {
    				observation: result[0],
	        		control: result[1],
	        		ignored: result[2]
	        	}
	    	}
			else {
				var ftrConfig = getFtrSpaceNFtrOffset(ftrId);
				var names = getFtrNames(ftrSpaces[ftrConfig.ftrSpaceN]);
				var name = names[ftrId - ftrConfig.ftrOffset];
				
				return {
					name: name,
					bounds: getFtrBounds(ftrId)
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
			var label = mc.getStateLabel(stateId);

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
				label: label,
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
		histogram: function (ftrId, stateId) {
			var hist = mc.histogram(ftrId, stateId);
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
				var ftrSpace = ftrSpaces[0];	// observation
				var invFtrV = ftrSpace.invertFeatureVector(ftrV);

				var features = [];
				for (var i = 0; i < invFtrV.length; i++) {
					features.push({name: ftrSpace.getFeature(i), value: invFtrV.at(i)});
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
		getFtrDist: function (height, ftrId) {
			var stateIds = mc.stateIds(height);

			var result = [];
			for (var i = 0; i < stateIds.length; i++) {
				var stateId = stateIds[i];
				var coord = getFtrCoord(stateId, ftrId);
				result.push({ state: stateId, value: coord });
			}

			return result;
		},

		setControlVal: function (opts) {
			if (opts.ftrId == null) throw new Error('Missing parameter ftrId!');
			var controlFtrId = opts.ftrId - getObsFtrCount();

			var params = {
				ftrId: opts.ftrId,
				val: ftrSpaces[1].extractFeature(controlFtrId, opts.val)
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