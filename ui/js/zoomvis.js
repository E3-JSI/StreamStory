var zoomVis = function (opts) {
	
	var MODE_NORMAL = 'normal';
	var MODE_PROBS = 'probs';
	var MODE_TARGET_FTR = 'ftr';
	
	// colors
	var EDGE_COLOR = 'darkgray';
	var DEFAULT_NODE_COLOR = 'rgb(120,120,120)';//'DodgerBlue';
	var VIZ_NODE_COLOR = 360;
	var VIZ_NODE_FTR_NEG_COLOR = 360;
	var VIZ_NODE_FTR_POS_COLOR = 117;
	var CURRENT_NODE_COLOR = 'green';
	var DEFAULT_BORDER_COLOR = 'black';
	var FONT_SIZE = 10;
	
	var DEFAULT_BORDER_WIDTH = 5;
	
	var BACKGROUND_Z_INDEX = 0;
	var MIDDLEGROUND_Z_INDEX = 10;
	var FOREGROUND_Z_INDEX = 20;
	
	// size
	var MIN_NODE_DIAMETER = 40;
	
	var TARGET_NODE_CSS = {
		'background-image-opacity': .2,
		'background-fit': 'cover',
		'border-style': 'double'
	}
	
	var visContainer = document.getElementById(opts.visContainer);
	var currentHeightContainer = document.getElementById(opts.currentHeightContainer);
	
	var hierarchy = null;
	var modeConfig = {
		selected: null,
		current: null,
		future: {},
		past: {},
		mode: { type: MODE_NORMAL, config: {} },
	};
	
	var drawEdgeVals = false;
	
	var uiConfig = {
		maxNodeSize: 0,
		levelMaxNodeSize: []
	}
	
	var callbacks = {
		stateSelected: function (stateId) {},
		edgeSelected: function (sourceId, targetId) {},
		zoomChanged: function (zoom) {}
	}
	
	var maxNodeSize = 0;
	
	var minCyZoom = .3;
	var maxCyZoom = 1.3;
	
	var ZOOM_STEPS = 100;
	var heightStep;// = 0.01;
	var zoomFactor;
	
	var minHeight = 0;
	var maxHeight = 0;
	var currentHeight = 0;
	var currentLevel = 0;
		
	var levelNodes = [];
	var levelJumps = [];
	var levelHeights = [];
	var levelCurrentStates = [];
	var levelNodeMap = {};
	
	var visWidth = visContainer.clientWidth;
	var visHeight = visContainer.clientHeight;
	var minX = 0;
	var maxX = 0;
	var minY = 0;
	var maxY = 0;
	var xOffset = .1;
	var yOffset = .1;
	
	var transitionThreshold = 1;
	
	//===============================================================
	// UTILITY FUNCTIONS
	//===============================================================
	
	function getNodeLabel(node) {
		return (node.name != null ? node.name : (node.id + '')) + '\ntime: ' + node.holdingTime.toPrecision(2);
	}

	function colorFromProb(prob) {
		return Math.sqrt(prob);
	}
	
	function minAndMaxCoords() {
		for (var i = 0; i < levelNodes.length; i++) {
			for (var j = 0; j < levelNodes[i].length; j++) {
				if (levelNodes[i][j].x < minX) {
					minX = levelNodes[i][j].x;
				} else if (levelNodes[i][j].x > maxX) {
					maxX = levelNodes[i][j].x;
				}
				if (levelNodes[i][j].y < minY) {
					minY = levelNodes[i][j].y;
				} else if (levelNodes[i][j].y > maxY) {
					maxY = levelNodes[i][j].y;
				}
			}
		}
	}
	
	function cyPosition(node) {
		return {
		    x: visWidth * (xOffset + (1 - xOffset) * (minX + node.x) / (maxX - minX)),
		    y: visHeight * (yOffset + (1 - yOffset) * (minY + node.y) / (maxY - minY))
		};
	}
	
	function cySize(radius) {
		var scaleX = (1 - 2*xOffset)*visWidth / (maxX - minX);
		var scaleY = (1 - 2*yOffset)*visHeight / (maxY - minY);
		var scale = Math.min(scaleX, scaleY);
		
		var diameter = 2*radius;
		
		return {
			width: Math.max(scale * diameter, MIN_NODE_DIAMETER),
			height: Math.max(scale * diameter, MIN_NODE_DIAMETER)
		};
	}
	
	function serverPosition(pos) {
		return {
			x: (pos.x/visWidth - xOffset)*(maxX - minX) / (1 - yOffset) - minX,
			y: (pos.y/visHeight - yOffset)*(maxY - minY) / (1 - yOffset) - minY
		}
	}
	
	function calcCyPan(newZoom) {
		if (newZoom < minCyZoom) newZoom = minCyZoom;
		if (newZoom > maxCyZoom) newZoom = maxCyZoom;
		
		var width = cy.width();
		var height = cy.height();
		var pan = cy.pan();
		var zoom = cy.zoom();
		
		var centerX = (width - 2*pan.x) / zoom;
		var centerY = (height - 2*pan.y) / zoom;
		
		return {
			x: (width - newZoom*centerX) / 2,
			y: (height - newZoom*centerY) / 2
		}
	}
	
	function setZoom(newZoom, fireEvent) {
		if (fireEvent == null) fireEvent = true;
		
		cy.viewport({zoom: newZoom, pan: calcCyPan(newZoom)});
		if (fireEvent) {
			callbacks.zoomChanged(newZoom);
		}
	}
	
	//===============================================================
	// CLEAR FUNCTIONS
	//===============================================================
	
	function clear(isInBatch) {
		if (!isInBatch)
			cy.startBatch();

		cy.remove(cy.nodes());
		cy.remove(cy.edges());
		cache.clear();
		
		if (!isInBatch)
			cy.endBatch();
	}
	
	function clearStructures() {
		uiConfig.maxNodeSize = 0;
		uiConfig.levelMaxNodeSize = [];
		
		levelHeights = [];
		levelJumps = [];
		levelCurrentStates = [];
		levelNodes = [];
		levelNodeMap = {};
	}
	
	//===============================================================
	// DRAW FUNCTIONS
	//===============================================================
	
	var ElementCache = function () {
		var nodeCache = {};
		var edgeCache = {};
		
		var prevLevelNodeCache = {};
		var currLevelNodeCache = {};
		var addedNodes = [];
		
		var prevLevelEdgeCache = {};
		var currLevelEdgeCache = {};
		var addedEdges = [];
		
		var that = {
			addNode: function (id, level, nodeConfig) {
				nodeCache[id] = nodeConfig;
			},
			getNode: function (id) {
				return nodeCache[id];
			},
			addEdge: function (level, edge) {
				var id = edge.data.id;
				edgeCache[id] = edge;
			},
			getEdge: function (id) {
				return edgeCache[id];
			},
			startNewNodeLevel: function () {
				addedNodes = [];
				prevLevelNodeCache = currLevelNodeCache;
				currLevelNodeCache = {};
			},
			startNewEdgeLevel: function () {
				addedEdges = [];
				prevLevelEdgeCache = currLevelEdgeCache;
				currLevelEdgeCache = {};
			},
			updateLevelNode: function (id) {
				if (!(id in currLevelNodeCache)) {
					currLevelNodeCache[id] = true;
					
					if (!(id in prevLevelNodeCache))
						addedNodes.push(nodeCache[id]);
					else
						delete prevLevelNodeCache[id];
				}
			},
			updateLevelEdge: function (id) {
				if (!(id in currLevelEdgeCache)) {
					currLevelEdgeCache[id] = true;
					
					if (!(id in prevLevelEdgeCache))
						addedEdges.push(edgeCache[id]);
					else
						delete prevLevelEdgeCache[id];
				}
			},
			getModifiedNodes: function () {
				var removed = [];
				
				for (var id in prevLevelNodeCache) {
					removed.push(id);
				}
				
				return {
					added: addedNodes,
					removed: removed
				}
			},
			getModifiedEdges: function () {
				var removed = [];
				
				for (var id in prevLevelEdgeCache) {
					removed.push(id);
				}
				
				return {
					added: addedEdges,
					removed: removed
				}
			},
			clear: function () {
				nodeCache = {};
				edgeCache = {};
				
				prevLevelNodeCache = {};
				currLevelNodeCache = {};
				addedNodes = [];
				
				prevLevelEdgeCache = {};
				currLevelEdgeCache = {};
				addedEdges = [];
			}
		};
		
		return that;
	}
	
	var cache = ElementCache();
	
	function getEdgeConfig(sourceN, targetN, transitions, nodeInfo, maxVal) {
		var sourceId = nodeInfo[sourceN].id;
		var targetId = nodeInfo[targetN].id;
		
		var id = sourceId + '-' + targetId;
		var val = transitions[targetN];
		
		var edgeConfig = cache.getEdge(id);
		
		if (edgeConfig == null) {
			var lineStyle = 'solid';
			var color = '#505050';	// dark gray
			if (val != maxVal) {
				if (val < .2)  {
					lineStyle = 'dotted';
					color = '#C0C0C0';	// light gray
				}
				else if (val < .4) {
					color = '#C0C0C0';//'#A8A8A8';	// medium gray
				}
			}
			
			var css = {
				'text-transform': 'none',
				'text-halign': 'center',
				'text-valign': 'center',
				'font-style': 'normal',
				'font-size': FONT_SIZE,
				'font-family': 'inherit',
				'font-weight': 'normal',
				'target-arrow-shape': 'triangle',
				'source-arrow-shape': 'none',
				'display': 'element',
				'haystack-radius': 0,
				'curve-style': 'bezier',
				'control-point-step-size': 100,
				'text-valign': 'top',
				'control-point-weight': 0.5,
				'line-style': lineStyle,
				'line-color': color,
				'target-arrow-color': color,
				'width': Math.max(1, (val*10).toFixed()),
				'z-index': 100,
				'content': ''
			};
			
			var data = {
				id: id,
				source: sourceId,
				target: targetId,
				style: css,
				prob: val.toFixed(2)
			};
			
			edgeConfig = {
				group: 'edges',
				data: data,
				css: css
			};
		}
		return edgeConfig;
	}
	
	function getEdgesAboveThreshold(transitions) {
		var edges = [];
		var probs = [];
		for (var k = 0; k < transitions.length; k++) {
			probs.push({prob: transitions[k], idx: k});
		}
		
		probs.sort(function (a, b) {
			return b.prob - a.prob;
		})
		
		var sum = 0;
		var k = 0;
		while (k < probs.length && probs[k].prob > 0 && sum <= transitionThreshold) {
			edges.push(probs[k].idx);
			sum += probs[k].prob;
			k++;
		}
		
		return {
			maxProb: probs[0].prob,
			edges: edges
		}
	}
	
	function getEdgesWithSource(sourceN, transitions, nodeInfo) {
		var result = [];
		
		var aboveThreshold = getEdgesAboveThreshold(transitions);
		var maxVal = aboveThreshold.maxProb;
		var edges = aboveThreshold.edges;
		
		for (var i = 0; i < edges.length; i++) {
			var targetN = edges[i];
			
			var sourceId = nodeInfo[sourceN].id;
			var targetId = nodeInfo[targetN].id;
			
			var id = sourceId + '-' + targetId
			
			result.push(getEdgeConfig(sourceN, targetN, transitions, nodeInfo, maxVal));
		}
		
		return result;
	}
	
	function getEdgesWithTarget(targetN, transitionMat, nodeInfo) {
		var result = [];
		
		for (var sourceN = 0; sourceN < transitionMat.length; sourceN++) {
			if (sourceN == targetN) continue;
			
			var aboveThreshold = getEdgesAboveThreshold(transitionMat[sourceN]);
			var maxVal = aboveThreshold.maxProb;
			var edges = aboveThreshold.edges;
			
			if (edges.indexOf(targetN) >= 0) {
				result.push(getEdgeConfig(sourceN, targetN, transitionMat[sourceN], nodeInfo, maxVal));
			}
		}
		
		return result;
	}
	
	function insertLevel(level) {
		var levelInfo = levelNodes[level];
		
		cache.startNewNodeLevel();
		
		var nodeIdxs = {};
		
		// add/remove nodes
		for (var i = 0; i < levelInfo.length; i++) {
			var node = levelInfo[i];
			var id = node.id;
			
			nodeIdxs[id] = i;
			
			var cached = cache.getNode(id);
			
			if (cache.getNode(id) == null) {
				var position = cyPosition(node);		//[x, y]
				var nodeSize = cySize(levelInfo[i].radius);
				var label = getNodeLabel(node);
				
				var style = {
					'content': label,
					'text-transform': 'none',
					'text-halign': 'center',
					'text-valign': 'center',
					'font-style': 'normal',
					'font-size': FONT_SIZE,
					'font-family': 'inherit',
					'font-weight': 'normal',
					'shape': 'ellipse',
					'display': 'element',
					'background-color': DEFAULT_NODE_COLOR,
					'width': nodeSize.width,
					'height': nodeSize.height,
					'border-width': DEFAULT_BORDER_WIDTH,
					'border-color': DEFAULT_BORDER_COLOR,
					'label': node.name != null ? node.name : node.id,
					'z-index': BACKGROUND_Z_INDEX					
				}
				
				if (node.isTarget) {
					for (var cssClass in TARGET_NODE_CSS) {
						style[cssClass] = TARGET_NODE_CSS[cssClass];
					}
				}
				
				var nodeConfig = {
					group: 'nodes',
					data: {
						id: '' + node.id,
						style: style
					},
					position: {
						x: position.x,
						y: position.y
					},
					css: style,
					selected: false,
					selectable: true,
					locked: false
				}
				
				cache.addNode(id, level, nodeConfig);
			}
			
			cache.updateLevelNode(id);
		}
		
		var nodesArr = cache.getModifiedNodes();
		var added = nodesArr.added;
		var removed = nodesArr.removed;
		
		var addedEdges = [];
		var removedNodeSelector = '';
		var removedEdgeSelector = '';
		
		// add/remove edges
		var takenEdgeIds = {};
		for (var i = 0; i < added.length; i++) {
			var node = added[i].data;
			var nodeN = nodeIdxs[node.id];
			
			addedEdges = addedEdges.concat(getEdgesWithSource(nodeN, levelJumps[level][nodeN], levelInfo));
			
			for (var j = 0; j < addedEdges.length; j++) {
				takenEdgeIds[addedEdges[i].data.id] = true;
			}
		}
		
		for (var i = 0; i < added.length; i++) {
			var node = added[i].data;
			var nodeN = nodeIdxs[node.id];
			
			var edges = addedEdges.concat(getEdgesWithTarget(nodeN, levelJumps[level], levelInfo));
			
			for (var j = 0; j < edges.length; j++) {
				if (edges[j].data.id in takenEdgeIds) continue;
				addedEdges.push(edges[j]);
			}
		}
		
		for (var sourceN = 0; sourceN < removed.length; sourceN++) {
			var sourceId = removed[sourceN];
			var sourceIdx = nodeIdxs[sourceId];
			
			for (var targetN = 0; targetN < levelInfo.length; targetN++) {
				var targetId = levelInfo[targetN].id;
				
				removedEdgeSelector += '#' + sourceId + '-' + targetId + ',#' + targetId + '-' + sourceId;
				
				if (sourceN < removed.length-1 || targetN < levelInfo.length-1)
					removedEdgeSelector += ',';
			}
		}
		
		for (var i = 0; i < removed.length; i++) {
			removedNodeSelector += '#' + removed[i];
			if (i < removed.length-1)
				removedNodeSelector += ',';
		}
		
		// draw
		if (removedEdgeSelector.length > 0) cy.remove(cy.edges(removedEdgeSelector));
		if (removedNodeSelector.length > 0) cy.remove(cy.nodes(removedNodeSelector));
		if (added.length > 0) cy.add(added);
		if (addedEdges.length > 0) cy.add(addedEdges);
	}
	
	function emphasizeEdges(node) {
		cy.batch(function () {
			var edges = cy.edges();
			var nedges = edges.length;
			for (var i = 0; i < nedges; i++) {
				var edge = edges[i];
				edge.css(edge.data().style);
			}
			
			node.neighborhood("edge[source =" + node.id() + "]").css({
				'line-color': 'green',
				'target-arrow-color': 'green',
			});
		});
	}
	
	function redraw(opts) {
		if (!opts.isInBatch)
			cy.startBatch();
		
		if (!opts.keepCached)
			clear(true);
		insertLevel(currentLevel, true);
		
		if (opts.isInit) {
			cy.center();
		}
		
		if (!opts.isInBatch)
			cy.endBatch();
	}
	
	function constructLevels(data, isInit) {
		clearStructures();
		
		for (var i = 0; i < data.length; i++) {
			var states = data[i].states;
			
			levelHeights.push(data[i].height);
			levelJumps.push(data[i].transitions);
			levelCurrentStates.push({currentState: data[i].currentState, futureStates: data[i].futureStates});
			levelNodes.push(states);
			levelNodeMap[i] = {};
			
			uiConfig.levelMaxNodeSize.push(0);
			
			for (var j = 0; j < states.length; j++) {
				var node = states[j];
				
				levelNodeMap[i][node.id] = node;
				
				var size = node.raduis;
				if (size > uiConfig.maxNodeSize)
					uiConfig.maxNodeSize = states[j].raduis;
				if (size > uiConfig.levelMaxNodeSize[i])
					uiConfig.levelMaxNodeSize[i] = size;
			}
		}
		
//		console.log(JSON.stringify(levelCurrentStates));
		
		if (isInit) {
			maxHeight = levelHeights[levelHeights.length - 1];
			minHeight = levelHeights[0];
			
			heightStep = (maxHeight - minHeight) / ZOOM_STEPS;
			setZoom(minCyZoom);
			
			currentHeight = maxHeight;
			currentLevel = levelHeights.length - 1;
		
			minAndMaxCoords();
		}
		
		redraw({ isInit: isInit });
	}
	
	function setCurrentLevel(levelIdx) {
		if (modeConfig.mode.type == MODE_TARGET_FTR) {
			fetchTargetFtr(modeConfig.mode.config.targetFtr);
		}
		
		redraw({ isInit: false, keepCached: true });
		fetchCurrentState(hierarchy[levelIdx].height);
	}
	
	function drawNode(nodeId, batchPresent) {
		if (nodeId == null) return;
		
		if (!batchPresent)
			cy.startBatch();
		
		var node = cy.nodes('#' + nodeId);
		
		if (nodeId == modeConfig.selected) {
			node.css('border-width', '10');
			node.css('z-index', FOREGROUND_Z_INDEX);
		}
		if (nodeId == modeConfig.current) {
			node.css('backgroundColor', CURRENT_NODE_COLOR);
		}
		if (nodeId in modeConfig.past) {
			node.css('border-color', 'red');
		}
		
		if (modeConfig.mode.type == MODE_PROBS) {
			var config = modeConfig.mode.config;
			var probs = config.probs;
			var color = 'hsla(' + VIZ_NODE_COLOR + ',' + Math.floor(100*colorFromProb(probs[nodeId])) + '%, 55%, 1)';
			node.css('backgroundColor', color);
		} 
		else if (modeConfig.mode.type == MODE_TARGET_FTR) {
			var config = modeConfig.mode.config;
			var ftrVal = config.ftrVals[nodeId];
			
			var ftrRange = config.maxVal - config.minVal;
			var middleVal = config.minVal + ftrRange/2;
			
			var color;
			if (ftrVal >= middleVal) {
				var val = 2*(ftrVal - middleVal) / ftrRange;
				color = 'hsla(' + VIZ_NODE_FTR_POS_COLOR + ',' + Math.floor(100*colorFromProb(val)) + '%, 55%, 1)';
			} else {
				var val = 2*(middleVal - ftrVal) / ftrRange;
				color = 'hsla(' + VIZ_NODE_FTR_NEG_COLOR + ',' + Math.floor(100*colorFromProb(val)) + '%, 55%, 1)';
			}
						
			node.css('backgroundColor', color);
		} 
		else if (nodeId in modeConfig.future) {
			var baseColor = 216;//nodeId in specialStates.probs ? 307 : ;
			
			var prob = colorFromProb(modeConfig.future[nodeId]);
			var color = 'hsla(' + baseColor + ',' + (15 + Math.floor((100-15)*prob)) + '%, 55%, 1)';
			node.css('backgroundColor', color);
		}
		
		if (!batchPresent)
			cy.endBatch();
	}
	
	function clearStyles(inBatch) {
		if (!inBatch)
			cy.startBatch();
		
		var nodes = cy.nodes();
		
		nodes.css('border-color', DEFAULT_BORDER_COLOR);
		nodes.css('backgroundColor', DEFAULT_NODE_COLOR);
		nodes.css('border-color', DEFAULT_BORDER_COLOR);
		nodes.css('z-index', BACKGROUND_Z_INDEX);
		
		if (!inBatch)
			cy.endBatch();
	}
	
	function drawNodes() {
		cy.batch(function () {
			clearStyles(true);
			
			var levelInfo = levelNodes[currentLevel];
			for (var i = 0; i < levelInfo.length; i++) {
				drawNode(levelInfo[i].id, true);
			}
		});
	}
	
	function clearCurrentState() {
		clearStyles();
		
		modeConfig.current = null;
		modeConfig.future = {};
		modeConfig.past = {};
	}
	
	function redrawSpecial(isInBatch) {
		if (!isInBatch)
			cy.startBatch();
		
		var nodes = cy.nodes();
		for (var i = 0; i < nodes.length; i++) {
			var node = nodes[i];
			node.css(node.data().style);
		}
		drawNode(modeConfig.selected, true);
		drawNode(modeConfig.current, true);
		for (var nodeId in modeConfig.future)
			drawNode(nodeId, true);
		for (var nodeId in modeConfig.past)
			drawNode(nodeId, true);
		if (modeConfig.mode.type == MODE_PROBS) {
			for (var nodeId in modeConfig.mode.config.probs)
				drawNode(nodeId, true);
		}
		
		if (!isInBatch)
			cy.endBatch();
	}
	
	//===============================================================
	// SET STATES
	//===============================================================
	
	function setCurrentState(stateId, height) {
		clearCurrentState();
		modeConfig.current = stateId;
		cy.nodes('#' + stateId).select();
		
		if (modeConfig.mode.type == MODE_NORMAL)
			fetchFutureStates(stateId, height);
		fetchPastStates(stateId, height);
		
		drawNodes();
	}
	
	//===============================================================
	// FETCH METHODS
	//===============================================================
	
	function fetchFutureStates(currStateId, height) {
		modeConfig.future = {};
		
		$.ajax('api/futureStates', {
			dataType: 'json',
			data: { state: currStateId, level: height },
			success: function (states) {
				for (var i = 0; i < Math.min(3, states.length); i++) {
					var stateId = states[i].id;
					
					modeConfig.future[stateId] = states[i].prob;
					drawNode(stateId);
				}
			}
		});
	}
	
	function fetchPastStates(currStateId, height) {
		modeConfig.past = {};
		
		$.ajax('api/history', {
			dataType: 'json',
			data: { state: currStateId, level: height },
			success: function (stateIds) {
				for (var i = 0; i < stateIds.length; i++) {
					var stateId = stateIds[i];
					
					modeConfig.past[stateId] = true;
					drawNode(stateId);
				}
			}
		});
	}
	
	function fetchCurrentState(height) {
		modeConfig.current = null;
		
		$.ajax('api/currentState', {
			dataType: 'json',
			data: { level: height },
			success: function (state) {
				setCurrentState(state.id, height);
			}
		});
	}
	
	function setUI(data, isInit) {
		cache.clear();
		data.sort(function (a, b) {
			return a.height - b.height;
		});
		hierarchy = data;
		constructLevels(hierarchy, isInit);
		fetchCurrentState(currentHeight);
	}
	
	function fetchUI() {
		$.ajax({
			url: 'api/model',
			success: function (data) {
				setUI(data, true);
			},	
			dataType: 'json',
			error: function (jqXHR, jqXHR, status, err) {
				alert("failed to receive object: " + status + ", " + err);
			}
		});
	}
	
	function fetchTargetFtr(ftrIdx) {
		$.ajax('api/targetFeature', {
			dataType: 'json',
			data: { height: that.getCurrentHeight(), ftr: ftrIdx },
			success: function (data) {
				var stateVals = {};
				
				var maxVal = Number.NEGATIVE_INFINITY;
				var minVal = Number.POSITIVE_INFINITY;
				
				for (var i = 0; i < data.length; i++) {
					var state = data[i].state;
					var value = data[i].value;
					
					if (value > maxVal) maxVal = value;
					if (value < minVal) minVal = value;
					
					stateVals[state] = value;
				}
				
				setMode(MODE_TARGET_FTR, { 
					targetFtr: ftrIdx,
					ftrVals: stateVals,
					maxVal: maxVal,
					minVal: minVal
				});
				
				drawNodes();
			}
		});
	}
	
	//===============================================================
	// INITIALIZE
	//===============================================================
	
	function onMouseWheel(event) {
		console.log(event.deltaY);
		if (event.preventDefault) {
			event.preventDefault();
		}
		
		if (event.deltaY > 0) {		// scroll out
			currentHeight = Math.min(maxHeight, currentHeight + heightStep);
			
			if (currentLevel < levelHeights.length - 1) {
				if (currentHeight >= levelHeights[currentLevel + 1]) {
					setCurrentLevel(++currentLevel);
				}
			}
			
		} else {					// scroll in
			currentHeight = Math.max(minHeight, currentHeight - heightStep);
			
			if (currentLevel > 0) {
				if (currentHeight < levelHeights[currentLevel]) {
					setCurrentLevel(--currentLevel);
				}
			}
		}
				
		var zoom = cy.zoom();
		var factor = 1.01;
		var newZoom = zoom * (event.deltaY > 0 ? 1 / factor : factor);
		
		setZoom(newZoom);
		currentHeightContainer.innerHTML = (100*(1 - (hierarchy[currentLevel].height - minHeight) / (maxHeight - minHeight))).toFixed();	// set height text
	}
	
	// adding mouse wheel listener
	if (visContainer.onwheel !== undefined) {
		visContainer.addEventListener('wheel', onMouseWheel)
	} else if (visContainer.onmousewheel !== undefined) {
		visContainer.addEventListener('mousewheel', onMouseWheel)
	} else {
		// unsupported browser
		alert("your browser is unsupported");
	}
	
	var cy = cytoscape({
		container: document.getElementById(opts.visContainer),
		style: [
			{
				selector: 'node',
				css: {
					'background-color': DEFAULT_NODE_COLOR,
					'text-valign': 'center',
					'min-zoomed-font-size': 3
				},
			},
			{
				selector: 'edge',
				css: {
					'target-arrow-shape': 'triangle',
					'target-arrow-color': EDGE_COLOR,
					'lineColor': EDGE_COLOR
				}
			}
		],
		
		ready: function() { console.log('ready'); },
		motionBlur: false,
		fit: false,
		userZoomingEnabled: false,
		boxSelectionEnabled: false,
		wheelSensitivity: 0.01,
		
		// moving the viewport
		panningEnabled: true,
		userPanningEnabled: true,
		hideEdgesOnViewport: false,
		textureOnViewport: true,
		
		minZoom: minCyZoom,
		maxZoom: maxCyZoom
	});
	
	cy.on('click', 'node', function (event) {
		var node = event.cyTarget;
		var stateId = parseInt(node.id());
		var height = hierarchy[currentLevel].height;
		
		// set selected state
		modeConfig.selected = stateId;
		// redraw
		cy.batch(function () {
			cy.nodes().css('shape', 'ellipse');
			cy.nodes().css('border-width', DEFAULT_BORDER_WIDTH);
			drawNode(stateId);
		});
		
		// notify the handler
		callbacks.stateSelected(stateId, height);
		emphasizeEdges(node);
	});
	
	cy.on('mouseover', 'node', function (event) {
		var node = event.cyTarget;
		
		if (parseInt(node.id()) != modeConfig.selected) {
			node.css('z-index', MIDDLEGROUND_Z_INDEX);
		}
	});
	
	cy.on('mouseout', 'node', function (event) {
		var node = event.cyTarget;
		
		if (parseInt(node.id()) != modeConfig.selected) {
			node.css('z-index', BACKGROUND_Z_INDEX);
		}		
	});
	
	cy.on('grab', 'node', function (event) {
		var cyNode = event.cyTarget;
		var id = parseInt(cyNode.id());
		var pos = cyNode.position();
		
		var level = currentLevel;
		var node = levelNodeMap[level][id];
		
		console.log('Started dragging node ' + id + ', pos' + JSON.stringify({x: node.x, y: node.y}) + ', cyPos: ' + JSON.stringify(pos));
	})
	
	// fired when a node is moved
	cy.on('free', 'node', function (event) {
		var cyNode = event.cyTarget;
		var id = parseInt(cyNode.id());
		var pos = cyNode.position();
		
		var level = currentLevel;
		var node = levelNodeMap[level][id];
		
		var serverPos = serverPosition(pos);
		node.x = serverPos.x;
		node.y = serverPos.y;
		
		console.log('Stopped dragging node ' + id + ', pos: ' + JSON.stringify(pos));
	});
	
	cy.on('click', 'edge', function (event) {
		var edge = event.cyTarget;
		var sourceId = edge.source().id();
		var targetId = edge.target().id();
		callbacks.edgeSelected(parseInt(sourceId), parseInt(targetId));
	});
	
	function setMode(mode, config) {
		modeConfig.mode.type = mode;
		modeConfig.mode.config = config;
	}
	
	//===============================================================
	// OBJECT
	//===============================================================
	
	var that = {
		refresh: fetchUI,
		
		/*
		 * Sets a new model which is visualized. Zoom and other properties are not
		 * refreshed!
		 */
		setModel: function (data) {
			setUI(data, false);
		},
		
		setCurrentStates: function (currentStates) {
			if (hierarchy == null) return;
						
			currentStates.sort(function (a, b) {
				return a.height - b.height;
			});
			
			var currState = currentStates[currentLevel].id;
			if (currState != modeConfig.current)
				setCurrentState(currState, currentStates[currentLevel].height);
		},
		
		setTransitionThreshold: function (threshold) {
			transitionThreshold = Math.max(.5, Math.min(1, threshold));
			cy.batch(function () {
				redraw({ isInBatch: true });
				redrawSpecial(true);
			});
		},
		
		setProbDist: function (dist) {
			var config = {maxProb: 0, probs: {}};
			
			for (var i = 0; i < dist.length; i++) {
				var stateId = dist[i].stateId;
				var prob = dist[i].prob;
				
				if (prob > config.maxProb) config.maxProb = prob;
				
				config.probs[stateId] = prob;
			}
			
			setMode(MODE_PROBS, config);
			redrawSpecial();
		},
		
		setTargetFtr: function (ftrIdx) {
			if (ftrIdx == null) {	// reset to normal mode
				cy.batch(function () {
					setMode(MODE_NORMAL, {});
					redraw({ isInit: false, keepCached: true, isInBatch: true });
					redrawSpecial(true);
				});
			} else {
				fetchTargetFtr(ftrIdx);
			}
		},
		
		setTargetState: function (stateId, isTarget) {
			var level = currentLevel;
			var levelInfo = levelNodes[level];
			// find the node
			for (var i = 0; i < levelInfo.length; i++) {
				var node = levelInfo[i];
				if (node.id == stateId) {
					node.isTarget = isTarget;
					break;
				}
			}
			
			var node = cy.nodes('#' + stateId);
			if (isTarget) {
				for (var cssClass in TARGET_NODE_CSS) {
					node.css(cssClass, TARGET_NODE_CSS[cssClass]);
				}
			} else {
				for (var cssClass in TARGET_NODE_CSS) {
					node.removeCss(cssClass);
				}
			}
		},
		
		setStateName: function (stateId, name) {
			var level = currentLevel;
			var levelInfo = levelNodes[level];
			
			var node;
			for (var i = 0; i < levelInfo.length; i++) {
				node = levelInfo[i];
				if (node.id == stateId) {
					node.name = name;
					break;
				}
			}
			
			if (node == null) return;
			
			var graphNode = cy.nodes('#' + stateId);
			var label = getNodeLabel(node);
			graphNode.css('label', label);
			graphNode.data('label', label);
			// TODO
		},
		
		setShowTransitionProbs: function (show) {
			drawEdgeVals = show;
			cy.batch(function () {
				var edges = cy.edges();
				for (var i = 0; i < edges.length; i++) {
					var edge = edges[i];
					var prob = edge.data().prob;
					edge.css({ content: show ? prob : '' });
				}
//				redraw({ isInBatch: true });
//				redrawSpecial(true);
			})
		},
		
		setZoom: function (value) {
			setZoom(value, false);
		},
		
		getZoom: function () {
			return cy.zoom();
		},
		
		getMinZoom: function () {
			return minCyZoom;
		},
		
		getMaxZoom: function () {
			return maxCyZoom;
		},
		
		getCurrentHeight: function () {
			return currentHeight;
		},
		
		getCurrentState: function () {
			return modeConfig.current;
		},
		
		getSelectedState: function () {
			return modeConfig.selected;
		},
		
		getPNG: function () {
			return cy.png( {full: true, scale: 1} );
		},
		
		// callbacks
		onStateSelected: function (callback) {
			callbacks.stateSelected = callback;
		},
		
		onEdgeSelected: function (callback) {
			callbacks.edgeSelected = callback;
		},
		
		onZoomChanged: function (callback) {
			callbacks.zoomChanged = callback;
		}
	}
	
	return that;
}
