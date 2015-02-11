var UI;

{
	// private functions
	function getWsUrl() {
		var result;
		var loc = window.location;
		
		if (loc.protocol === "https:") {
		    result = "wss:";
		} else {
		    result = "ws:";
		}
		result += "//" + loc.host;
		result += loc.pathname + (loc.pathname.charAt(loc.pathname.length-1) == '/' ? '' : '/') + "ws";
		
		return result;
	}
	
	// public stuff
	var UI = function (opts) {
		var viz = zoomVis({
			visContainer: 'vis_container',
			currentHeightContainer: 'current_height_value'
		});
		
		function drawMsg(msg) {
			$('#list-msg').append('<li class="li-msg">' + msg + '</li>');
		}
			
		var that = {
			fetchHistogram: function (stateId, ftrId, openWindow) {
				if (openWindow)
					window.open('popups/histogram.html?s=' + stateId + '&f=' + ftrId);
				else {
					$.ajax('api/histogram', {
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
			var address = getWsUrl();
			
			console.log('Connecting websocket to address: ' + address); 
			var ws = new WebSocket(address);
			
			ws.onopen = function () {
	   			console.log('Web socket connected!');
			};
			
			ws.onerror = function (e) {
				console.log('Web socket error: ' + e.message);
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
		
		function populateFtrs() {
			$.ajax('api/features', {
				dataType: 'json',
				success: function (ftrs) {
					var htmlList = $('#ul-ftrs');
					
					$.each(ftrs, function (idx, name) {
						var li = $('<li />').appendTo(htmlList);
						li.html('<input type="checkbox" value="' + idx + '" />' + name + '<br />');
					});
					
					$('#ul-ftrs input[type=checkbox]').change(function (event) {
						var el = $(event.target);
						var checked = el.prop('checked');
						
						if (checked) {
							// uncheck the other elements
							$('#ul-ftrs input[type=checkbox]').removeAttr('checked');
							el.prop('checked', true);
							
							var ftrIdx = el.val();
							viz.setTargetFtr(ftrIdx);
						}
					});
				}
			});
		}
		
		$("#threshold_slider").slider({
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
	
		$("#slider_item_div").slider({
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
		
		$('#container-options #toggler').click(function () {
			$('#options').toggle();
		});
		
		$('#chk-show-fut').change(function () {
			var checked = this.checked;
			var time = parseFloat($('#txt-fut-range').val());
			var deltaTm = .001;
			var level = viz.getCurrentHeight();
			var stateId = viz.getSelectedState();
			
			if (stateId == null) {
				alert('No state selected!');
				return;
			}
			
			if (checked) {
				$.ajax('api/timeDist', {
					dataType: 'json',
					data: { state: stateId, start: -time, end: time, deltaTm: deltaTm, level: level },
					success: function (data) {
						var range = (data[data.length-1].time - data[0].time);
						
						// find the index at which time is 0
						var idx = 0;
						for (var i = 0; i < data.length; i++) {
							if (Math.abs(data[i].time) < deltaTm/5) {
								idx = i;
								break;
							}
						}
						
						var range = data.length;
						var nPast = idx;
						var nFuture = range - idx - 1;
						
						var maxPast = -nPast * deltaTm;
						var maxFut = nFuture * deltaTm;
			
						$('#rng-time-probs').off('change');
						$('#rng-time-probs').attr('min', maxPast);
						$('#rng-time-probs').attr('max', maxFut);
						$('#rng-time-probs').attr('step', deltaTm);
						$('#rng-time-probs').val(0);
						$('#rng-time-probs').change(function () {
							var currentVal = parseFloat($('#rng-time-probs').val());
							
							$('#div-fut-time').html(currentVal);
							
							// find the probabilities
							var idx = Math.round((currentVal - maxPast) / deltaTm);
							var probs = data[idx].probs;
							viz.setProbDist(probs);
						});
						$('#rng-time-probs').change();
					}
				});
			} else {
				// TODO
			}
		});
		
		viz.onStateSelected(function (stateId, height) {
			// fetch state details
			$.ajax('api/details', {
				dataType: 'json',
				data: { stateId: stateId, level: height },
				success: function (data) {
					var str = "STATE ID: " + data.id + '<br />';
					str += '<label for="txt-name">Name</label><input type="text" id="txt-name" />';
					
					$.each(data.features, function (idx, val) {
						str += '<div class="clickable" ondblclick="ui.fetchHistogram(' + stateId + ',' + idx + ',true)" onclick="ui.fetchHistogram(' + stateId + ',' + idx + ',false)">' + val.name + ':\t' + val.value + '</div>';
					});
					
					$('#container-features').html(str);
					
					str = '<br /><br /><br />FUTURE STATES:' + JSON.stringify(data.futureStates);
					str += '<br /><br /><br />PAST STATES:' + JSON.stringify(data.pastStates);
					
					$('#container-desc').html(str);
					
					if (data.name != null) {
						$('#txt-name').val(data.name);
					}
					$('#txt-name').change(function (event) {
						var name = $('#txt-name').val();
						$.ajax('api/stateName', {
							dataType: 'json',
						    type: 'POST',
						    data: { id: stateId, name: name },
						    error: function () {
						    	alert('Failed to set name!');
						    }
						});
					});
				}
			});
		});
		
		// buttons
		$('#btn-save').click(function () {
			var rq = $.get('api/save');
			rq.fail(function () {
				alert('Failed to save!');
			});
		});
		
		viz.refresh();
		initWs();
		populateFtrs();
		
		return that;
	}
}