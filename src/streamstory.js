var async = require('async');

var streamstory = qm.streamstory;

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
    var allFtrNames = null;

    var id;
    var active = false;
    var online = false;

    var obsFtrConf = null;	// TODO these are not saved and loaded
    var contrFtrConf = null;
    var ignFtrConf = null;
    var derivativeFtrIds = null;

    if (opts.base != null && opts.config != null) {
        mc = new streamstory._StreamStory(opts.config);
        if (opts.obsFieldV != null && opts.controlFieldV != null && opts.ignoredFieldV != null) {
            ftrSpaces = [
                new qm.FeatureSpace(opts.base, opts.obsFieldV),
                new qm.FeatureSpace(opts.base, opts.controlFieldV),
                new qm.FeatureSpace(opts.base, opts.ignoredFieldV)
            ];

            obsFtrConf = opts.obsFieldV;
            contrFtrConf = opts.controlFieldV;
            ignFtrConf = opts.ignoredFieldV;

            // construct feature IDs for the derivative features
            derivativeFtrIds = (function () {
                var result = [];

                var ftrNames = getAllFtrNames();
                var derivFieldV = opts.derivFieldV;

                var derivFtrH = {};
                for (var i = 0; i < derivFieldV.length; i++) {
                    derivFtrH[derivFieldV[i].name] = true;
                }

                for (var ftrId = 0; ftrId < ftrNames.length; ftrId++) {
                    var ftr = ftrNames[ftrId];
                    if (ftr in derivFtrH) {
                        result.push(ftrId);
                    }
                }

                return result;
            })();

        }
        else {
            throw new Error('Missing feature space configuration!');
        }
    }
    else if (opts.fname != null) {
        log.info('Loading StreamStory from:%s ', opts.fname);
        var fin = new qm.fs.FIn(opts.fname);

        mc = new streamstory._StreamStory(fin);
        log.info('Loading feature spaces ...');
        for (var i = 0; i < N_FTR_SPACES; i++) {
            ftrSpaces.push(new qm.FeatureSpace(base, fin));
        }
        log.debug('Initializing feature names ...');
        initFtrNames();
        log.info('Loaded!');
    }
    else {
        throw new Error('Missing parameters (base and config) or fname!');
    }

    //===================================================
    // FEATURE HELPER FUNCTIONS
    //===================================================

    function genFtrInfo(fields, ftrSpace) {
        var result = [];

        var dims = ftrSpace.dims;

        var offset = 0;
        for (var i = 0; i < fields.length; i++) {
            var field = fields[i];
            var dim = dims[i];

            switch (field.type) {
                case 'numeric':
                    result.push({
                        type: 'numeric',
                        offset: offset,
                        length: dim
                    })
                    break;
                case 'categorical':
                    result.push({
                        type: 'nominal',
                        offset: offset,
                        length: dim
                    })
                    break;
                case 'time':
                    throw new Error('Cannot use time features in feature info!');
                default:
                    throw new Error('Invalid field type: ' + field.type);
            }

            offset += dim;
        }

        return result;
    }

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
        for (var ftrN = 0; ftrN < dims.length; ftrN++) {
            var ftrDesc = ftrSpace.getFeatureExtractor(ftrN);
            var match = ftrDesc.match(/\[[\W\w]*\]$/);	// remove Numeric[ ], Categorical[ ], ...

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
        return getFtrNames(getIgnoredFtrSpace());
    }

    function getAllFtrNames() {
        return getObsFtrNames().concat(getControlFtrNames()).concat(getIgnoredFtrNames());
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
                var ftrConfig = getFeatureConfig(currFtrN);
                result[ftrSpaceN].push({
                    name: names[ftrN],
                    value: invCoords[ftrN],
                    ftrSpaceN: ftrSpaceN,
                    range: getFtrRange(currFtrN),
                    type: ftrConfig.type
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

    function getFeatureConfig(ftrId) {
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

        var ftrN = ftrId - ftrOffset;
        var internalOffset = 0;
        var dims = ftrSpaces[ftrSpaceN].dims;

        for (var i = 0; i < ftrN; i++) {
            internalOffset += dims[i];
        }

        return {
            ftrSpaceN: ftrSpaceN,				// index of the feature space
            ftrN: ftrId - ftrOffset,			// index of the feature inside the feature space
            dim: dims[ftrN],					// feature dimension
            internalOffset: internalOffset,		// offset of the feature inside a feature vector (includes dimensions)
            type: ftrSpaces[ftrSpaceN].getFeatureExtractorType(ftrN)				// feature type
        };
    }

    function getFtrCoord(stateId, ftrId) {
        var config = getFeatureConfig(ftrId);

        var coords = mc.fullCoords(stateId, config.ftrSpaceN);
        return ftrSpaces[config.ftrSpaceN].invertFeatureVector(coords)[config.ftrN];
    }

    function invertFeature(ftrId, val) {
        var offsets = getFeatureConfig(ftrId);
        return ftrSpaces[offsets.ftrSpaceN].invertFeature(offsets.ftrN, val);
    }

    // function extractFeature(ftrV, ftrN) {
    //     var config = getFeatureConfig(ftrN);

    //     if (config.dim == 1) {
    //         return ftrV[config.internalOffset];
    //     } else {
    //         var result = [];
    //         for (var i = 0; i < config.dim; i++) {
    //             result.push(ftrV[config.internalOffset + i]);
    //         }
    //         return result;
    //     }
    // }

    function getCategoricalBinNm(ftrId, binN) {
        var config = getFeatureConfig(ftrId);

        if (config.type != 'categorical') throw new Error('Feature ' + ftrId + ' is not categorical!');

        var ftrSpace = ftrSpaces[config.ftrSpaceN];
        var range = ftrSpace.getFeatureRange(config.ftrN);

        if (binN >= range.length) throw new Error('Invalid bin number: ' + binN);

        return range[binN];
    }

    function getCategoricalLabel(ftrId, value) {
        if (value instanceof Array) {
            var config = getFeatureConfig(ftrId);

            if (config.type != 'categorical') throw new Error('Feature ' + ftrId + ' is not categorical!');

            var ftrSpace = ftrSpaces[config.ftrSpaceN];
            var inverted = ftrSpace.invertFeature(config.ftrN, value);

            var targetKey = null;
            for (var key in inverted) {
                if (inverted[key] > 0) {
                    targetKey = key;
                    break;
                }
            }

            if (targetKey == null) throw new Error('Unable to find the label of feature ' + ftrId + ', value: ' + JSON.stringify(value));

            return targetKey;
        }
        else {
            return getCategoricalBinNm(ftrId, value);
        }
    }

    function getFtrRange(ftrId) {
        var config = getFeatureConfig(ftrId);
        return ftrSpaces[config.ftrSpaceN].getFeatureRange(config.ftrN);
    }

    function genAutoName(nameConf) {
        var ftrId = nameConf.ftrId;
        var type = nameConf.type;

        if (ftrId < 0) return null;

        switch (type) {
            case 'numeric': {
                if (nameConf.range == null) {
                    return null;
                } else {
                    return getFtrName(ftrId) + ' ' + nameConf.range;
                }
                break;
            }
            case 'categorical': {
                var bin = nameConf.value;
                return getFtrName(ftrId) + ' ' + getCategoricalBinNm(ftrId, bin);
            }
            case 'time':
                if (nameConf.from != null) {
                    return nameConf.from + ' - ' + nameConf.to;
                } else {
                    return nameConf.on;
                }
                break;
            default: {
                throw new Error('Unknown feature type: ' + type);
            }
        }
    }

    function convertAutoNames(json) {
        for (var heightN = 0; heightN < json.length; heightN++) {
            var heightJson = json[heightN];
            var states = heightJson.states;

            for (var stateN = 0; stateN < states.length; stateN++) {
                var state = states[stateN];
                state.autoName = genAutoName(state.autoName);
            }
        }
    }

    //===================================================
    // HISTOGRAM
    //===================================================


    function toServerHistogram(hist, ftrId) {
        var config = getFeatureConfig(ftrId);
        var ftrSpace = ftrSpaces[config.ftrSpaceN];

        hist.type = config.type;

        if (config.type == 'numeric') {
            for (var i = 0; i < hist.binValV.length; i++) {
                hist.binValV[i] = ftrSpace.invertFeature(config.ftrN, hist.binValV[i]);
            }

        }
        else if (config.type == 'categorical') {
            hist.binValV = ftrSpace.getFeatureRange(config.ftrN)
        }
        else if (config.type == 'time') {
            throw new Error('Time features not supported for histograms!');
        }
        else {
            throw new Error('Unknown feature type: ' + config.type);
        }

        return hist;
    }

    //===================================================
    // PREPROCESSING
    //===================================================

    function preprocessFit(opts, callback) {
        if (log.debug())
            log.debug('Preprocessing before fit ...');

        if (opts.recSet == null && opts.recV == null)
            throw new Error('StreamStory.fit: missing parameters recSet or recV');

        var i;
        if (opts.recV != null) {
            var recV = opts.recV;

            var constructParallel = function (i) {
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
            }

            var parallelUpdates = [];
            var parallelExtracts = [];
            for (i = 0; i < ftrSpaces.length; i++) {
                constructParallel(i);
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

                        initFtrNames();

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
            for (i = 0; i < ftrSpaces.length; i++) {
                var ftrSpace = ftrSpaces[i];

                if (log.debug())
                    log.debug('Updating feature space %d ...', i);

                ftrSpace.updateRecords(recSet);

                if (log.debug())
                    log.debug('Extracting feature matrix %d ...', i);

                results.push(ftrSpace.extractMatrix(recSet));
            }

            initFtrNames();

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

    function initFtrNames() {
        if (log.debug())
            log.debug('Initializing feature names ...');
        allFtrNames = getObsFtrNames().concat(getControlFtrNames().concat(getIgnoredFtrNames()));
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
            var timeV = opts.timeV;

            preprocessFit(opts, function (e, data) {
                if (e != null) {
                    throw e;
                }

                log.info('Creating model ...');
                mc.fit({
                    observations: data.obsColMat,
                    controls: data.contrColMat,
                    ignored: data.ignoredColMat,
                    times: timeV,
                    batchV: batchEndV,
                    derivativeFtrIds: derivativeFtrIds,
                    ftrInfo: {
                        observation: genFtrInfo(obsFtrConf, getObsFtrSpace()),
                        control: genFtrInfo(contrFtrConf, getContrFtrSpace()),
                        ignored: genFtrInfo(ignFtrConf, getIgnoredFtrSpace())
                    }
                });
                log.info('Done!');
            });
        },

        fitAsync: function (opts, callback) {
            var batchEndV = opts.batchEndV;
            var timeV = opts.timeV;

            preprocessFit(opts, function (e, data) {
                if (e != null) {
                    callback(e);
                    return;
                }

                try {
                    log.info('Creating model asynchronously ...');
                    mc.fitAsync({
                        observations: data.obsColMat,
                        controls: data.contrColMat,
                        ignored: data.ignoredColMat,
                        times: timeV,
                        batchV: batchEndV,
                        derivativeFtrIds: derivativeFtrIds,
                        ftrInfo: {
                            observation: genFtrInfo(obsFtrConf, getObsFtrSpace()),
                            control: genFtrInfo(contrFtrConf, getContrFtrSpace()),
                            ignored: genFtrInfo(ignFtrConf, getIgnoredFtrSpace())
                        }
                    }, callback);
                } catch (e) {
                    log.error(e, 'Failed to fit model!');
                    callback(e);
                }
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

            // TODO also include the timestamp
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
            var json = mc.toJSON();
            convertAutoNames(json);
            return json;
        },

        getStatePath: function (stateId, height, length, probThreshold) {
            var pathModel = mc.getStatePath(stateId, height, length, probThreshold);
            convertAutoNames(pathModel);
            return pathModel;
        },

        getSubModelJson: function (stateId) {
            var submodel = mc.getSubModelJson(stateId);
            convertAutoNames(submodel);
            return submodel;
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
                    var ftrConfig = getFeatureConfig(ftrN);
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
                var config = getFeatureConfig(ftrId);
                var ftrSpace = ftrSpaces[config.ftrSpaceN];

                var names = getFtrNames(ftrSpace);
                var name = names[config.ftrN];

                return {
                    name: name,
                    type: config.type,
                    values: ftrSpace.getFeatureRange(config.ftrN)
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
            var label = mc.getStateLabel(stateId);
            var autoNm = genAutoName(mc.getStateAutoName(stateId));
            var wgts = mc.getWeights(stateId);
            var classifyTree = mc.getClassifyTree(stateId);
            var centroids = mc.getStateCentroids(stateId);
            var allCentroids = mc.getStateCentroids();
            var timeHistogram = mc.timeHistogram(stateId, 'global');
            var yearHistogram = mc.timeHistogram(stateId, 'year');
            var monthHistogram = mc.timeHistogram(stateId, 'month');
            var weekHistogram = mc.timeHistogram(stateId, 'week');
            var dayHistogram = mc.timeHistogram(stateId, 'day');

            if (log.trace())
                log.trace('Tree: %s', JSON.stringify(classifyTree));

            (function annotateDecisionTree(node) {
                var children = node.children;
                var cutFtr = node.cut;

                var names = getObsFtrNames();

                if (cutFtr != null) {
                    var type = cutFtr.ftrType;

                    switch (type) {
                        case 'numeric': {
                            node.cut = {
                                name: names[cutFtr.id],
                                ftrType: cutFtr.ftrType,
                                value: invertFeature(cutFtr.id, cutFtr.value)
                            }
                            break;
                        }
                        case 'categorical': {
                            var value = getCategoricalLabel(cutFtr.id, cutFtr.value);
                            node.cut = {
                                name: names[cutFtr.id],
                                ftrType: cutFtr.ftrType,
                                value: value
                            }
                            break;
                        }
                        case 'time': {
                            throw new Error('Time features not allowed in explanation trees!');
                        }
                        default: {
                            throw new Error('Invalid feature type: ' + type);
                        }
                    }

                    (function () {
                        var alt = cutFtr.alternatives;

                        if (alt != null) {
                            for (var i = 0; i < alt.length; i++) {
                                alt[i].name = names[alt[i].id];
                                delete alt[i].id;
                            }
                            node.cut.alternatives = alt;
                        }
                    })();
                }

                (function () {
                    for (var i = 0; i < children.length; i++) {
                        annotateDecisionTree(children[i]);
                    }
                })();
            })(classifyTree);

            var obsFtrSpace = getObsFtrSpace();
            var uiCentroids = [];
            var uiAllCentroids = [];

            (function () {
                for (var centroidN = 0; centroidN < centroids.length; centroidN++) {
                    var uiCentroid = obsFtrSpace.invertFeatureVector(centroids[centroidN]);
                    uiCentroids.push(uiCentroid);
                }
            })();

            (function () {
                for (var centroidN = 0; centroidN < allCentroids.length; centroidN++) {
                    var uiCentroid = obsFtrSpace.invertFeatureVector(allCentroids[centroidN]);
                    uiAllCentroids.push(uiCentroid);
                }
            })();

            // transform the weights
            var outWeights = [];
            for (var ftrId = 0; ftrId < wgts.length; ftrId++) {
                var info = wgts[ftrId];

                switch (info.type) {
                    case 'numeric': {
                        outWeights.push(info.value);
                        break;
                    }
                    case 'categorical': {
                        var wgtObj = {};
                        var range = getFtrRange(ftrId);
                        for (var i = 0; i < range.length; i++) {
                            wgtObj[range[i]] = info.value[i];
                        }
                        outWeights.push(wgtObj);
                        break;
                    }
                    case 'time':
                        throw new Error('Cannot transform weights of time feature!');
                    default: {
                        throw new Error('Unknown feature type: ' + info.type);
                    }
                }
            }


            var features = getFtrDescriptions(stateId);

            return {
                id: stateId,
                name: stateNm.length > 0 ? stateNm : null,
                label: label,
                autoName: autoNm,
                isTarget: isTarget,
                isLeaf: isLeaf,
                features: features,
                futureStates: futureStates,
                pastStates: pastStates,
                featureWeights: outWeights,
                classifyTree: classifyTree,
                centroids: uiCentroids,
                allCentroids: uiAllCentroids,
                timeHistogram: timeHistogram,
                yearHistogram: yearHistogram,
                monthHistogram: monthHistogram,
                weekHistogram: weekHistogram,
                dayHistogram: dayHistogram
            };
        },

        getHistoricalStates: function (offset, zoom, maxStates) {
            var result = mc.getHistoricalStates(offset, zoom, maxStates);
            return result;
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

                    switch (term.ftrType) {
                        case 'numeric': {
                            if (term.le != Number.MAX_VALUE)
                                term.le = invertFeature(ftrN, term.le);
                            else
                                delete term.le;
                            if (term.gt != -Number.MAX_VALUE)
                                term.gt = invertFeature(ftrN, term.gt);
                            else
                                delete term.gt;
                            break;
                        }
                        case 'categorical': {
                            if (term.eq != null) {
                                term.eq = getCategoricalLabel(ftrN, term.eq);
                            }
                            if (term.neq != null) {
                                term.neq = getCategoricalLabel(ftrN, term.neq);
                            }
                            break;
                        }
                        case 'time':
                            throw new Error('Cannot use time features in explanation tree!');
                        default: {
                            throw new Error('Invalid feature type: ' + term.ftrType);
                        }
                    }

                    delete term.ftrId;
                }
            }

            return unionV;
        },

        narrateState: function (stateId) {
            var narration = mc.narrateState(stateId);

            for (var i = 0; i < narration.length; i++) {
                var ftrNarration = narration[i];

                switch (ftrNarration.type) {
                    case 'numeric': {
                        narration[i].ftrId = getFtrName(narration[i].ftrId);
                        break;
                    }
                    case 'categorical': {
                        var ftrId = ftrNarration.ftrId;
                        var binN = ftrNarration.bin;

                        var binName = getCategoricalBinNm(ftrId, binN);
                        narration[i].ftrId = getFtrName(ftrId);
                        narration[i].bin = binName;
                        break;
                    }
                    case 'time':
                        // do nothing
                        break;
                    default:
                        throw new Error('Unknown feature type: ' + ftrNarration.type);
                }
            }

            return narration;
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
