var zoomVis = function (opts) {
	var url = opts.url;
	var visContainer = document.getElementById(opts.visContainer);
	var currentHeightContainer = document.getElementById(opts.currentHeightContainer);
	
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
	var levelFutureStates = [];
	
	var colors = ['red', 'green'];
	var nodeColor = 'red';
	var currentStateColor = 'orange';
	
	var visWidth = visContainer.clientWidth;
	var visHeight = visContainer.clientHeight;
	var minX = 0;
	var maxX = 0;
	var minY = 0;
	var maxY = 0;
	
	var MIN_NODE_SIZE = 30;
	var NODE_SCALE_FACTOR = 300;
	var STANDARD_NODE_COLOR = "red";
	
	function calculateNodeRadius(size) {
		return Math.max(2*Math.sqrt(Math.sqrt(size)/Math.PI) * NODE_SCALE_FACTOR,  MIN_NODE_SIZE);
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
	
	function setZoom(zoom) {
		zoomLevel = zoom;
	}
	
	// function getMinAndMaxHeights(heights) {		
		// var minMax = [];
		// minMax[0] = heights[0];
		// minMax[1] = heights[heights.length - 1];
		// return minMax;
	// }
	
	function constructLevels(data) {
		for (var i = 0; i < data.length; i++) {
			levelHeights.push(data[i].height);
			levelJumps.push(data[i].transitions);
			levelCurrentStates.push(data[i].currentState);
			levelFutureStates.push(data[i].futureStates);
			levelNodes.push(data[i].states);
			
		}
		
		console.log(levelHeights);
		console.log(levelNodes);
		
		maxHeight = levelHeights[levelHeights.length - 1];
		minHeight = levelHeights[0];
		
		currentHeight = maxHeight;
		currentLevel = levelHeights.length - 1;
		
		minAndMaxCoords();
		
		draw();
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
					'content': 'data(value)'
				}
			}
		],
		
		ready: function() { console.log('ready') },
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
		for (var i = 0; i < levelFutureStates[level].length; i++) {
			if (levelFutureStates[level][i].id == id && levelFutureStates[level][i].prob > 0) {
				return levelFutureStates[level][i].prob;
			}
		}
		return -1;
	}
	
	function calculatePosition(x, y) {
		var position = [];
		// position[0] = x * 1000;
		// position[1] = y * 1000;
		
		position[0] = ((x + Math.abs(minX)) / maxX) * 0.9 * visWidth + 0.1 * visWidth;
		position[1] = ((y + Math.abs(minY)) / maxY) * 0.9 * visHeight + 0.1 * visHeight;
		console.log("position[x,y]: " + position[0] + " " + position[y]);
		return position;
	}
	
	function insertLevelNodes(level) {
		var currentNodes = levelNodes[level];
		var nodesArray = [];
		for (var i = 0; i < currentNodes.length; i++) {
			var node;
			var nodeColor = "undefined";
			var position = calculatePosition(currentNodes[i].x, currentNodes[i].y);		//[x, y]
			var nodeSize = calculateNodeRadius(currentNodes[i].size);
			
			if (currentNodes[i].id == levelCurrentStates[level]) {
				nodeColor = currentStateColor;
			} else {
				var prob = getFutureStateProb(level, currentNodes[i].id);
				
				if (prob > 0) {		// set color
					//nodeColor = createRGB(prob);
					nodeColor = createHSL(prob);
				}
			}
			
			node = [
				{
					group: 'nodes',
					data: {
						id: '' + String(currentNodes[i].id),
						name: 'test'
					},
					position: {
						x: position[0],
						y: position[1]
					},
					css: {
						'background-color': nodeColor,
						'width': nodeSize,
						'height': nodeSize
					},
					locked: true
				}
			]
			
			cy.add(node);
			//nodesArray.push(node);
		}
		//cy.add(nodesArray);
		//console.log(cy.nodes(""));
	}
	
	function insertLevelJumps(level) {
		var currentJumps = [];
		for (var i = 0; i < levelJumps[level].length; i++) {
			for (var j = 0; j < levelJumps[level][i].length; j++) {
				if (levelJumps[level][i][j] > 0) {
					var edge = [
					{
						group: 'edges',
						data: {
							id: '' +  (levelJumps[level][i].length * i + j),		//id: levelJumps[level][i].id,
							source: levelNodes[level][i].id,
							target: levelNodes[level][j].id,
							value: levelJumps[level][i][j].toFixed(3)
						},
						css: {
							'control-point-step-size': 150,
							'text-valign': 'top',
							'control-point-weight': 0.5
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
	
	function draw(dataJson) {
		insertLevelNodes(currentLevel);
		insertLevelJumps(currentLevel);
	}
	
	function redraw(level) {
		clearNodes();
		insertLevelNodes(currentLevel);
		clearEdges();
		insertLevelJumps(currentLevel);
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
	
	function getAppropriateLevel() {
		if (currentHeight >= maxHeight) {
			return levelHeights.length - 1;
		}
		
		for (var i = 0; i < levelHeights.length; i++) {
			if (levelHeights[i] >= currentHeight) {
				return i;
			}
		}
	}
	
	function sliderChanged(event, ui) {
		currentHeight = ui.value
		currentLevel = getAppropriateLevel();
		redraw();
		
		cy.zoom( {level: Math.abs(currentHeight - maxHeight) * 0.5 + cy.minZoom()});
		currentHeightContainer.innerHTML = currentHeight;				//set height text
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
			//currentHeight--;
			if (currentHeight < maxHeight) {
				currentHeight += ZOOM_STEP;
			} else currentHeight = maxHeight;
			
			if (currentLevel < levelHeights.length - 1) {
				if (currentHeight >= levelHeights[currentLevel + 1]) {
					currentLevel++;
					//currentLevel = getAppropriateLevel()
					redraw();
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
				if (currentHeight <= levelHeights[currentLevel - 1]) {
					currentLevel--;
					//currentLevel = getAppropriateLevel()
					redraw();
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
		
		currentHeightContainer.innerHTML = currentHeight;				//set height text
		
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
		
		var newVal = val1 + 0.1;
		$( "#slider_item_div" ).slider( "option", "value", parseFloat(currentHeight).toFixed(2) );
		var val1 = $( "#slider_item_div" ).slider( "option", "value" );
		console.log("slider new val: " + val1);
	}
	
	
	
	var that = {
		refresh: function () {
			$.ajax({
				url: url,
				data: { },
				success: function (data) {
					//draw(data);
					setupSlider();
					constructLevels(data);
				},	
				dataType: 'json',
				error: function (jqXHR, jqXHR, status, err) {
					alert("failed to receive object: " + status + ", " + err);
				}
			});
		},
		slider: sliderChanged
	}
	
	return that;
}