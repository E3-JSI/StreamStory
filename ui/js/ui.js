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
		
		function drawMsg(msg, handler) {
			$('#list-msg').append('<li class="list-group-item li-msg">' + msg + '</li>');
			if (handler != null) {
				$('#list-msg li').last().addClass('clickable');
				$('#list-msg li').last().click(handler);
			}
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
				else if (msg.type == 'statePrediction') {
					var content = msg.content;
					var msgStr = 'Prediction, current: ' + content.currState + ' target: ' + content.targetState + ', prob: ' + content.probability;
					drawMsg(msgStr, function (event) {
						// draw a histogram of the PDF
						var timeV = content.pdf.timeV;
						var probV = content.pdf.probV;
						
						var data = [];
						for (var i = 0; i < timeV.length; i++) {
							data.push([timeV[i], probV[i]]);
						}
						
						var min = timeV[0];
						var max = timeV[timeV.length-1];
						
						$('#popover-pdf-hist').slideDown();
						
						var chart = new Highcharts.Chart({
						    chart: {
						        renderTo: document.getElementById('hist-pdf'),
						        type: 'line'
						    },
						    title: {
					        	floating: true,
					        	text: ''
					        },
					        legend: {
					        	enabled: false
					        },
						    yAxis: {
						    	title: {
						    		enabled: false
						    	},
						    	min: 0,
						    	max: 1
						    },
						    plotOptions: {
						        column: {
						            groupPadding: 0,
						            pointPadding: 0,
						            borderWidth: 0
						        }
						    },
						    series: [{
						    	name: 'PDF',
						        data: data
						    }]
						});
					});
				}
			};
		}
		
		function populateUI() {
			function changeControlVal(ftrIdx, val) {
				$.ajax('api/setControl', {
					dataType: 'json',
					data: { ftrIdx: ftrIdx, factor: val },
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
					
					$('#chk-sim-inputs').off('checked');
					$('#chk-sim-inputs').prop('checked', false);
					
					$.each(ftrs.observation.concat(ftrs.control), function (idx, name) {
						var li = $('<li />').appendTo(observList);
						li.html('<input type="checkbox" value="' + idx + '" />' + name + '<br />');
					});
					
					$.each(ftrs.control, function (idx, name) {
						var controlId = 'control-' + (idx + ftrs.observation.length);
						
						var div = $('<div />').appendTo(controlDiv);
						var label = $('<label />').appendTo(div);
						var input = $('<div />').appendTo(div);
												
						div.addClass('form-group');
						
						input.attr('id', controlId);
						
						label.attr('for', controlId);
						label.html(name);
						
						
						$('#' + controlId).slider({
							value: 1,
							min: 0,
							max: 2,
							step: 0.01,
							animate:"slow",
							orientation: "hotizontal",
							change: function (event, ui) {
								var el = $(event.target);
								var val = ui.value;
								var ftrIdx = el.attr('id').split('-').pop();
								
								changeControlVal(ftrIdx, val);
							}
						});
						
						// enable / disable handlers
						$('#' + controlId).slider('disable');
						$('#chk-sim-inputs').change(function (event) {
							$('#' + controlId).slider(event.target.checked ? 'enable' : 'disable');
							if (!event.target.checked) {
								$('#' + controlId).slider('value', 1);
							}
						});
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
				},
				error: function (jqXHR, status) {
					alert(status);
				}
			});
			
			$.ajax('api/param', {
				dataType: 'json',
				data: { paramName: 'predictionThreshold' },
				success: function (paramObj) {
					$('#range-pred-threshold').slider("value", paramObj.value);
				},
				error: function (jqXHR, status) {
					alert(status);
				}
			});
			
			$.ajax('api/param', {
				dataType: 'json',
				data: { paramName: 'timeHorizon' },
				success: function (paramObj) {
					$('#range-time-horizon').slider("value", paramObj.value);
				},
				error: function (jqXHR, status) {
					alert(status);
				}
			});
			
			$.ajax('api/param', {
				dataType: 'json',
				data: { paramName: 'pdfBins' },
				success: function (paramObj) {
					$('#range-pdf-bins').slider("value", paramObj.value);
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
			value: viz.getZoom(),
			min: viz.getMinZoom(),
			max: viz.getMaxZoom(),
			step: 0.01,
			animate:"slow",
			orientation: "vertical",
			//change: sliderChanged						//change: function( event, ui ) {}
			slide: function (event, ui) {
				viz.setZoom(ui.value);
			}
		});
		
		viz.onZoomChanged(function (zoom) {
			$("#slider_item_div").slider('value', zoom);
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
					// clear the panel
					$('#txt-name').val('');
					$('#state-id').html('');
					$('#chk-target').removeAttr('checked');
					$('#div-attrs').html('');
					$('#div-future').html('');
					$('#div-past').html('');
					$('#wrapper-details').css('display', 'block');
					
					// populate
					// basic info
					if (data.name != null) $('#txt-name').val(data.name);
					$('#state-id').html(data.id);
					
					$('#chk-target').off('change');	// remove the previous handlers
					$('#chk-target').prop('checked', data.isTarget != null && data.isTarget);
					$('#chk-target').change(function (event) {
						var stateId = data.id;
						var height = viz.getCurrentHeight();
						var isTarget = $('#chk-target').is(':checked');
						
						$.ajax('api/setTarget', {
							dataType: 'json',
							type: 'POST',
							data: { id: stateId, height: height, isTarget: isTarget },
							error: function () {
								alert('Failed to set target state!');
							},
							success: function () {
								viz.setTargetState(stateId, isTarget);
							}
						});
					});
					
					// features
					// feature weights
					var ftrWgts = data.featureWeights;
					// find max and min weigts
					var maxWgt = Number.NEGATIVE_INFINITY;
					var minWgt = Number.POSITIVE_INFINITY;
					
					for (var i = 0; i < ftrWgts.length; i++) {
						if (ftrWgts[i] > maxWgt) maxWgt = ftrWgts[i];
						if (ftrWgts[i] < minWgt) minWgt = ftrWgts[i];
					}
					
					// fetch histograms
					$.each(data.features.observations.concat(data.features.controls), function (idx, val) {
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
					});
					
					// future/past states
					$('#div-future').html(JSON.stringify(data.futureStates));
					$('#div-past').html(JSON.stringify(data.pastStates));
										
					// add handlers
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
				},
				error: function (jqXHR, status, err) {
					console.log(JSON.stringify(err));
					alert(status);
				}
			});
		});
		
		function postParam(paramName, paramVal) {
			$.ajax('api/param', {
				dataType: 'json',
				data: { paramName: paramName, paramVal: paramVal },
				method: 'POST',
				error: function (jqXHR, status) {
					alert('Failed to set parameter value: ' + status);
				}
			});
		}
		
		// setup the configuration sliders
		$('#range-pred-threshold').slider({
			value: .5,
			min: 0,
			max: 1,
			step: .05,
			animate: true,
			change: function (event, ui) {
				var val = ui.value;
				$('#span-pred-threshold').html(val);
				postParam('predictionThreshold', val);
			}
		});
		
		$('#range-time-horizon').slider({
			value: 1,
			min: 0,
			max: 10,
			step: .1,
			animate: true,
			change: function (event, ui) {
				var val = ui.value;
				$('#span-time-horizon').html(val);
				postParam('timeHorizon', val);
			}
		});
		
		$('#range-pdf-bins').slider({
			value: 100,
			min: 100,
			max: 10000,
			step: 10,
			animate: true,
			change: function (event, ui) {
				var val = ui.value;
				$('#span-pdf-bins').html(val);
				postParam('pdfBins', val);
			}
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
		populateUI();
		
		return that;
	}
}