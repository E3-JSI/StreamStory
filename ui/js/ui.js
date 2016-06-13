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
		error: handleAjaxError()
	});
}

(function () {
	var TAB_ID = null;
	var MODE_SELECT_ACTIVITY_STATE = false;
	var ui;
	var viz;
	var act;
	var firstBottomVizTab = null;
	
	//=======================================================
	// SHARED
	//=======================================================
	
	function getFeatureInfo() {
		var result = [];
		
		var ulObs = $('#ul-ftrs-obs');
		var ulContr = $('#ul-ftrs-contr');
		var ulIgn = $('#ul-ftrs-ign');
		
		function addToResult(i, li) {
			var name = $(li).text().substring(1);
			var id = $(li).find('input[type="checkbox"]').val();
			var type = $(li).find('input[type="hidden"]').val();
			
			result.push({
				name: name,
				type: type,
				id: parseInt(id)
			});
		}
		
		$.each(ulObs.find('li'), addToResult);
		$.each(ulContr.find('li'), addToResult);
		$.each(ulIgn.find('li'), addToResult);
		
		return result;
	}

	//=======================================================
	// WEB SOCKETS
	//=======================================================
	
	(function () {
		function initWebSockets() {
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
					
					if (isNumber(contentVal))
						contentVal = toUiPrecision(parseFloat(contentVal));
					
					if (contentVal != null && typeof contentVal == 'object') {
						var keys = [];
						for (var key in contentVal) {
							keys.push(key);
						}
						
						for (var j = 0; j < keys.length; j++) {
							var val = contentVal[keys[j]];
							if (!isNaN(val))
								val = toUiPrecision(parseFloat(val))
							drawStr += keys[j] + ': ' + val;
							if (j < keys.length - 1)
								drawStr += ', ';
						}	
					} else {
						if (contentKey == 'time' || contentKey == 'start' || contentKey == 'end') {
							contentVal = formatDateTime(new Date(parseInt(contentVal)));
						}
						drawStr += contentKey + ': ' + contentVal;
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
				
				var isDrawing = false;
				
				console.log('Connecting websocket to address: ' + address); 
				var ws = new WebSocket(address);
				
				ws.onopen = function () {
		   			console.log('Web socket connected!');
				};
				
				ws.onerror = function (e) {
					console.log('Web socket error: ' + e.message);
					//alert('Web socket error!');
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
					else if (msg.type == 'activity') {
						drawMsg(getMsgContent('Activity', msg.content));
					}
					else if (msg.type == 'coeff') {
						drawMsg(getMsgContent('Coefficient', msg.content));
					}
					else if (msg.type == 'values') {
						var content = msg.content;
						
						var thumbs = $('#div-values-wrapper').children();
						
						var maxThumbs = 6;
						
						var txt = '';
						for (var key in content) {
							txt += key + ': ' + toUiPrecision(content[key]) + '<br />';
						}
						
						var thumb = $($('#thumbnail-online-vals').html());
						thumb.find('.txt-wrapper').html(txt);
	
						if (thumbs.length >= maxThumbs) {
							if (!isDrawing) {
								isDrawing = true;
								var first = thumbs.first();
								first.width(first.width()-1);	// hack to avoid a blink
								thumbs.first().hide({
									duration: 100,
									easing: 'linear',
									start: function () {},
									complete: function () {
										$(this).remove();
										thumbs.last().find('.thumbnail').removeClass('values-current');
										$('#div-values-wrapper').append(thumb);
										$('#div-values-wrapper').children().last().find('.thumbnail').addClass('values-current')
										isDrawing = false;
									}
								});//.remove();
							}
						} else {
							thumbs.last().find('.thumbnail').removeClass('values-current');
							$('#div-values-wrapper').append(thumb);
							$('#div-values-wrapper').children().last().find('.thumbnail').addClass('values-current')
						}
					}
					else if (msg.type == 'statePrediction') {
						var content = msg.content;
						var eventId = content.eventId;
						var prob = content.probability;
						
						var msgStr;
						if (prob == 1) {
							msgStr = eventId;
						} else {
							msgStr = 100*(prob.toFixed(2)) + '% chance of arriving into ' + eventId;
						}
						
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
		}
		
		$(document).ready(function () {
			if (IS_MODEL_ACTIVE) {
				initWebSockets();
			}
		});
	})();
	
	//=======================================================
	// MAIN USER INTERFACE
	//=======================================================
	
	(function () {
		UI = function (opts) {			
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
							error: handleAjaxError()
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
						error: handleAjaxError()
					});
				}
			}
			
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
					thumbnail.find('.container-chart').attr('id', opts.histogramContainer);
					
					if (opts.type == 'numeric') {
						if (opts.value != null)
							valField.html(opts.value.toPrecision(3));
						if (opts.valueColor != null) 
							thumbnail.find('.attr-val').css('color', opts.valueColor);
					}
					else if (opts.type == 'categorical') {
						if (opts.value != null) {
							var colors = opts.valueColor;
							var valStr = '';
							
							var valArr = [];
							for (var key in opts.value) {
								valArr.push({ value: key, prob: opts.value[key] });
							}
							
							valArr.sort(function (v0, v1) {
								return v1.prob - v0.prob;
							});
							
							opts.value = {};
							for (var i = 0; i < Math.min(10, valArr.length); i++) {
								opts.value[valArr[i].value] = valArr[i].prob;
							}
							
							for (var key in opts.value) {
								var color = colors[key];
								
								if (color == null) throw new Error('Could not find the color for a categorical feature!');
								
								valStr += '<span style="color: ' + color + ';">' + key + ': ' + (opts.value[key]*100).toFixed() + '%</span><br />';
							}
							
							valField.html(valStr.substring(0, valStr.length-7));
						}
						if (opts.valueColor != null)	// TODO what to do with this???
							thumbnail.find('.attr-val').css('color', opts.valueColor);
					}
					else {
						throw new Error('Invalid feature type: ' + opts.type);
					}
					
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
									error: handleAjaxError()
								});
							}
						});
					}
					
					return thumbnail;
				}
			};
					
			return that;
		}
		
		$(document).ready(function () {
			ui = UI();
		});
	})();
	
	//=======================================================
	// NAVBAR
	//=======================================================
	
	(function () {
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
		
		function fetchConfig() {
			$.ajax('api/config', {
				dataType: 'json',
				method: 'GET',
				data: { properties: [
					'calc_coeff',
					'deviation_extreme_lambda',
					'deviation_major_lambda',
					'deviation_minor_lambda',
					'deviation_significant_lambda'
				] },
				success: function (data) {
					var props = {};
					for (var i = 0; i < data.length; i++) {
						props[data[i].property] = data[i].value;
					}
					
					$('#check-calc-coeff').attr('checked', props.calc_coeff == 'true');
					$('#input-extreme-lambda').val(props.deviation_extreme_lambda);
					$('#input-major-lambda').val(props.deviation_major_lambda);
					$('#input-significant-lambda').val(props.deviation_significant_lambda);
					$('#input-minor-lambda').val(props.deviation_minor_lambda);
					$('#btn-fric-cancel, #btn-fric-ok').attr('disabled', 'disabled');
					
					$('#check-calc-coeff').change();
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
		
		$('#lnk-msgs').click(function (event) {
			event.preventDefault();
			$('#content-msgs').slideToggle();
		});
		
		$('#lnk-config').click(function (event) {
			event.preventDefault();
			$('#popup-config').modal({ show: true });
		});
		
		$('#check-calc-coeff').change(function () {
			var isChecked = $(this).is(':checked');
			if (isChecked) {
				// fetch the configuration from the db
				$('#div-configure-coeff').show();
			}
			else
				$('#div-configure-coeff').hide();
		});
		
		$('#config-done').click(function () {
			var predThreshold = $('#range-pred-threshold').slider('value');
			var timeHorizon = $('#range-time-horizon').slider('value');
			var pdfBins = $('#range-pdf-bins').slider('value');
			
			postParam('predictionThreshold', predThreshold);
			postParam('timeHorizon', timeHorizon);
			postParam('pdfBins', pdfBins);
					  			
			$.ajax('api/config', {
				method: 'POST',
				data: {
					calc_coeff: $('#check-calc-coeff').is(':checked'),
					deviation_extreme_lambda: $('#input-extreme-lambda').val(),
					deviation_major_lambda: $('#input-major-lambda').val(),
					deviation_minor_lambda: $('#input-significant-lambda').val(),
					deviation_significant_lambda: $('#input-minor-lambda').val()
				},
				error: function (jqXHR, status) {
					alert(status);
				}
			});
		});
		
		$('#config-cancel').click(function () {
			fetchConfig();
		});
		
		$('#config-cancel, #config-done').click(function () {
			$('#popup-config').modal('hide');
		});
		
		// setup the configuration sliders
		$('#range-pred-threshold').slider({
			value: PREDICTION_THRESHOLD,
			min: 0,
			max: 1,
			step: .05,
			animate: true,
			change: function (event, ui) {
				var val = ui.value;
				$('#span-pred-threshold').html(val);
			}
		});
		
		$('#range-time-horizon').slider({
			value: TIME_HORIZON,
			min: 0,
			max: 100,
			step: .1,
			animate: true,
			change: function (event, ui) {
				var val = ui.value;
				$('#span-time-horizon').html(val + ' ' + getTimeUnit() + 's');
			}
		});
		
		$('#range-pdf-bins').slider({
			value: PDF_BINS,
			min: 100,
			max: 10000,
			step: 10,
			animate: true,
			change: function (event, ui) {
				var val = ui.value;
				$('#span-pdf-bins').html(val);
			}
		});
		
		$(document).ready(function () {
			$('#popup-config').modal({ show: false });
		});
	})();
	
	//=======================================================
	// CONFIGURATION PANEL
	//=======================================================
	
	(function () {
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
				error: handleAjaxError()
			});
		}
		
		function fetchStateProbDist(time) {
			if (time == 0) time = 1e-4;	// FIXME, handle 0 on the server
			
			var stateId = viz.getSelectedState();
			var level = viz.getCurrentHeight();
			
			if (stateId == null) {
				alert('No state selected!');
				$('#div-future-opts').addClass('hidden');
				$('#chk-show-fut').attr('checked', false);
				$('#chk-show-fut').change();
				return false;
			}
			
			$.ajax('api/timeDist', {
				dataType: 'json',
				data: { stateId: stateId, time: time, level: level },
				success: function (data) {					
					viz.setProbDist(data);
					$('#div-fut-time').html(time);
				},
				error: handleAjaxError()
			});
		}
		
		(function () {
			var ftrLists = $('#ul-ftrs-obs,#ul-ftrs-contr,#ul-ftrs-ign');
			ftrLists.find('input[type=checkbox]').change(function (event) {
				var ul = $('#ul-ftrs-obs');
				var el = $(event.target);
				var checked = el.prop('checked');
				
				if (checked) {
					// uncheck the other elements
					ftrLists.find('input[type=checkbox]').removeAttr('checked');
					el.prop('checked', true);
					
					var ftrId = el.val();
					viz.setTargetFtr(ftrId);
				} else {
					viz.setTargetFtr(null);
				}
			});
		})();
		
		$('#chk-sim-inputs').change(function (event) {
			if (event.target.checked) {
				$('#btn-reset-sim').removeClass('hidden');
				$('#div-ftrs-control').find('.slider-contr').slider('enable');
			}
			else {
				$('#div-ftrs-control').find('.slider-contr').slider('disable');
				resetControlVal();
				$('#btn-reset-sim').addClass('hidden');
			}
		});
		
		$("#rng-time-probs").slider({
			value: 0,
			min: -10,
			max: 10,
			step: 0.01,
			disabled: true,
			animate:"slow",
			orientation: "hotizontal",
			change: function (event, ui) {
				if ($('#chk-show-fut').is(':checked')) {
					var val = ui.value;
					fetchStateProbDist(val);
				}
			},
			slide: function (event, ui) {
				$('#div-fut-time').html(ui.value);
			},
		});
		
		$('#chk-show-fut').change(function () {
			if (this.checked) {
				$('#rng-time-probs').slider('enable');
				$('#div-future-opts').removeClass('hidden');
				fetchStateProbDist(0);
			} else {
				$('#div-future-opts').addClass('hidden');
				$('#rng-time-probs').slider('disable');
				$('#rng-time-probs').slider('value', 0);
				if (viz.getMode() == 'probs')
					viz.resetMode();
			}
		});
		
		// buttons
		$('#btn-reset-sim').click(function () {
			$('#btn-reset-sim').addClass('hidden');
			$('#chk-sim-inputs').attr('checked', false);
			$('#chk-sim-inputs').change();
		});
		
		$('#btn-activate').click(function () {
			$.ajax('api/activateModelViz', {
				dataType: 'json',
				method: 'POST',
				data: { activate: !IS_MODEL_ACTIVE },
				success: function () {
					window.location.reload();
				},
				error: handleAjaxError()
			});
		});
		
		$('#btn-layout').click(function () {
			viz.autoLayout();
		})
		
		$('#btn-png').click(function () {
			var png = viz.getPNG();
			//console.log("PNG: " + png);
			window.open(png, '_newtab');
		});
		
		$('#btn-save').click(function () {
			var nodePositions = viz.getNodePositions();
			
			console.log(JSON.stringify(nodePositions));
			
			$.ajax('api/save', {
				dataType: 'json',
				data: { positions: JSON.stringify(nodePositions) },
				method: 'POST',
				success: function (data) {
					showAlert($('#alert-holder'), $('#alert-wrapper-viz-config'), 'alert-success', 'Saved!', null, true);
				},
				error: handleAjaxError($('#alert-wrapper-viz-config'))
			});
		});
		
		$('#chk-show-probs').change(function () {
			var checked = $(this).is(":checked");
			viz.setShowTransitionProbs(checked);
		});
		
		$('#chk-wheel-scroll').change(function () {
			var checked = $(this).is(":checked");
			viz.setWheelScroll(checked);
		});
	})();
	
	//=======================================================
	// VIZUALIZATION HANDLERS
	//=======================================================
	
	(function () {
		var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
		var DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
		
		var fontFactor = 1;
		var DELTA_FONT_FACTOR = .1;
		
		viz = zoomVis({
			visContainer: 'vis_container'
		});
		
		function visualizeDecisionTree(root) {
			var cy;
			
			$('#div-tree-wrapper').removeClass('hidden');
			
			var totalExamples = root.examples;
			
			var nodes = [];
			var edges = [];
			
			var minNodeSize = 100;
			var pieSize = minNodeSize*.8;
			var levelH = 250;
			var hPadding = 50;
					
			var maxNodeW = 1500;
			var minNodeW = 150;
			
			var nodeWRange = maxNodeW - minNodeW;
	
			function getNodeW(examples) {
				var w = nodeWRange*Math.log(1 + 999*examples / root.examples) / 6.907755278982137;
				var uiW = minNodeW + w;
				return uiW;
			}
			
			var currNodeId = 0;
			var maxDepth = Number.MAX_VALUE;
			
			(function construct(node, depth) {
				var children = node.children;
				
				node.id = currNodeId + '';
				currNodeId++;
				
				var data = {
					id: node.id,
					pie1: node.classes[0]*100,
					pie2: node.classes[1]*100
				}
				
				if (node.cut != null) {
					var cut = node.cut;
					
					var label = cut.name;
					
					var alternatives = cut.alternatives;
					if (alternatives.length > 0 &&
							alternatives[0].corr > .9 &&
							alternatives[0].p < .1) {
						label += '\n(' + alternatives[0].name + ')';
					}
					
					switch (cut.ftrType) {
					case 'numeric': {
						if (cut.value > 1000) {
							label += '\n\u2264 ' + cut.value.toFixed() + ' <';
						} else {
							label += '\n\u2264 ' + cut.value.toPrecision(3) + ' <';
						}
						break;
					}
					case 'categorical': {
						label += '\n\u2260 ' + cut.value + ' =';
						break;
					}
					default: {
						throw new Error('Invalid feature type: ' + cut.ftrType);
					}
					}
					
					
					data.label = label;
				}
				
				node.data = data;
				
				if (depth == maxDepth) {
					node.width = nodeW;
					node.children = [];
					return;
				}
				
				var totalW = 0;
				for (var i = 0; i < children.length; i++) {
					var child = children[i];
					
					construct(child, depth + 1);
					
					totalW += child.width;
					
					edges.push({
						data: {
							source: node.id,
							target: child.id,
						}
					});
				}
				
				if (children.length == 0) {
					node.width = getNodeW(node.examples) + hPadding;
				} else {
					node.width = totalW;
				}
			})(root, 0);
			
			(function position(node, pos) {
				var children = node.children;
				
				nodes.push({
					data: node.data,
					position: pos,
					css: {
						width: getNodeW(node.examples).toFixed()
					}
				});
				
				var startX = pos.x - node.width / 2;
				var widthSum = 0;
				for (var i = 0; i < children.length; i++) {
					var child = children[i];
					
					var childCenter = startX + widthSum + child.width/2;
					position(child, { x: childCenter, y: pos.y + levelH });
					
					widthSum += child.width;
				}
			})(root, { x: 0, y: 0 });
			
			function calcCyPan(newZoom) {
				if (newZoom < 1e-50) newZoom = 1e-50;
				if (newZoom > 1e50) newZoom = 1e50;
				
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
			
			function onMouseWheel(event) {
				if (event.preventDefault) event.preventDefault();
				
				var zoomIn = event.deltaY != null ? event.deltaY > 0 : event.wheelDelta < 0;
				
				var zoom = cy.zoom();
				var factor = 1.01;
				var newZoom = zoom * (zoomIn ? 1 / factor : factor);
				
				cy.viewport({zoom: newZoom, pan: calcCyPan(newZoom)});
			}
			
			var edgeColor = 'darkgray';
			
			var container = document.getElementById('div-tree-container');
			
			if (container.onwheel !== undefined) {
				container.addEventListener('wheel', onMouseWheel)
			} else if (container.onmousewheel !== undefined) {
				container.addEventListener('mousewheel', onMouseWheel)
			} else {
				// unsupported browser
				alert("your browser is unsupported");
			}
			
			cy = cytoscape({
				container: container,
				
				fit: true,
				
				autounselectify: true,
				autoungrabify: true,
				
				userZoomingEnabled: false,
				boxSelectionEnabled: false,
				wheelSensitivity: 0.01,
				
				panningEnabled: true,
				userPanningEnabled: true,
				
				layout: {
					name: 'preset'
				},
				
				style: [
					{
						selector: 'node',
						style: {
							'content': 'data(label)',
							'text-valign': 'bottom',
							'text-halign': 'center',
							'text-wrap': 'wrap',
							'color': TEXT_COLOR,//'#F0F0F0',
							'background-color': 'rgb(124, 181, 236)',
							'border-width': 5,
							'font-size': 40,
							'height': minNodeSize,
							'shape': 'rectangle',
							'pie-size': pieSize + 'px',
							'pie-1-background-color': 'red',
							'pie-2-background-color': 'green',
							'pie-1-background-opacity': 100,
							'pie-2-background-opacity': 100,
							'pie-1-background-size': 'mapData(pie1, 0, 100, 0, 100)',
							'pie-2-background-size': 'mapData(pie2, 0, 100, 0, 100)'
						}
					},
	
					{
						selector: 'edge',
						style: {
							'content': 'data(label)',
							'width': 4,
							'font-size': 50,
							'color': TEXT_COLOR,
							'target-arrow-shape': 'triangle',
							'line-color': edgeColor,
							'target-arrow-color': edgeColor,
							'width': 10
						}
					}
				],
				elements: {
					nodes: nodes,
					edges: edges
				},
				
				ready: function () {
					console.log('Tree visualization ready!');
				}
			});
		}
		
		function visualizeParcoords(centroids, allCentroids, ftrConfig) {
			if (allCentroids.length == 0) return;
			
			var wrapper = $('#div-parallel-wrapper');
			
			var opts = {
				color: '#5bc0de',
				alpha: .6
			};
			
			var minBinW = 70;
			
			var backgroundData = [];
			var foregroundData = [];
			
			var dim = 0;
			var dimInitialized = false;
			
			for (var centroidN = 0; centroidN < allCentroids.length; centroidN++) {
				var centroid = allCentroids[centroidN];
				var row = {};
				for (var ftrN = 0; ftrN < centroid.length; ftrN++) {
					var ftr = ftrConfig[ftrN];
					
					switch (ftr.type) {
					case 'numeric': {
						row[ftr.name] = toUiPrecision(centroid[ftrN]);
						if (!dimInitialized) dim++;
						break;
					}
					case 'categorical': {
						for (var key in centroid[ftrN]) {
							row[ftr.name + ': ' + key] = (100*centroid[ftrN][key]).toFixed();
							if (!dimInitialized) dim++;
						}
						break;
					}
					default: {
						throw new Error('Unknown feature type: ' + ftr.type);
					}
					}
				}
				backgroundData.push(row);
				dimInitialized = true;
			}
			
			for (var centroidN = 0; centroidN < centroids.length; centroidN++) {
				var centroid = centroids[centroidN];
				var row = {};
				for (var ftrN = 0; ftrN < centroid.length; ftrN++) {
					var ftr = ftrConfig[ftrN];
					
					switch (ftr.type) {
					case 'numeric': {
						row[ftr.name] = toUiPrecision(centroid[ftrN]);
						break;
					}
					case 'categorical': {
						for (var key in centroid[ftrN]) {
							row[ftr.name + ': ' + key] = (100*centroid[ftrN][key]).toFixed();
						}
						break;
					}
					default: {
						throw new Error('Unknown feature type: ' + ftr.type);
					}
					}
				}
				foregroundData.push(row);
			}
			
			var width = dim*minBinW;
			var fullWidthPadding = 5;
			
			if (width < wrapper.width() - fullWidthPadding) {
				$('#div-parallel').css('width', (wrapper.width() - fullWidthPadding) + 'px');
			} else {
				$('#div-parallel').css('width', width + 'px');
			}
			
			
			var parcoords = d3.parcoords(opts)("#div-parallel")
				.data(backgroundData)
			  	.render()
			  	.createAxes()
			  	.interactive();
			
			parcoords.highlight(foregroundData);
			
			parcoords.on("brush", function(d) {
			    d3.select("#grid")
			      .datum(d.slice(0,10))
			      .call(grid)
			      .selectAll(".row")
			      .on({
			        "mouseover": function(d) { parcoords.highlight([d]) },
			        "mouseout": parcoords.unhighlight
			      });
			  });
		}
		
		function visualizeTimeHist(opts) {
			if (opts.rotate == null) opts.rotate = 0;
			if (opts.xTicks == null) opts.xTicks = 10;
			if (opts.labelXOffsetPerc == null) opts.labelXOffsetPerc = 0;
			
			var data = opts.data;
			var container = opts.container;
			var formatX = opts.formatX;
			var rotate = opts.rotate;
						
			drawHistogram({
				data: data,
				container: container,
				showY: true,
				xTicks: opts.xTicks,
				formatX: formatX,
				rotateX: rotate,
				topPadding: 10,
				bottomPadding: opts.bottomPadding,
				labelXOffsetPerc: opts.labelXOffsetPerc,
				width: $('#tab-content-bottom').width(),
				height: $('#tab-content-bottom').height()
			});
		}
		
		function onZoomIntoState(stateId) {
			// get the sub model
			$.ajax('api/subModel', {
				dataType: 'json',
				method: 'GET',
				data: { stateId: stateId },
				success: function (model) {
					viz.setSubModel(model);
					$('#btn-viz-back').removeClass('hidden');
				},
				error: handleAjaxError()
			});
		}
		
		function showPath(stateId, height) {
			// get the sub model
			$.ajax('api/path', {
				dataType: 'json',
				method: 'GET',
				data: { stateId: stateId, height: height, length: 4, probThreshold: .2 },
				success: function (model) {
					viz.setSubModel(model);
					$('#btn-viz-back').removeClass('hidden');
				},
				error: handleAjaxError()
			});
		}
		
		function hideAdditionalVisPanels() {
			// hide the right panel
			$('#wrapper-transition-details').hide();
			$('#wrapper-state-details').hide();
			
			// hide the bottom panel
			$('#div-tree-container').html('');
			$('#div-parallel').html('');
			// time histograms
			$('#div-timehist-global').html('');
			$('#div-timehist-yearly').html('');
			$('#div-timehist-monthly').html('');
			$('#div-timehist-weekly').html('');
			$('#div-timehist-daily').html('');
		}
		
		(function () {
			var prevVal = 1;
			
			$("#threshold_slider").slider({
				value: prevVal,
				min: .5,
				max: 1,
				step: 0.01,
				animate:"slow",
				orientation: "hotizontal",
				change: function (event, ui) {
					var val = ui.value;
					if (val != prevVal) {
						prevVal = val;
						viz.setTransitionThreshold(val);
					}
				},
				slide: function (event, ui) {
					var val = ui.value;
					
					if (Math.abs(val - prevVal) > .15) {
						prevVal = val;
						viz.setTransitionThreshold(val);
					}
				},
			});
		})();
	
		$("#slider_item_div").slider({
			value: 0,//viz.getZoom(),
			min: 0,//viz.getMinZoom(),
			max: 100,//viz.getMaxZoom(),
			step: 1,//0.01,
			animate:"slow",
			orientation: "vertical",
			slide: function (event, ui) {
				viz.setScale(ui.value);
			}
		});
		
		$('#btns-timescale button').click(function () {
			$('#btns-timescale button').removeClass('active');
			$(this).addClass('active');
			$('.timehist').addClass('hidden');
			
			var btnId = $(this).attr('id');
			switch (btnId) {
			case 'btn-toggle-timehist-global':
				$('#div-timehist-global').removeClass('hidden');
				break;
			case 'btn-toggle-timehist-yearly':
				$('#div-timehist-yearly').removeClass('hidden');
				break;
			case 'btn-toggle-timehist-monthly':
				$('#div-timehist-monthly').removeClass('hidden');
				break;
			case 'btn-toggle-timehist-weekly':
				$('#div-timehist-weekly').removeClass('hidden');
				break;
			case 'btn-toggle-timehist-daily':
				$('#div-timehist-daily').removeClass('hidden');
				break;
			default:
				alert('Unknown button id: ' + btnId);
			}
		});
		
		(function () {
			addPressHandler($('#btn-font-increase'), function () {
				fontFactor += DELTA_FONT_FACTOR;
				viz.setFontFactor(fontFactor);
			});
			addPressHandler($('#btn-font-decrease'), function () {
				fontFactor -= DELTA_FONT_FACTOR;
				
				if (fontFactor < 0) fontFactor = 0;
				
				viz.setFontFactor(fontFactor);
			});
		})();
		
		$('#vis-toggler').click(function () {
			$('#content-options').slideToggle();
		});
		
		$('#btn-viz-back').click(function () {
			// fetch the whole model
			$.ajax('api/model', {
				dataType: 'json',
				method: 'GET',
				success: function (model) {
					viz.setSubModel(model);
					$('#btn-viz-back').addClass('hidden');
				},
				error: handleAjaxError()
			});
		});
		
		viz.onZoomChanged(function (zoom) {
			$("#slider_item_div").slider('value', zoom);
		});
		
		viz.onStateSelected(function (stateId, height) {
			hideAdditionalVisPanels();
			
			if ($('#chk-show-fut').is(':checked')) {
				$('#chk-show-fut').attr('checked', false);
				$('#chk-show-fut').change();
			}
			
			if (stateId == null) return;
			
			firstBottomVizTab.click();
			
			// fetch state details
			$.ajax('api/stateDetails', {
				dataType: 'json',
				data: { stateId: stateId, level: height },
				success: function (data) {
					$('#wrapper-state-details').show();
					
					var stateAutoNm = data.autoName;
					
					// clear the panel
					$('#txt-name').val(stateAutoNm);
					$('#txt-state-description').val('');
					$('#chk-target').removeAttr('checked');
					$('#txt-event-id').val('');
					$('#div-button-save-state').addClass('hidden');
					$('#div-attrs').html('');
					$('#div-future').html('');
					$('#div-past').html('');
					
					var ftrConfig = [];
					for (var i = 0; i < data.features.observations.length; i++) {
						var ftr = data.features.observations[i];
						ftrConfig.push({
							name: ftr.name,
							type: ftr.type
						});
					}
					for (var i = 0; i < data.features.controls.length; i++) {
						var ftr = data.features.controls[i];
						ftrConfig.push({
							name: ftr.name,
							type: ftr.type
						});
					}
					for (var i = 0; i < data.features.ignored.length; i++) {
						var ftr = data.features.ignored[i];
						ftrConfig.push({
							name: ftr.name,
							type: ftr.type
						});
					}

					visualizeDecisionTree(data.classifyTree);
					visualizeParcoords(data.centroids, data.allCentroids, ftrConfig);
					visualizeTimeHist({
						data: data.timeHistogram,
						container: 'div-timehist-global',
						formatX: function (d) {
							return formatDateTime(new Date(d));
						},
						rotate: -10,
						bottomPadding: 40
					});
					visualizeTimeHist({
						data: data.yearHistogram,
						container: 'div-timehist-yearly',
						formatX: function (monthN) {
							return MONTHS[monthN-1];
						},
						xTicks: 12,
						labelXOffsetPerc: .5
					});
					visualizeTimeHist({
						data: data.monthHistogram,
						container: 'div-timehist-monthly',
						xTicks: 31,
						labelXOffsetPerc: .5
					});
					visualizeTimeHist({
						data: data.weekHistogram,
						container: 'div-timehist-weekly',
						formatX: function (dayN) {
							return DAYS_OF_WEEK[dayN];
						},
						xTicks: 7,
						labelXOffsetPerc: .5
					});
					visualizeTimeHist({
						data: data.dayHistogram,
						container: 'div-timehist-daily',
						xTicks: 24,
						labelXOffsetPerc: .5
					});
					
					
					// populate
					// basic info
					$('#txt-name').off('keyup');
					if (data.name != null) $('#txt-name').val(data.name);
					$('#txt-name').keyup(function () {
						$('#div-button-save-state').removeClass('hidden');
					});
					
					$('#txt-state-description').off('keyup');
					if (data.description != null) $('#txt-state-description').val(data.description);
					$('#txt-state-description').keyup(function () {
						$('#div-button-save-state').removeClass('hidden');
					});
					
					$('#chk-target').off('change');	// remove the previous handlers
					$('#chk-target').prop('checked', data.isTarget != null && data.isTarget);
					if (data.isTarget != null && data.isTarget) {
						$('#div-event-id').removeClass('hidden');
					} else {
						$('#div-event-id').addClass('hidden');
					}
					
					$('#chk-target').change(function (event) {
						$('#div-button-save-state').removeClass('hidden');
						
						var isUndesiredEvent = $('#chk-target').is(':checked');

						if (isUndesiredEvent) {
							$('#div-event-id').removeClass('hidden');
						} else {
							$('#div-event-id').addClass('hidden');
						}
					});
										
					// features
					// feature weights
					var ftrWgts = data.featureWeights;
					// find max and min weigts
					var maxWgt = Number.NEGATIVE_INFINITY;
					var minWgt = Number.POSITIVE_INFINITY;
					
					for (var ftrId = 0; ftrId < ftrWgts.length; ftrId++) {
						if (isNaN(ftrWgts[ftrId])) {
							for (var key in ftrWgts[ftrId]) {
								var wgt = ftrWgts[ftrId][key];
								
								if (wgt > maxWgt) maxWgt = wgt;
								if (wgt < minWgt) minWgt = wgt;
							}
						} else {
							if (ftrWgts[ftrId] > maxWgt) maxWgt = ftrWgts[ftrId];
							if (ftrWgts[ftrId] < minWgt) minWgt = ftrWgts[ftrId];
						}
					}
					
					function getWeightColor(ftr, wgtV, minWgt, maxWgt) {
						var type = ftr.type;
						
						switch (type) {
						case 'numeric': {
							return getFtrColor(wgtV, minWgt, maxWgt);
							break;
						}
						case 'categorical': {
							var colorObj = {};
							for (var key in wgtV) {
								colorObj[key] = getFtrColor(wgtV[key], minWgt, maxWgt);
							}
							return colorObj;
							break;
						}
						default: {
							throw new Error('Invalid feature type: ' + type);
						}
						}
					}
					
					// fetch histograms
					$.each(data.features.observations, function (idx, val) {
						var histContainerId = 'container-chart-' + idx;
						var ftrId = idx;
						
						var color = getWeightColor(val, ftrWgts[ftrId], minWgt, maxWgt);
									
						var thumbnail = ui.createThumbnail({
							name: val.name,
							type: val.type,
							value: val.value,
							valueColor: color,
							histogramContainer: histContainerId
						});
						$('#div-attrs').append(thumbnail);
						ui.fetchHistogram(stateId, ftrId, false, histContainerId, false);
					});
					
					var nObsFtrs = data.features.observations.length;
					
					$.each(data.features.controls, function (idx, val) {
						var ftrVal = val.value;
						var bounds = val.bounds;
						var ftrId = nObsFtrs + idx;
						var histContainerId = 'container-chart-' + (nObsFtrs + idx);
						
						var color = getWeightColor(val, ftrWgts[ftrId], minWgt, maxWgt);
												
						var thumbnail = ui.createThumbnail({
							name: val.name,
							type: val.type,
							value: ftrVal,
							histogramContainer: histContainerId,
							valueColor: color,
							isLeaf: data.isLeaf,
							ftrId: ftrId,
							min: bounds.min,
							max: bounds.max,
							stateId: stateId
						});
						
						$('#div-attrs').append(thumbnail);
						
						ui.fetchHistogram(stateId, nObsFtrs + idx, false, 'container-chart-' + (nObsFtrs + idx), false);
					});
					
					var nContrFtrs = data.features.controls.length;
					
					$.each(data.features.ignored, function (idx, val) {
						var ftrId = nObsFtrs + nContrFtrs + idx;
						var ftrVal = val.value;
						var bounds = val.bounds;
						var ftrId = nObsFtrs + nContrFtrs + idx;
						var histContainerId = 'container-chart-' + ftrId;
						
						var color = getWeightColor(val, ftrWgts[ftrId], minWgt, maxWgt);
												
						var thumbnail = ui.createThumbnail({
							name: val.name,
							type: val.type,
							value: ftrVal,
							histogramContainer: histContainerId,
							valueColor: color
						});
						
						$('#div-attrs').append(thumbnail);
						
						ui.fetchHistogram(stateId, ftrId, false, 'container-chart-' + ftrId, false);
					});
										
					// add handlers
					$('#txt-event-id').off('change');
					
					if (data.undesiredEventId != null) { $('#txt-event-id').val(data.undesiredEventId); }
					
					$('#txt-event-id').change(function () {
						$('#div-button-save-state').removeClass('hidden');
					});
					
					$('#btn-button-save-state').off('click');
					$('#btn-button-save-state').click(function () {
						var stateName = $('#txt-name').val();
						var description = $('#txt-state-description').val();
						var isUndesired = $('#chk-target').is(':checked');
						var eventId = $('#txt-event-id').val();
						
						var data = {
							id: stateId,
							name: stateName,
							description: description,
							isUndesired: isUndesired
						};
						
						if (isUndesired && eventId != null && eventId != '') {
							data.eventId = eventId;
						}
						
						var shouldClearName = stateName == '' || stateName == stateId;
						if (shouldClearName) {	// clear the state name
							delete data.name;
						}
						if (description == null || description == '') {
							delete data.description;
						}
						
						$.ajax('api/stateProperties', {
							dataType: 'json',
						    type: 'POST',
						    data: data,
						    success: function () {
						    	viz.setStateName(stateId, shouldClearName ? stateAutoNm : stateName);
						    	viz.setTargetState(stateId, isUndesired);
						    	
						    	if (shouldClearName)
						    		$('#txt-name').val(stateAutoNm);
						    	
						    	$('#div-button-save-state').addClass('hidden');
						    	showAlert($('#alert-holder'), $('#alert-wrapper-save-state'), 'alert-success', 'Saved!', null, true);
						    },
						    error: handleAjaxError($('#alert-wrapper-save-state'))
						});
					});
				},
				error: handleAjaxError()
			});
		});
		
		viz.onEdgeSelected(function (sourceId, targetId) {
			//reset the values
			$('#div-trans-ftrs').html('');
			
			$('#span-trans-source').html(sourceId);
			$('#span-trans-target').html(targetId);
			
			var ftrV = getFeatureInfo();
			
			for (var ftrN = 0; ftrN < ftrV.length; ftrN++) {
				var ftr = ftrV[ftrN];
				var ftrId = ftr.id;
				var ftrNm = ftr.name;
				var containerId = 'container-transition-hist-' + ftrId;
				
				$('#div-trans-ftrs').append(ui.createThumbnail({
					name: ftrNm,
					type: ftr.type,
					value: null,
					valueColor: null,
					histogramContainer: containerId
				}));
				
				ui.fetchTransitionHistogram(sourceId, targetId, ftrId, containerId);
			}
			
			$('#wrapper-state-details').hide();
			$('#wrapper-transition-details').show();
		});
		
		viz.onHeightChanged(function (scale) {
			$('#span-zoom-val').html(scale.toFixed());
			$("#slider_item_div").slider('value', scale);
			if ($('#chk-show-fut').is(':checked')) {
				$('#chk-show-fut').attr('checked', false);
				$('#chk-show-fut').change();
			}
		});
		
		viz.onStateCtxMenu(function (id, label, level, height) {
			var result = [
			    {
					content: 'Show Path',
					select: function (node) {
						showPath(id, height);
					}
				}          
			];
			
			if (level > 1) {
				result.push({
					content: 'Zoom Into',
					select: function (node) {
						onZoomIntoState(id);
					}
				});
			}
			
			if (TAB_ID == 'a-activities') {
				result.push({
					content: 'Add to Step',
					select: function (node) {
						act.addActivityState(id, label);
					}
				});
			}
			
			return result;
		});
	})();
	
	//=======================================================
	// ACTIVITY RECOGNITION
	//=======================================================
	
	(function () {
		var ACTIVITY_COLORS = ['blue', 'red', 'green', 'yellow', 'magenta', 'cyan', 'brown', 'Wheat', 'DeepPink', 'CadetBlue'];
		
		var currStep = {};
		var currStepN = 0;
		var currStepSize = 0;
		
		var alertField = $('#alert-wrapper-activity');
		
		function getStepColor() {
			return ACTIVITY_COLORS[currStepN % ACTIVITY_COLORS.length];
		}
		
		function onRemoveBtnClick() {
			var tr = $(this).parent().parent().parent();
			var txt = tr.find('.td-name').html();
			var name = txt.replace(/\s\([0-9]*\)$/, '');
			
			promptConfirm('Remove Activity', 'Are you sure you wish remove activity ' + name + '?', function () {
				$.ajax('api/removeActivity', {
					dataType: 'json',
				    type: 'POST',
				    data: { name: name },
				    success: function () {
				    	tr.remove();
				    	showAlert($('#alert-holder'), alertField, 'alert-success', 'Removed!', null, true);
				    },
				    error: handleAjaxError(alertField)
				});
			});
		}
		
		$('#btn-activity-add-step').click(function () {
			var currThumb = $('#div-curr-activity-step');
			var newThumb = currThumb.clone(true);
			
			currThumb.removeAttr('id');
			newThumb.find('.thumbnail').html('');
			
			$('#div-activity-currconf').append(newThumb);
			
			currStep = {};
			currStepN++;
			currStepSize = 0;
			newThumb.find('.thumbnail').css('background-color', getStepColor());
		});
		
		$('#btn-activity-cancel').click(function () {
			var currThumb = $('#div-curr-activity-step').clone(true);
			
			$('#div-activity-currconf').html('');
			$('#div-activity-currconf').append(currThumb);
			
			currStep = {};
			currStepN = 0;
			currStepSize = 0;
		});
		
		$('#btn-activity-save').click(function () {
			// get the activity
			var name = $('#txt-activity-name').val();
			var sequence = [];
			
			if (name == null || name == '') {
				showAlert($('#alert-holder'), alertField, 'alert-warning', 'Missing activity name!', null, false);
				return;
			}
			
			$.each($('#div-activity-currconf .step-wrapper'), function (i, div) {
				var stateIds = [];
				
				var thumbnail = $(div).find('.thumbnail');
				$.each(thumbnail.find('span'), function (j, span) {
					var spanId = $(span).attr('id');
					var stateId = spanId.split('-')[2];
					stateIds.push(parseInt(stateId));
				});
				
				sequence.push(stateIds);
			});
			
			var data = {
				name: name,
				sequence: JSON.stringify(sequence)
			};
			
			$.ajax('api/activity', {
				dataType: 'json',
			    type: 'POST',
			    data: data,
			    success: function () {
			    	// add the activity to the table
			    	var tr = $('<tr><td class="td-name">' + name + ' (' + sequence.length + ')</td></tr>');
			    	var btnCell = $('<td class="td-btns" />');
			    	var btnSpan = $('<span class="pull-right span-btns" />');
			    	var btn = $('<button class="btn btn-danger btn-xs btn-remove" aria-label="Left Align"><span class="glyphicon glyphicon-remove"></span> Remove</button>');
			    	
			    	btn.click(onRemoveBtnClick);
			    	
			    	btnSpan.append(btn);
			    	btnCell.append(btnSpan);
			    	tr.append(btnCell);
			    	$('#table-activities').find('tbody').append(tr);
			    	
			    	// clear the structures
			    	$('#btn-activity-cancel').click();
			    	// clear the colors
			    	$('#div-curr-activity-step').find('.thumbnail').css('background-color', getStepColor());
			    	viz.clearNodeColors();
			    	// show success
			    	showAlert($('#alert-holder'), alertField, 'alert-success', 'Saved!', null, true);
			    },
			    error: handleAjaxError(alertField)
			});
		});

		$('#table-activities').find('.btn-remove').click(onRemoveBtnClick);
		
		act =  {
			addActivityState: function (stateId, label, name) {
				if (stateId in currStep) {
					showAlert($('#alert-holder'), alertField, 'alert-warning', 'State already in the current step!', null, true);
					return;
				}
				
				var stateStr = name != null ? name : label;
				
				$('#div-curr-activity-step').find('.thumbnail').append((currStepSize > 0 ? ', ' : '') + '<span id="step-' + currStepN + '-' + stateId + '" style="display: none;">' + stateStr + '</span>');
				
				// set the background in the visualization
				viz.setNodeColor(stateId, getStepColor());
				
				// update the structures
				currStep[stateId] = true;
				currStepSize++;
			}
		}
		
		$('#div-curr-activity-step').find('.thumbnail').css('background-color', getStepColor());
	})();
	
	$(document).ready(function () {
		firstBottomVizTab = $('#tabs-viz-bottom').find('a')[0];
		
		$('#div-msg-0, #div-msg-1').alert();
		
		$('.nav-pills a').click(function () {
			TAB_ID = $(this).attr('id');
			
			if (TAB_ID == 'a-default') {
				$('#tabs-viz-bottom').find('a')[0].click();
				viz.resetMode();
				// TODO fetch the histograms
				// TODO reload the decision tree
			}
			else if (TAB_ID = 'a-activities') {
				viz.setMode(viz.MODE_ACTIVITY);
			}
		});
		
		$('#tabs-viz-bottom a').click(function () {
			var tabId = $(this).attr('id');
			
			if (tabId == 'a-timehist') {
				$('#btns-timescale button')[0].click();
			}
			
			if (tabId == 'a-parcoords') {
				$('#div-parallel-container').removeClass('hidden');
			}
			else {
				$('#div-parallel-container').addClass('hidden');
			}
		});
		
		$('.nav-pills a')[0].click()
		
		firstBottomVizTab.click();
	});
})()
