var zoomVis = function (opts) {
	var url = opts.url;
	var visContainer = document.getElementById(opts.visContainer);
	var currentHeightContainer = document.getElementById(opts.currentHeightContainer);
	
	var state = null;
	
	var zoomLevel = 0;
	var minZoomLevel = 0.5;
	var maxZoomLevel = 60;
	
	var ZOOM_STEP = 0.01;
	
	var minHeight = 0;
	var maxHeight = 0;
	var currentHeight = 0;
	var currentLevel = 0;
	
	var nodes = [];
	var edges = [];
	
	var levelNodes = [];
	var levelJumps = [];
	var levelHeights = [];
	var levelCurrentStates = [];
	
	var DEFAULT_NODE_COLOR = 'DodgerBlue';
	var CURRENT_NODE_COLOR = 'green';
	
	var visWidth = visContainer.clientWidth;
	var visHeight = visContainer.clientHeight;
	var minX = 0;
	var maxX = 0;
	var minY = 0;
	var maxY = 0;
	var xOffset = .1;
	var yOffset = .1;
	
	var edgeColor = 'darkgray';
	
	var MIN_NODE_DIAMETER = 30;
	var NODE_SCALE_FACTOR = 300;
	var STANDARD_NODE_COLOR = "red";
	
	var transitionThreshold = 0;
	
	// adding mouse wheel listener
	if(visContainer.onwheel !== undefined) {
		visContainer.addEventListener('wheel', onMouseWheel)
	} else if(visContainer.onmousewheel !== undefined) {
		visContainer.addEventListener('mousewheel', onMouseWheel)
	} else {
		// unsupported browser
		alert("your browser is unsupported");
	}
	
	function calculateNodeRadius(area) {
		return Math.max(2*Math.sqrt(Math.sqrt(area)/Math.PI) * NODE_SCALE_FACTOR,  MIN_NODE_DIAMETER);
	}
	
	function setupSlider() {
		$( "#slider_item_div" ).slider({
			value: 0.7,
			min: 0,
			max: 1,
			step: 0.01,
			animate:"slow",
			orientation: "vertical",
			//change: sliderChanged						//change: function( event, ui ) {}
			slide: sliderChanged
		});
	}
	
	function setupTransitionLimitSlider() {
		$( "#slider_item_div" ).slider({
			value: 0.5,
			min: 0,
			max: 1,
			step: 0.01,
			animate:"slow",
			orientation: "hotizontal",
			//change: sliderChanged						//change: function( event, ui ) {}
			slide: sliderChanged
		});
	}
	
	function setZoom(zoom) {
		zoomLevel = zoom;
	}

	function clearNodesAndEdges() {
		clearNodes();
		clearEdges();
	}
	
	function clearStructures() {
		levelHeights = [];
		levelJumps = [];
		levelCurrentStates = [];
		levelNodes = [];
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
	
	var cy = cytoscape({
		container: document.getElementById(opts.visContainer),
		
		style: [
			{
				selector: 'node',
				css: {
					'background-color': STANDARD_NODE_COLOR,
					'content': 'data(id)',
					'text-valign': 'center'
				},
			},
			{
				selector: 'edge',
				css: {
					'target-arrow-shape': 'triangle',
					'target-arrow-color': edgeColor,
					'content': 'data(value)',
					'lineColor': edgeColor
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
	
	function createRGB(probability) {
		var r = 0;
		var g = Math.floor(probability * 255);
		var b = 0;
		console.log("createRGB -> probability: " + probability);
		
		return "rgb("+ r + "," + g + "," + b + ")";
	}
	
	function createHSL(probability) {
		var h = 120;
		var s = "100%";
		var l = String( (30 + probability * 50) ) + "%";
		
		return "hsl(" + h + "," + s + "," + l + ")";
	}
	
	/**
	* Checks if the node (based on its id) has a future state probability (higher than 0) on the input level. 
	* Returns the probability value if it does, otherwise the function returns -1
	*/
	function getFutureStateProb(level, id) {
		for (var i = 0; i < levelCurrentStates[level].length; i++) {
			if (levelCurrentStates[level].futureStates[i].id == id && levelCurrentStates[level].futureStates[i].prob > 0) {
				return levelCurrentStates[level].futureStates[i].prob;
			}
		}
		return -1;
	}
	
	function calculatePosition(x, y) {
		var position = [];
		// position[0] = x * 1000;
		// position[1] = y * 1000;
		
		position[0] = ((x + Math.abs(minX)) / maxX) * (1 - xOffset) * visWidth + xOffset * visWidth;
		position[1] = ((y + Math.abs(minY)) / maxY) * (1 - yOffset) * visHeight + yOffset * visHeight;
		console.log("position[x,y]: " + position[0] + " " + position[1]);
		return position;
	}
	
	function insertLevelNodes(level) {
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
						'border-color': 'black'
					},
					locked: true
				}
			];
			
			cy.add(dispNode);
			//nodesArray.push(node);
		}
		
		//cy.add(nodesArray);
		//console.log(cy.nodes(""));
	}
	
	function insertLevelJumps(level) {
		var currentJumps = [];
		var edgeId = 0;
		for (var i = 0; i < levelJumps[level].length; i++) {
			for (var j = 0; j < levelJumps[level][i].length; j++) {
				if (levelJumps[level][i][j] > 0) {
					var edge = [
					{
						group: 'edges',
						data: {
							id: '' + (edgeId++),
							source: levelNodes[level][i].id,
							target: levelNodes[level][j].id,
							value: levelJumps[level][i][j].toFixed(3)
						},
						css: {
							'control-point-step-size': 250,//150,
							'text-valign': 'top',
							'control-point-weight': 0.5,
							'border-style': 'solid'
						}
					}
					]
					//currentJumps.push(edge);
					cy.add(edge)
				}
				
			}
			
		}
		//cy.add(currentJumps)
	}
	
	
	function clearNodes() {
		var drawnNodes = cy.nodes("");
		cy.remove(drawnNodes);
		
		//var eles = cy.$(':selected').remove();
	}
	
	function clearEdges() {
		var drawnEdges = cy.edges("");
		cy.remove(drawnEdges);
	}
	
	function redraw(isInit) {
		clearNodesAndEdges();
		insertLevelNodes(currentLevel);
		insertLevelJumps(currentLevel);
		
		if (isInit) {
			cy.center();
			addHandlers();
		}
	}
	
	function getAppropriateLevel() {
		if (currentHeight >= maxHeight) {
			return levelHeights.length - 1;
		}
		
		for (var i = 0; i < levelHeights.length; i++) {
			if (currentHeight >= state[i].height)
				return i;
		}
	}
	
	function sliderChanged(event, ui) {
//		currentHeight = ui.value
//		currentLevel = getAppropriateLevel();
//		redraw();
		
		cy.zoom( {level: Math.abs(currentHeight - maxHeight) * 0.5 + cy.minZoom()});
//		currentHeightContainer.innerHTML = currentHeight;				//set height text
	}
	
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
		
		// console.log("mouse x: " + event.clientX);
		// console.log("mouse y: " + event.clientY);
		// console.log("mouse screen x: " + event.screenX);
		// console.log("mouse screen y: " + event.screenY);
		// console.log("nodes len: " + cy.nodes("").length);
		// console.log("maxHeight: " + maxHeight);
		console.log("currentLevel: " + currentLevel);
		
		currentHeightContainer.innerHTML = state[currentLevel].height;				//set height text
		//slider.slider('value', parseFloat(currentHeight).toFixed(2));
		//$( "#slider_item_div" ).slider('value', parseFloat(currentHeight).toFixed(2));
		//slider.value = 0.5;
		//slider('value', 0.5)
		//$( "#slider_item_div" ).slider('value', parseFloat(currentHeight).toFixed(2));
		//$( "#slider_item_div" ).slider("option", "value", parseFloat(currentHeight).toFixed(2));
		
		var min = $( "#slider_item_div" ).slider( "option", "min" );
		console.log("slider min: " + min);
		console.log(min);
		var val1 = $( "#slider_item_div" ).slider( "option", "value" );
		console.log("slider val: " + val1);
		console.log(val1);
		
//		var newVal = val1 + 0.1;
//		$( "#slider_item_div" ).slider( "option", "value", parseFloat(currentHeight).toFixed(2) );
//		var val1 = $( "#slider_item_div" ).slider( "option", "value" );
//		console.log("slider new val: " + val1);
	}
	
	function setCurrentLevel(levelIdx) {
		redraw();
		
		fetchCurrentState(state[levelIdx].height);
	}
	
	function fetchStateInfo(stateId) {
		$.ajax('/drilling/details', {
			dataType: 'json',
			data: { stateId: stateId, level: state[currentLevel].height },
			success: function (data) {
				var str = "STATE ID: " + data.id + '<br />';
				$.each(data.features, function (idx, val) {
					str += val.name + ':\t' + val.value + '<br />';
				});
				
				str += '<br /><br /><br />FUTURE STATES:' + JSON.stringify(data.futureStates);
				str += '<br /><br /><br />PAST STATES:' + JSON.stringify(data.pastStates);
				
				$('#container-details').html(str);
			}
		});
	}
	
	function addHandlers() {
		cy.on('click', 'node', function (event) {
			var node = event.cyTarget;
			fetchStateInfo(node.id());
		});
	}
	
	function fetchFutureStates(currStateId, height) {
		$.ajax('/drilling/futureStates', {
			dataType: 'json',
			data: { state: currStateId, level: height },
			success: function (states) {
				for (var i = 0; i < Math.min(3, states.length); i++) {
					var stateId = states[i].id;
					var node = cy.nodes('#' + stateId);
					node.css('backgroundColor', 'cyan');
				}
			}
		});
	}
	
	function fetchPastStates(currStateId, height) {
		$.ajax('/drilling/pastStates', {
			dataType: 'json',
			data: { state: currStateId, level: height },
			success: function (states) {
				for (var i = 0; i < Math.min(3, states.length); i++) {
					var stateId = states[i].id;
					var node = cy.nodes('#' + stateId);
					node.css('backgroundColor', 'pink');
				}
			}
		});
	}
	
	function setCurrentState(stateId, height) {
		cy.nodes().css('backgroundColor', DEFAULT_NODE_COLOR);
		
		fetchPastStates(stateId, height);
		fetchFutureStates(stateId, height);
		
		var node = cy.nodes('#' + stateId);
		node.css('backgroundColor', CURRENT_NODE_COLOR);
	}
	
	function fetchCurrentState(height) {
		$.ajax('/drilling/currentState', {
			dataType: 'json',
			data: { level: height },
			success: function (state) {
				setCurrentState(state.id, height);
			}
		});
	}
	
	var that = {
		refresh: function () {
			$.ajax({
				url: url,
				success: function (data) {
					data.sort(function (a, b) {
						return a.height - b.height;
					});
					state = data;
					
					//draw(data);
					setupSlider();
					constructLevels(state, true);
				},	
				dataType: 'json',
				error: function (jqXHR, jqXHR, status, err) {
					alert("failed to receive object: " + status + ", " + err);
				}
			});
		},
		setCurrentStates: function (currentStates) {
			if (state == null) return;
						
			currentStates.sort(function (a, b) {
				return a.height - b.height;
			});
			
			setCurrentState(currentStates[currentLevel].id, currentStates[currentLevel].height);
		},
		slider: sliderChanged
	}
	
	return that;
}