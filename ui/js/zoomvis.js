var zoomVis = function (opts) {
	// colors
	var EDGE_COLOR = 'darkgray';
	var DEFAULT_NODE_COLOR = 'rgb(120,120,120)';//'DodgerBlue';
	var CURRENT_NODE_COLOR = 'green';
	var DEFAULT_BORDER_COLOR = 'black';
	
	// size
	var MIN_NODE_DIAMETER = 30;
	var NODE_SCALE_FACTOR = 300;
	
	var ZOOM_STEP = 0.01;
	
	var url = opts.url;
	var visContainer = document.getElementById(opts.visContainer);
	var currentHeightContainer = document.getElementById(opts.currentHeightContainer);
	
	var hierarchy = null;
	var specialStates = {
		selected: null,
		current: null,
		future: {},
		past: {}
	};
	
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
	
	function calculateNodeRadius(area) {
		return Math.max(2*Math.sqrt(Math.sqrt(area)/Math.PI) * NODE_SCALE_FACTOR,  MIN_NODE_DIAMETER);
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
			
			dispNode = [
				{
					group: 'nodes',
					data: {
						id: '' + String(levelInfo[i].id),
						name: 'test'
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
						'border-color': DEFAULT_BORDER_COLOR
					},
					locked: true
				}
			];
			
			cy.add(dispNode);
		}
	}
	
	function insertEdges(level) {
		var currentJumps = [];
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
				var edge = [
				{
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
				}
				]
				cy.add(edge)
			}
		}
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
			levelHeights.push(data[i].height);
			levelJumps.push(data[i].transitions);
			levelCurrentStates.push({currentState: data[i].currentState, futureStates: data[i].futureStates});
			levelNodes.push(data[i].states);
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
			node.css('backgroundColor', CURRENT_NODE_COLOR);
		}
		if (nodeId in specialStates.future) {
			var prob = specialStates.future[nodeId];
			
			var defaultColor = 0;
			var futureColor = 190;
			var color = 'hsla(216, ' + (28 + Math.floor((100-28)*prob)) + '%, 55%, 1)';
			node.css('backgroundColor', color);
		}
		if (nodeId in specialStates.past) {
			node.css('border-color', 'orange');
		}
	}
	
	function redrawSpecial() {
		drawNode(specialStates.selected);
		drawNode(specialStates.current);
		for (var nodeId in specialStates.future)
			drawNode(nodeId);
		for (var nodeId in specialStates.past)
			drawNode(nodeId);
	}
	
	//===============================================================
	// FETCH/SET STATES
	//===============================================================
	
	function fetchStateInfo(stateId) {
		$.ajax('/drilling/details', {
			dataType: 'json',
			data: { stateId: stateId, level: hierarchy[currentLevel].height },
			success: function (data) {
				var str = "STATE ID: " + data.id + '<br />';
				
				$.each(data.features, function (idx, val) {
					str += '<div class="clickable" ondblclick="ui.fetchHistogram(' + stateId + ',' + idx + ',true)" onclick="ui.fetchHistogram(' + stateId + ',' + idx + ',false)">' + val.name + ':\t' + val.value + '</div>';
				});
				
				$('#container-features').html(str);
				
				str = '<br /><br /><br />FUTURE STATES:' + JSON.stringify(data.futureStates);
				str += '<br /><br /><br />PAST STATES:' + JSON.stringify(data.pastStates);
				
				$('#container-desc').html(str);
			}
		});
	}
	
	function fetchFutureStates(currStateId, height) {
		specialStates.future = {};
		
		$.ajax('/drilling/futureStates', {
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
		
		$.ajax('/drilling/history', {
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
	
	function setCurrentState(stateId, height) {
		specialStates.current = stateId;
		
		var nodes = cy.nodes();
		nodes.css('backgroundColor', DEFAULT_NODE_COLOR);
		nodes.css('shape', 'ellipse');
		nodes.css('border-color', DEFAULT_BORDER_COLOR);
		
		fetchPastStates(stateId, height);
		fetchFutureStates(stateId, height);
		drawNode(stateId);
	}
	
	function fetchCurrentState(height) {
		specialStates.current = null;
		
		$.ajax('/drilling/currentState', {
			dataType: 'json',
			data: { level: height },
			success: function (state) {
				setCurrentState(state.id, height);
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
					'content': 'data(id)',
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
		specialStates.selected = stateId;
		fetchStateInfo(stateId);
		
		cy.nodes().css('shape', 'ellipse');
		
		drawNode(stateId);
	});
	
	//===============================================================
	// OBJECT
	//===============================================================
	
	var that = {
		refresh: function () {
			$.ajax({
				url: url,
				success: function (data) {
					data.sort(function (a, b) {
						return a.height - b.height;
					});
					hierarchy = data;
					
					//draw(data);
					//setupSlider();
					constructLevels(hierarchy, true);
				},	
				dataType: 'json',
				error: function (jqXHR, jqXHR, status, err) {
					alert("failed to receive object: " + status + ", " + err);
				}
			});
		},
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
		setZoom: function (value) {
			cy.zoom({level: Math.abs(value - maxHeight) * 0.5 + cy.minZoom()});
		}
	}
	
	return that;
}