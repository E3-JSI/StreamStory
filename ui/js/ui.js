var UI;

{
	var WebSocketWrapper = function () {
		var nNotifications = 0;
		var msgQ = [];
		
		function drawMsg(msg, handler) {
			$('#list-msg').append('<li class="list-group-item li-msg">' + msg + '</li>');
			if (handler != null) {
				$('#list-msg li').last().addClass('clickable');
				$('#list-msg li').last().click(handler);
			}
			
			msgQ.push(msg);
			while (msgQ.length > 2)
				msgQ.shift();
			
			$('#span-num-msgs').html(++nNotifications + '');
						
			for (var i = 0; i < msgQ.length; i++) {
				var id = 'div-msg-' + i;
				$('#' + id).alert('close');
				
				var wrapper = $('#div-msg-' + i + '-wrapper');
				var alertDiv = $('<div />').appendTo(wrapper);
				
				alertDiv.addClass('alert');
				alertDiv.addClass('alert-info');
				alertDiv.addClass('alert-dismissible');
				alertDiv.attr('role', 'alert');
				alertDiv.attr('id', id);
				alertDiv.html(msgQ[i]);
			}
		}
		
		function getMsgContent(header, contentVals) {
			var drawStr = '<h5>' + header + '</h5>';
			drawStr += '<p>';
			
			var contentKeys = [];
			for (var key in contentVals) {
				contentKeys.push(key);
			}
			
			for (var i = 0; i < contentKeys.length; i++) {
				var contentKey = contentKeys[i];
				var contentVal = contentVals[contentKey];
				
				if (contentVal != null && typeof contentVal == 'object') {
					var keys = [];
					for (var key in contentVal) {
						keys.push(key);
					}
					
					for (var j = 0; j < keys.length; j++) {
						drawStr += keys[j] + '=' + contentVal[keys[j]];
						if (j < keys.length - 1)
							drawStr += ', ';
					}	
				} else {
					drawStr += contentKey + '=' + contentVal;
				}
				
				if (i < contentKeys.length - 1) {
					drawStr += '<br />';
				}
			}
			
			drawStr += '</p>';
			
			return drawStr;
		}
		
		function getWsUrl() {
			var result;
			var loc = window.location;
			
			if (loc.protocol === "https:") {
			    result = "wss:";
			} else {
			    result = "ws:";
			}
			
			var path = loc.pathname;
			path = path.substring(0, path.lastIndexOf('/')) + '/ws';
			
			result += "//" + loc.host + path;
			return result;
		}
		
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
				else if (msg.type == 'prediction') {
					drawMsg(getMsgContent('Prediction', msg.content));
				} 
				else if (msg.type == 'coeff') {
					drawMsg(getMsgContent('Coefficient', msg.content));
				}
				else if (msg.type == 'statePrediction') {
					var content = msg.content;
					var msgStr = 'Prediction, current: ' + content.currState + ' target: ' + content.targetState + ', prob: ' + content.probability.toFixed(2);
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
		
		initWs();
		return {};
	}
	
	// public stuff
	var UI = function (opts) {
		var featureInfo = null;
		
		var viz = zoomVis({
			visContainer: 'vis_container',
			currentHeightContainer: 'span-zoom-val'
		});
		
		var wsWrapper = null;
		
		function privateFetchHistogram(opts) {
			var container = opts.insertDiv != null ? opts.insertDiv : 'hist-wrapper';
			
			if (opts.type == 'state') {
				if (opts.openWindow)
					window.open('popups/histogram.html?s=' + opts.stateId + '&f=' + opts.ftrId);
				else {
					$.ajax('api/histogram', {
						dataType: 'json',
						data: { stateId: opts.stateId, feature: opts.ftrId },
						success: function (hist) {
							drawHistogram({
								data: hist,
								container: container,
								showY: opts.showY
							});
						},
						error: function (jqXHR, status) {
							alert(status);
						}
					});
				}
			} else {	// transition
				$.ajax('api/transitionHistogram', {
					dataType: 'json',
					data: { sourceId: opts.sourceId, targetId: opts.targetId, feature: opts.ftrId },
					success: function (hist) {
						drawHistogram({
							data: hist,
							container: container,
							showY: opts.showY
						});
					},
					error: function (jqXHR, status) {
						alert(status);
					}
				});
			}
		}
		
		function populateUI() {
			function changeControlVal(stateId, ftrIdx, val) {
				var data = { ftrIdx: ftrIdx, val: val };
				if (stateId != null) data.stateId = stateId;
				
				$.ajax('api/setControl', {
					dataType: 'json',
					data: data,
					method: 'POST',
					success: function (data) {
						viz.setModel(data);
					},
					error: function (jqXHR, status) {
						alert(status);
					}
				});
			}
			
			function resetControlVal(stateId, ftrId) {
				var data = {};
				if (stateId != null) data.stateId = stateId;
				if (ftrId != null) data.ftrIdx = ftrId;
				
				$.ajax('api/resetControl', {
					dataType: 'json',
					data: data,
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
					featureInfo = ftrs.observation.concat(ftrs.control);
					
					var observList = $('#ul-ftrs-obs');
					var controlDiv = $('#div-ftrs-control');
					
					var simInputs = $('#chk-sim-inputs');
					
					simInputs.off('checked');
					simInputs.off('change');
					simInputs.prop('checked', false);
					
					$.each(ftrs.observation.concat(ftrs.control), function (idx, desc) {
						var li = $('<li />').appendTo(observList);
						li.html('<input type="checkbox" value="' + idx + '" />' + desc.name + '<br />');
					});
					
					$.each(ftrs.control, function (idx, desc) {
						(function () {
							var bounds = desc.bounds;
							var ftrId = idx + ftrs.observation.length;
							var controlId = 'control-' + (idx + ftrs.observation.length);
							
							var div = $('<div />').appendTo(controlDiv);
							var label = $('<label />').appendTo(div);
							var slider = $('<div />').appendTo(div);
													
							div.addClass('form-group');
							
							slider.attr('id', controlId);
							
							label.attr('for', controlId);
							label.html(desc.name + ' (' + bounds.min.toFixed(2) + ' to ' + bounds.max.toFixed(2) + ')');
							
							var defaultVal = (bounds.max + bounds.min) / 2;
							
							var shouldFireSlideChange = true;	// fix, strange behaviour of the slider
							
							slider.slider({
								value: defaultVal,
								min: bounds.min,
								max: bounds.max,
								step: (bounds.max - bounds.min) / 100,
								animate:"slow",
								orientation: "hotizontal",
								change: function (event, ui) {
									if (shouldFireSlideChange) {
										var val = $('#' + controlId).slider('value');//ui.value;
										changeControlVal(null, ftrId, val);
									}
								}
							});
							
							// enable / disable handlers
							slider.slider('disable');
							simInputs.change(function (event) {
								slider.slider(event.target.checked ? 'enable' : 'disable');
								if (!event.target.checked) {
									shouldFireSlideChange = false;
//									slider.off('change');
									slider.slider('value', defaultVal);
								} else {
									shouldFireSlideChange = true;
									slider.slider('option', 'change').call(slider);
								}
							});
						}());
					});
					
					simInputs.change(function (event) {
						if (event.target.checked) {
							$('#btn-reset-sim').removeClass('hidden');
						}
						else {
							resetControlVal();
							$('#btn-reset-sim').addClass('hidden');
						}
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
			
			$.ajax('api/timeUnit', {
				dataType: 'json',
				data: { paramName: 'pdfBins' },
				success: function (result) {
					$('#span-tu').html(result.value);
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
			$.ajax('api/stateDetails', {
				dataType: 'json',
				data: { stateId: stateId, level: height },
				success: function (data) {
					$('#wrapper-transition-details').hide();
					$('#wrapper-state-details').show();
					
					$('#txt-name').off('change');
					
					// clear the panel
					$('#txt-name').val(data.id);
					$('#chk-target').removeAttr('checked');
					$('#div-attrs').html('');
					$('#div-future').html('');
					$('#div-past').html('');
					
					// populate
					// basic info
					if (data.name != null) $('#txt-name').val(data.name);
					
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
					$.each(data.features.observations, function (idx, val) {
						var histContainerId = 'container-hist-' + idx;
						
						var color;
						if (ftrWgts[idx] > 0)
							color = 'rgb(0,' + Math.floor(255*ftrWgts[idx] / maxWgt) + ',0)';
						else
							color = 'rgb(' + Math.floor(255*ftrWgts[idx] / minWgt) + ',0,0)';
												
						var thumbnail = ui.createThumbnail({
							name: val.name,
							value: val.value,
							valueColor: color,
							histogramContainer: histContainerId
						});
						$('#div-attrs').append(thumbnail);
						ui.fetchHistogram(stateId, idx, false, histContainerId, false);
					});
					
					var nObsFtrs = data.features.observations.length;
					
					$.each(data.features.controls, function (idx, val) {
						var ftrVal = val.value;
						var bounds = val.bounds;
						var ftrId = nObsFtrs + idx;
						var histContainerId = 'container-hist-' + (nObsFtrs + idx);
												
						var thumbnail = ui.createThumbnail({
							name: val.name,
							value: ftrVal,
							histogramContainer: histContainerId,
							valueColor: null,
							isLeaf: data.isLeaf,
							ftrId: ftrId,
							min: bounds.min,
							max: bounds.max,
							stateId: stateId
						});
						
						$('#div-attrs').append(thumbnail);
						
						ui.fetchHistogram(stateId, nObsFtrs + idx, false, 'container-hist-' + (nObsFtrs + idx), false);
					});
										
					// add handlers
					$('#txt-name').change(function (event) {
						var name = $('#txt-name').val();
						var data = { id: stateId, name: name };
						
						var shouldClear = name == '' || name == stateId;
						if (shouldClear) {	// clear the state name
							delete data.name;
						}
						
						$.ajax('api/stateName', {
							dataType: 'json',
						    type: 'POST',
						    data: data,
						    success: function () {
						    	viz.setStateName(stateId, shouldClear ? stateId : name);
						    },
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
		
		viz.onEdgeSelected(function (sourceId, targetId) {
			//reset the values
			$('#div-trans-ftrs').html('');
			
			$('#span-transition-name').html(sourceId + ' -> ' + targetId);
			
			for (var ftrId = 0; ftrId < featureInfo.length; ftrId++) {
				var ftr = featureInfo[ftrId];
				var containerId = 'container-transition-hist-' + ftrId;
				
				$('#div-trans-ftrs').append(ui.createThumbnail({
					name: ftr.name,
					value: null,
					valueColor: null,
					histogramContainer: containerId
				}));
				
				ui.fetchTransitionHistogram(sourceId, targetId, ftrId, containerId);
			}
			
			$('#wrapper-state-details').hide();
			$('#wrapper-transition-details').show();
		});
		
		// buttons
		$('#btn-reset-sim').click(function () {
			$('#btn-reset-sim').addClass('hidden');
			$('#chk-sim-inputs').attr('checked', false);
			$('#chk-sim-inputs').change();
		});
		
		$('#btn-png').click(function () {
			var png = viz.getPNG();
			//console.log("PNG: " + png);
			window.open(png, '_newtab');
		});
		
		$('#btn-save').click(function () {
			var rq = $.get('api/save');
			rq.fail(function () {
				alert('Failed to save!');
			});
		});
		
		$('#chk-show-probs').change(function () {
			var checked = $(this).is(":checked");
			viz.setShowTransitionProbs(checked);
		});
		
		$.ajax('api/controlsSet', {
			dataType: 'json',
			method: 'GET',
			success: function (data) {
				if (data.active)
					$('#btn-reset-sim').removeClass('hidden');
			},
			error: function (jqXHR, status) {
				alert('Faield to fetch simulation status: ' + status);
			}
		});
		
		var that = {
			fetchHistogram: function (stateId, ftrId, openWindow, insertDiv, showY) {
				privateFetchHistogram({ 
					type: 'state',
					stateId: stateId,
					ftrId: ftrId,
					insertDiv: insertDiv,
					openWindow: openWindow,
					showY: showY
				});
			},
			fetchTransitionHistogram: function (sourceId, targetId, ftrId, insertDiv) {
				privateFetchHistogram({
					type: 'transition',
					sourceId: sourceId,
					targetId: targetId,
					ftrId: ftrId,
					insertDiv: insertDiv,
					openWindow: false
				});
			},
			createThumbnail: function (opts) {
				var thumbnail = $('#div-thumbnail').find('.thumb-col').clone();
				var valField = thumbnail.find('.attr-val');
				
				thumbnail.find('.attr-name').html(opts.name);
				thumbnail.find('.container-hist').attr('id', opts.histogramContainer);
				
				if (opts.value != null)
					valField.html(opts.value.toPrecision(3));
				if (opts.valueColor != null) 
					thumbnail.find('.attr-val').css('color', opts.valueColor);
				if (opts.isLeaf) {
					thumbnail.find('.div-ftr-range').show();
					
					var range = thumbnail.find('.range-contr-val');
					range.attr('id', 'range-contr-' + opts.ftrId);
					
					range.slider({
						value: opts.value,
						min: opts.min,
						max: opts.max,
						step: (opts.max - opts.min) / 100,
						animate: true,
						change: function (event, ui) {
							var val = ui.value;
							
							$.ajax('api/setControl', {
								dataType: 'json',
								method: 'POST',
								data: { stateId: opts.stateId, ftrIdx: opts.ftrId, val: val },
								success: function (data) {
									$('#btn-reset-sim').removeClass('hidden');
									viz.setModel(data);
									valField.html(parseFloat(val).toPrecision(3));
								},
								error: function (xhr, status) {
									alert(status);
								}
							});
						}
					});
				}
				
				return thumbnail;
			},
			initWebSockets: function () {
				wsWrapper = WebSocketWrapper();
			}
		};
		
		viz.refresh();
		populateUI();
		
		return that;
	}
}