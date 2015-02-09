var zoomVis = function (opts) {
	// colors
	var EDGE_COLOR = 'darkgray';
	var DEFAULT_NODE_COLOR = 'rgb(120,120,120)';//'DodgerBlue';
	var CURRENT_NODE_COLOR = 'green';
	var DEFAULT_BORDER_COLOR = 'black';
	
	// size
	var MIN_NODE_DIAMETER = 30;
	var NODE_SCALE_FACTOR = 200;
	
	var ZOOM_STEP = 0.01;
	
	var visContainer = document.getElementById(opts.visContainer);
	var currentHeightContainer = document.getElementById(opts.currentHeightContainer);
	
	var hierarchy = null;
	var specialStates = {
		selected: null,
		current: null,
		future: {},
		past: {},
		probsMode: null
	};
	
	var uiConfig = {
		maxNodeSize: 0,
		levelMaxNodeSize: []
	}
	
	var callbacks = {
		stateSelected: function (stateId) {}
	}
	
	var maxNodeSize = 0;
	
	var zoomLevel = 0;
	var minZoomLevel = 0.5;
	var maxZoomLevel = 60;
	
	var minHeight = 0;
	var maxHeight = 0;
	var currentHeight = 0;
	var currentLevel = 0;
		
	var levelNodes = [];
	var levelJumps = [];
	var levelHeights = [];
	var levelCurrentStates = [];
	
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
	
	function scaleNode(size) {
		return Math.sqrt(size / uiConfig.levelMaxNodeSize[currentLevel]);//.maxNodeSize);
	}
	
	function sizeFromProb(prob) {
		return Math.sqrt(prob);
	}
	
	function calculateNodeRadius(area) {
		return Math.max(2*Math.sqrt(scaleNode(area)/Math.PI) * NODE_SCALE_FACTOR,  MIN_NODE_DIAMETER);
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
	
	function calculatePosition(x, y) {
		var position = [];
		
		position[0] = ((x + Math.abs(minX)) / maxX) * (1 - xOffset) * visWidth + xOffset * visWidth;
		position[1] = ((y + Math.abs(minY)) / maxY) * (1 - yOffset) * visHeight + yOffset * visHeight;
		console.log("position[x,y]: " + position[0] + " " + position[1]);
		return position;
	}
	
	//===============================================================
	// CLEAR FUNCTIONS
	//===============================================================
	
	function clear() {
		var drawnNodes = cy.nodes("");
		var drawnEdges = cy.edges("");
		
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
			var position = calculatePosition(levelInfo[i].x, levelInfo[i].y);		//[x, y]
			var nodeSize = calculateNodeRadius(levelInfo[i].size);
			
			console.log('ID: ' + levelInfo[i].id + ', name: ' + levelInfo[i].name);
			
			nodesArray.push({
				group: 'nodes',
				data: {
					id: '' + levelInfo[i].id,
//					value: levelInfo[i].name != null ? levelInfo[i].name : levelInfo[i].id,
					label: levelInfo[i].name != null ? levelInfo[i].name : (levelInfo[i].id + '')
//					name: levelInfo[i].name != null ? levelInfo[i].name : (levelInfo[i].id + '')
				},
				position: {
					x: position[0],
					y: position[1]
				},
				css: {
					'background-color': DEFAULT_NODE_COLOR,
					'width': nodeSize,
					'height': nodeSize,
					'border-width': 5,
					'border-color': DEFAULT_BORDER_COLOR,
					'label': levelInfo[i].name != null ? levelInfo[i].name : levelInfo[i].id
				},
				selected: false,
				selctable: true,
				locked: true
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
				edgeArray.push({
					group: 'edges',
					data: {
						id: i + '-' + edges[j],
						source: levelNodes[level][i].id,
						target: levelNodes[level][edges[j]].id,
						value: levelJumps[level][i][edges[j]].toFixed(3)
					},
					css: {
						'control-point-step-size': 250,//150,
						'text-valign': 'top',
						'control-point-weight': 0.5,
						'border-style': 'solid'
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
			
			uiConfig.levelMaxNodeSize.push(0);
			
			for (var j = 0; j < states.length; j++) {
				var size = states[j].size;
				if (size > uiConfig.maxNodeSize)
					uiConfig.maxNodeSize = states[j].size;
				if (size > uiConfig.levelMaxNodeSize[i])
					uiConfig.levelMaxNodeSize[i] = size;
			}
		}
		
		console.log(JSON.stringify(levelCurrentStates));
		
		if (isInit) {
			maxHeight = levelHeights[levelHeights.length - 1];
			minHeight = levelHeights[0];
			
			currentHeight = maxHeight;
			currentLevel = levelHeights.length - 1;
		
			minAndMaxCoords();
		}
		
		redraw(isInit);
	}
	
	function setCurrentLevel(levelIdx) {
		specialStates.probsMode = null;
		redraw();
		fetchCurrentState(hierarchy[levelIdx].height);
	}
	
	function drawNode(nodeId) {
		if (nodeId == null) return;
		
		var node = cy.nodes('#' + nodeId);
		
		if (nodeId == specialStates.selected) {
			node.css('shape', 'octagon');
		}
		if (nodeId == specialStates.current) {
			node.css('border-color', CURRENT_NODE_COLOR);
		}
		if (nodeId in specialStates.past) {
			node.css('border-color', 'brown');
		}
		
		if (specialStates.probsMode != null) {
			var config = specialStates.probsMode;
			var probs = config.probs;
//			var maxProb = config.maxProb;
			
			var baseColor = 360;//nodeId in specialStates.future ? 307 : ;
			
			var prob = sizeFromProb(probs[nodeId]);
			var color = 'hsla(' + baseColor + ',' + Math.floor(100*prob) + '%, 55%, 1)';
			node.css('backgroundColor', color);
		} else if (nodeId in specialStates.future) {
			var baseColor = 216;//nodeId in specialStates.probs ? 307 : ;
			
			var prob = sizeFromProb(specialStates.future[nodeId]);
			var color = 'hsla(' + baseColor + ',' + (15 + Math.floor((100-15)*prob)) + '%, 55%, 1)';
			node.css('backgroundColor', color);
		}
	}
	
	function clearCurrentState() {
		cy.nodes('#' + specialStates.current).css('border-color', DEFAULT_BORDER_COLOR);
		if (specialStates.probsMode == null) {
			for (var nodeId in specialStates.future) {
				cy.nodes('#' + nodeId).css('backgroundColor', DEFAULT_NODE_COLOR);
			}
		}
		for (nodeId in specialStates.past) {
			cy.nodes('#' + nodeId).css('border-color', DEFAULT_BORDER_COLOR);
		}
		
		specialStates.current = null;
		specialStates.future = {};
		specialStates.past = {};
	}
	
	function redrawSpecial() {
		drawNode(specialStates.selected);
		drawNode(specialStates.current);
		for (var nodeId in specialStates.future)
			drawNode(nodeId);
		for (var nodeId in specialStates.past)
			drawNode(nodeId);
		if (specialStates.probsMode != null) {
			for (var nodeId in specialStates.probsMode.probs)
				drawNode(nodeId);
		}
	}
	
	function emphasizeEdges(node) {
		console.log("Emphasizing neighbour edges.");
		//console.log(cy.edges("[source='nodeId']"));
		
		cy.edges().css({
			'width': 1,
			'line-color': 'darkgray',
			'target-arrow-color': 'darkgray'
		});
		
		node.neighborhood("edge[source =" + node.id() + "]").css({
			'width': 6, 
			'line-color': 'darkgray',
			'target-arrow-color': 'darkgray',
		});
	}
	
	//===============================================================
	// SET STATES
	//===============================================================
	
	function setCurrentState(stateId, height) {
		clearCurrentState();
		specialStates.current = stateId;
		cy.nodes('#' + stateId).select();	// TODO does this work???
		
		fetchPastStates(stateId, height);
		fetchFutureStates(stateId, height);
		drawNode(stateId);
	}
	
	//===============================================================
	// FETCH METHODS
	//===============================================================
	
	function fetchFutureStates(currStateId, height) {
		specialStates.future = {};
		
		$.ajax('api/futureStates', {
			dataType: 'json',
			data: { state: currStateId, level: height },
			success: function (states) {
				for (var i = 0; i < Math.min(3, states.length); i++) {
					var stateId = states[i].id;
					
					specialStates.future[stateId] = states[i].prob;
					drawNode(stateId);
				}
			}
		});
	}
	
	function fetchPastStates(currStateId, height) {
		specialStates.past = {};
		
		$.ajax('api/history', {
			dataType: 'json',
			data: { state: currStateId, level: height },
			success: function (stateIds) {
				for (var i = 0; i < stateIds.length; i++) {
					var stateId = stateIds[i];
					
					specialStates.past[stateId] = true;
					drawNode(stateId);
				}
			}
		});
	}
	
	function fetchCurrentState(height) {
		specialStates.current = null;
		
		$.ajax('api/currentState', {
			dataType: 'json',
			data: { level: height },
			success: function (state) {
				setCurrentState(state.id, height);
			}
		});
	}
	
	function fetchUI() {
		$.ajax({
			url: 'api/multilevel',
			success: function (data) {
				data.sort(function (a, b) {
					return a.height - b.height;
				});
				hierarchy = data;
				constructLevels(hierarchy, true);
				fetchCurrentState(currentHeight);
			},	
			dataType: 'json',
			error: function (jqXHR, jqXHR, status, err) {
				alert("failed to receive object: " + status + ", " + err);
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
		
			if (zoomLevel > minZoomLevel + 1) {
				zoomLevel--;
			} else zoomLevel = minZoomLevel;
			if (currentHeight < maxHeight) {
				currentHeight += ZOOM_STEP;
			} else currentHeight = maxHeight;
			
			if (currentLevel < levelHeights.length - 1) {
				if (currentHeight >= levelHeights[currentLevel + 1]) {
					setCurrentLevel(++currentLevel);
				}
			}
			
		} else {					// scroll in
			if (zoomLevel < maxZoomLevel) {
				zoomLevel++;
			}
			//currentHeight++;
			if (currentHeight > minHeight) {
				currentHeight -= ZOOM_STEP;
			} else currentHeight = minHeight;
			
			if (currentLevel > 0) {
				if (currentHeight < levelHeights[currentLevel]) {
					setCurrentLevel(--currentLevel);
				}
			}
		}
		
		cy.zoom( {level: Math.abs(currentHeight - maxHeight) * 0.5 + cy.minZoom(), renderedPosition: { x: event.clientX, y: event.clientY } });
		console.log(zoomLevel);
		
		currentHeightContainer.innerHTML = hierarchy[currentLevel].height;				//set height text
	}
	
	// adding mouse wheel listener
	if(visContainer.onwheel !== undefined) {
		visContainer.addEventListener('wheel', onMouseWheel)
	} else if(visContainer.onmousewheel !== undefined) {
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
		panningEnabled: true,
		userPanningEnabled: true,
		boxSelectionEnabled: false,
		wheelSensitivity: 0.01,
		// minZoom: 1e-50,
		// maxZoom: 1e50
		minZoom: 0.50
	});
	
	cy.on('click', 'node', function (event) {
		var node = event.cyTarget;
		var stateId = parseInt(node.id());
		var height = hierarchy[currentLevel].height;
		
		// set selected state
		specialStates.selected = stateId;
		
		// redraw
		cy.nodes().css('shape', 'ellipse');
		drawNode(stateId);
		
		// notify the handler
		callbacks.stateSelected(stateId, height);
		emphasizeEdges(node);
	});
	
	cy.on('mouseover', 'node', function (event) {
		//console.log("mouseover event");
		
		var x = event.cyPosition.x;
		var y = event.cyPosition.y;
		console.log("mouseover position: " + x + ", " + y);
		
		$( ".selector" ).tooltip({
			track: true,
			content: "Test"
		});
	});
	
	//===============================================================
	// OBJECT
	//===============================================================
	
	var that = {
		refresh: fetchUI,
		
		setCurrentStates: function (currentStates) {
			if (hierarchy == null) return;
						
			currentStates.sort(function (a, b) {
				return a.height - b.height;
			});
			
			var currState = currentStates[currentLevel].id;
			if (currState != specialStates.current)
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
			
			specialStates.probsMode = config;
			
			redrawSpecial();
		},
		
		setZoom: function (value) {
			cy.zoom({level: Math.abs(value - maxHeight) * 0.5 + cy.minZoom()});
		},
		
		getCurrentHeight: function () {
			return currentHeight;
		},
		
		getCurrentState: function () {
			return specialStates.current;
		},
		
		getSelectedState: function () {
			return specialStates.selected;
		},
		
		// callbacks
		onStateSelected: function (callback) {
			callbacks.stateSelected = callback;
		}
	}
	
	return that;
}
