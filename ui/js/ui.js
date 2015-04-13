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
			fetchHistogram: function (stateId, ftrId, openWindow, insertDiv) {
				if (openWindow)
					window.open('popups/histogram.html?s=' + stateId + '&f=' + ftrId);
				else {
					$.ajax('api/histogram', {
						dataType: 'json',
						data: { stateId: stateId, feature: ftrId },
						success: function (hist) {
							drawHistogram({data: hist, container: insertDiv != null ? insertDiv : 'hist-wrapper'});
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
			function changeControlVal(ftrIdx, val) {
				$.ajax('api/setControl', {
					dataType: 'json',
					data: {ftrIdx: ftrIdx, factor: val},
					method: 'POST',
					success: function (data) {
						viz.setModel(data);
					},
					error: function (jqXHR, status) {
						alert(status);
					}
				});
			}
			
			$.ajax('api/features', {
				dataType: 'json',
				success: function (ftrs) {
					var observList = $('#ul-ftrs-obs');
					var controlDiv = $('#div-ftrs-control');
					
					$.each(ftrs.observation, function (idx, name) {
						var li = $('<li />').appendTo(observList);
						li.html('<input type="checkbox" value="' + idx + '" />' + name + '<br />');
					});
					
					$.each(ftrs.control, function (idx, name) {
						var div = $('<div />').appendTo(controlDiv);
						var label = $('<label />').appendTo(div);
						var input = $('<input />').appendTo(div);
						
						div.addClass('form-group');
						
						input.attr('type', 'range');
						input.attr('min', 0);
						input.attr('max', 2);
						input.attr('step', .1);
						input.val(1);
						input.addClass('form-control');
						input.attr('id', 'control-' + (idx + ftrs.observation.length));
						
						label.attr('for', 'control-' + (idx + ftrs.observation.length));
						label.html(name);
					});
					
					observList.find('input[type=checkbox]').change(function (event) {
						var el = $(event.target);
						var checked = el.prop('checked');
						
						if (checked) {
							// uncheck the other elements
							observList.find('input[type=checkbox]').removeAttr('checked');
							el.prop('checked', true);
							
							var ftrIdx = el.val();
							viz.setTargetFtr(ftrIdx);
						} else {
							viz.setTargetFtr(null);
						}
					});
					
					controlDiv.find('input[type=range]').change(function (event) {
						var el = $(event.target);
						var val = el.val();
						var ftrIdx = el.attr('id').split('-').pop();
						
						changeControlVal(ftrIdx, val);
					});
				},
				error: function (jqXHR, status) {
					alert(status);
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
					var ftrWgts = data.featureWeights;
					// find max and min weigts
					var maxWgt = Number.NEGATIVE_INFINITY;
					var minWgt = Number.POSITIVE_INFINITY;
					
					for (var i = 0; i < ftrWgts.length; i++) {
						if (ftrWgts[i] > maxWgt) maxWgt = ftrWgts[i];
						if (ftrWgts[i] < minWgt) minWgt = ftrWgts[i];
					}
					
					$('#state-id').html(data.id);
					
					$.each(data.features.observations, function (idx, val) {
						var color;
						if (ftrWgts[idx] > 0)
							color = 'rgb(0,' + Math.floor(255*ftrWgts[idx] / maxWgt) + ',0)';
						else
							color = 'rgb(' + Math.floor(255*ftrWgts[idx] / minWgt) + ',0,0)';
					
						var thumbnail = $('#div-thumbnail').find('.thumb-col').clone();
						thumbnail.find('.attr-name').html(val.name);
						thumbnail.find('.attr-val').html(val.value.toPrecision(3));
						thumbnail.find('.attr-val').css('color', color);
						thumbnail.find('.container-hist').attr('id', 'container-hist-' + idx);
						$('#div-attrs').append(thumbnail);
						
						ui.fetchHistogram(stateId, idx, false, 'container-hist-' + idx);
						
//						
//						var dt = $('<dt />').appendTo(obsList);
//						var dd = $('<dd />').appendTo(obsList);
//						dd.css('color', color);
//						dt.click(function () {
//							ui.fetchHistogram(stateId, idx, false);
//						});
//						dt.dblclick(function () {
//							ui.fetchHistogram(stateId, idx, true);
//						});
//						dt.html(val.name);
//						dd.html(val.value.toPrecision(3));
					});
					
					var obsList = $('#ul-obser');
					var contrList = $('#ul-controls');
					
					obsList.html('');
					contrList.html('');
					
					$.each(data.features.observations, function (idx, val) {
						var color;
						if (ftrWgts[idx] > 0)
							color = 'rgb(0,' + Math.floor(255*ftrWgts[idx] / maxWgt) + ',0)';
						else
							color = 'rgb(' + Math.floor(255*ftrWgts[idx] / minWgt) + ',0,0)';
					
						var dt = $('<dt />').appendTo(obsList);
						var dd = $('<dd />').appendTo(obsList);
						dd.css('color', color);
						dt.click(function () {
							ui.fetchHistogram(stateId, idx, false);
						});
						dt.dblclick(function () {
							ui.fetchHistogram(stateId, idx, true);
						});
						dt.html(val.name);
						dd.html(val.value.toPrecision(3));
					});
					
					$.each(data.features.controls, function (idx, val) {
						var dt = $('<dt />').appendTo(contrList);
						var dd = $('<dd />').appendTo(contrList);
						
						dt.click(function () {
							ui.fetchHistogram(stateId, idx, false);
						});
						dt.dblclick(function () {
							ui.fetchHistogram(stateId, idx, true);
						});
						dt.html(val.name);
						dd.html(val.value.toPrecision(3));
					});
					
					$('#div-future').html(JSON.stringify(data.futureStates));
					$('#div-past').html(JSON.stringify(data.pastStates));
					
//					$('#container-desc').html(str);
					
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
		
		$('#btn-png').click(function () {
			var png = viz.getPNG();
			//console.log("PNG: " + png);
			window.open(png, '_newtab');
		});
		
		viz.refresh();
		initWs();
		populateFtrs();
		
		return that;
	}
}