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
	
	var DEFAULT_BORDER_WIDTH = 5;
	
	var BACKGROUND_Z_INDEX = 0;
	var MIDDLEGROUND_Z_INDEX = 10;
	var FOREGROUND_Z_INDEX = 20;
	
	// size
	var MIN_NODE_DIAMETER = 40;
	
	var TARGET_NODE_CSS = {
		'background-image': 'img/target.png',
		'background-image-opacity': .2,
		'background-fit': 'cover'
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
	
	var uiConfig = {
		maxNodeSize: 0,
		levelMaxNodeSize: []
	}
	
	var callbacks = {
		stateSelected: function (stateId) {},
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
	
	function clear() {
		var drawnNodes = cy.nodes('');
		var drawnEdges = cy.edges('');
		
		cy.remove(drawnNodes);
		cy.remove(drawnEdges);
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
	
	function insertNodes(level) {
		var height = levelHeights[level];
		var levelInfo = levelNodes[level];
		var currentNodeInfo = levelCurrentStates[level];
		var currentState = currentNodeInfo.currentState;
		
		var nodesArray = [];
				
		for (var i = 0; i < levelInfo.length; i++) {
			var node = levelInfo[i];
			var dispNode;
			var position = cyPosition(node);		//[x, y]
			var nodeSize = cySize(levelInfo[i].radius);
						
			var style = {
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
			
			nodesArray.push({
				group: 'nodes',
				data: {
					id: '' + node.id,
					label: getNodeLabel(node)
				},
				position: {
					x: position.x,
					y: position.y
				},
				css: style,
				selected: false,
				selectable: true,
				locked: false
			});
		}
		
		cy.add(nodesArray);
	}
	
	function insertEdges(level) {
		var edgeArray = [];
		
		var edgeId = 0;
		for (var i = 0; i < levelJumps[level].length; i++) {			
			var probs = [];
			for (var k = 0; k < levelJumps[level][i].length; k++) {
				probs.push({prob: levelJumps[level][i][k], idx: k});
			}
			
			probs.sort(function (a, b) {
				return b.prob - a.prob;
			})
			
			var edges = [];
			var sum = 0;
			var k = 0;
			while (k < probs.length && probs[k].prob > 0 && sum <= transitionThreshold) {
				edges.push(probs[k].idx);
				sum += probs[k].prob;
				k++;
			}
			
			for (var j = 0; j < edges.length; j++) {
				var val = levelJumps[level][i][edges[j]];
				
				edgeArray.push({
					group: 'edges',
					data: {
						id: i + '-' + edges[j],
						source: levelNodes[level][i].id,
						target: levelNodes[level][edges[j]].id,
						value: val.toFixed(3)
					},
					css: {
						'control-point-step-size': 250,//150,
						'text-valign': 'top',
						'control-point-weight': 0.5,
						'border-style': 'solid',
						'width': Math.max(1, (val*10).toFixed()),
						'z-index': 100
					}
				});
			}
		}
		
		cy.add(edgeArray)
	}
	
	function redraw(isInit) {
		clear();
		insertNodes(currentLevel);
		insertEdges(currentLevel);
		
		if (isInit) {
			cy.center();
		}
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
		
		console.log(JSON.stringify(levelCurrentStates));
		
		if (isInit) {
			maxHeight = levelHeights[levelHeights.length - 1];
			minHeight = levelHeights[0];
			
			heightStep = (maxHeight - minHeight) / ZOOM_STEPS;
			setZoom(minCyZoom);
			
			currentHeight = maxHeight;
			currentLevel = levelHeights.length - 1;
		
			minAndMaxCoords();
		}
		
		redraw(isInit);
	}
	
	function setCurrentLevel(levelIdx) {
		if (modeConfig.mode.type == MODE_TARGET_FTR) {
			fetchTargetFtr(modeConfig.mode.config.targetFtr);
		}
		
		redraw();
		fetchCurrentState(hierarchy[levelIdx].height);
	}
	
	function drawNode(nodeId) {
		if (nodeId == null) return;
		
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
	}
	
	function clearStyles() {
		var nodes = cy.nodes();
		
		nodes.css('border-color', DEFAULT_BORDER_COLOR);
		nodes.css('backgroundColor', DEFAULT_NODE_COLOR);
		nodes.css('border-color', DEFAULT_BORDER_COLOR);
		nodes.css('z-index', BACKGROUND_Z_INDEX);
	}
	
	function drawNodes() {
		clearStyles();
		
		var levelInfo = levelNodes[currentLevel];
		for (var i = 0; i < levelInfo.length; i++) {
			drawNode(levelInfo[i].id);
		}
	}
	
	function clearCurrentState() {
		clearStyles();
		
		modeConfig.current = null;
		modeConfig.future = {};
		modeConfig.past = {};
	}
	
	function redrawSpecial() {
		drawNode(modeConfig.selected);
		drawNode(modeConfig.current);
		for (var nodeId in modeConfig.future)
			drawNode(nodeId);
		for (var nodeId in modeConfig.past)
			drawNode(nodeId);
		if (modeConfig.mode.type == MODE_PROBS) {
			for (var nodeId in modeConfig.mode.config.probs)
				drawNode(nodeId);
		}
	}
	
	function emphasizeEdges(node) {
		console.log("Emphasizing neighbour edges.");
		//console.log(cy.edges("[source='nodeId']"));
		
		cy.edges().css({
			'line-color': 'darkgray',
			'target-arrow-color': 'darkgray'
		});
		
		node.neighborhood("edge[source =" + node.id() + "]").css({
			'line-color': 'green',
			'target-arrow-color': 'green',
		});
	}
	
	//===============================================================
	// SET STATES
	//===============================================================
	
	function setCurrentState(stateId, height) {
		clearCurrentState();
		modeConfig.current = stateId;
		cy.nodes('#' + stateId).select();	// TODO does this work???
		
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
		
		// TODO remove this
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
					'content': 'data(label)',
					'text-valign': 'center'
				},
			},
			{
				selector: 'edge',
				css: {
					'target-arrow-shape': 'triangle',
					'target-arrow-color': EDGE_COLOR,
					'content': 'data(value)',
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
		cy.nodes().css('shape', 'ellipse');
		cy.nodes().css('border-width', DEFAULT_BORDER_WIDTH);
		drawNode(stateId);
		
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
			redraw();
			redrawSpecial();
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
				setMode(MODE_NORMAL, {});
				redraw();
				redrawSpecial();
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
			graphNode.css('label', name);
			graphNode.data('label', getNodeLabel(node));
			// TODO
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
		
		onZoomChanged: function (callback) {
			callbacks.zoomChanged = callback;
		}
	}
	
	return that;
}
