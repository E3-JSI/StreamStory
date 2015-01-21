var UI = function (opts) {
	var viz = zoomVis({
		url: opts.url,
		visContainer: 'vis_container',
		currentHeightContainer: 'current_height_value'
	});
		
	var that = {
		drawMsg: function (msg) {
			$('#list-msg').append('<li class="li-msg">' + msg + '</li>');
		},
		fetchHistogram: function (stateId, ftrId, openWindow) {
			if (openWindow)
				window.open('/ui/popups/histogram.html?s=' + stateId + '&f=' + ftrId);
			else {
				$.ajax('/drilling/histogram', {
					dataType: 'json',
					data: { stateId: stateId, feature: ftrId },
					success: function (hist) {
						drawHistogram({data: hist, container: 'hist-wrapper'});
					}
				});
			}
		},
	};
	
	function initWs() {
		var address = location.host + '/websocket';
		
		console.log('Connecting websocket to address: ' + address); 
		var ws = new WebSocket('ws://' + address);
		
		ws.onopen = function () {
   			console.log('Web socket connected!');
		};
		
		ws.onerror = function (e) {
			console.log('Web socket error: ' + e);
			alert('Web socket error!');
		};
		
		ws.onmessage = function (msgStr) {
			var msg = JSON.parse(msgStr.data);
			
			if (msg.type == 'stateChanged')
				viz.setCurrentStates(msg.content);
			else if (msg.type == 'anomaly') {
				drawMsg(msg.content);
			}
			else if (msg.type == 'outlier') {
				drawMsg('Outlier: ' + JSON.stringify(msg.content));
			}
		};
	}
	
	$( "#threshold_slider" ).slider({
		value: 1,
		min: .5,
		max: 1,
		step: 0.01,
		animate:"slow",
		orientation: "hotizontal",
		slide: function (event, ui) {
			viz.setTransitionThreshold(ui.value);
		}
	});

	$( "#slider_item_div" ).slider({
		value: 0.7,
		min: 0,
		max: 1,
		step: 0.01,
		animate:"slow",
		orientation: "vertical",
		//change: sliderChanged						//change: function( event, ui ) {}
		slide: function (event, ui) {
			viz.setZoom(ui.value);
		}
	});
	
	viz.refresh();
	initWs();
	
	return that;
}