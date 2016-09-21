function getContainerFromTable(table) {
	return table.parent().parent().parent().parent().parent().parent();
}

function getModelIdFromTr(tr) {
	return tr.attr('id').split('-')[1];
}

function getTrFromBtn(btn) {
	return btn.parent().parent().parent();
}

function getModelNameFromTr(tr) {
	return tr.find('.td-model-name').html();
}

function getModelIdFromBtn(btn) {
	var tr = getTrFromBtn(btn);
	return getModelIdFromTr(tr);
}

function fetchModelDetails(mid) {
	$.ajax('api/modelDetails', {
		dataType: 'json',
		method: 'GET',
		data: { modelId: mid },
		success: function (data) {
			$('#div-model-details-btns').addClass('hidden');
			
			$('#div-model-name').html(data.name);
			$('#span-creator').html(data.creator);
			$('#span-creation-date').html(formatDateTime(new Date(data.creationDate)));
			$('#span-dataset').html(data.dataset);
			
			if (data.isOnline) {
				$('#span-online-offline').addClass('green');
				$('#span-online-offline').html('online');
				
				if (data.isActive) {
					$('#span-model-active-public').removeClass('red');
					$('#span-model-active-public').addClass('green');
					$('#span-model-active-public').html('active');
				} else {
					$('#span-model-active-public').removeClass('green');
					$('#span-model-active-public').addClass('red');
					$('#span-model-active-public').html('inactive');
				}
			} else {
				$('#span-online-offline').removeClass('green');
				$('#span-online-offline').html('offline');
				
				$('#span-model-active-public').removeClass('red');
				$('#span-model-active-public').removeClass('green');
				
				if (data.isPublic) {
					$('#span-model-active-public').html('public');
				} else {
					$('#span-model-active-public').html('private');
				}
			}
			
			$('#input-model-details-desc').val(data.description);
			if (data.isOwner) {
				$('#input-model-details-desc').removeAttr('disabled');
			} else {
				$('#input-model-details-desc').attr('disabled', 'disabled');
			}
			
			$('#div-model-details').removeClass('hidden');
		},
		error: handleAjaxError()
	});
}

function selectRow(tr) {
	$('#table-models-active tbody tr,#table-models-inactive tbody tr,#table-models-offline tbody tr,#table-models-public tbody tr').removeClass('success');
	tr.addClass('success');
}

function fetchDetails() {
	var tr = $(this);
	var mid = getModelIdFromTr(tr);
	fetchModelDetails(mid);
}

function onFetchDetails(event) {
	selectRow($(this));
	
	if (event.which == 1 || event.which == 3) {	// left or right button
		fetchDetails.call(this, event);
	}
}

function removeModel(mid, tr) {
	var name = tr != null ? getModelNameFromTr(tr) : mid;
	
	$.ajax('api/removeModel', {
		method: 'POST',
		dataType: 'json',
		data: { modelId: mid },
		success: function (data, status, xhr) {
			if (tr != null)
				tr.remove();
			showAlert($('#alert-holder'), $('#alert-wrapper-model-details'), 'alert-success', 'Model ' + name + ' removed!', null, true);
		},
		error: handleAjaxError()
	});
}

function viewModel(mid) {
	$.ajax('api/selectDataset', {
		method: 'POST',
		contentType: 'application/json',
		data: JSON.stringify({ modelId: mid }),
		success: function (data, status, xhr) {
			redirectToUI();
		},
		error: handleAjaxError()
	});
}

function onViewModel() {
	var btn = $(this);
	var mid = getModelIdFromBtn(btn);
	
	viewModel(mid);
	
	return false;
}

function activate() {
	var btn = $(this);
	var tr = getTrFromBtn(btn);
	var mid = getModelIdFromTr(tr);
	var name = getModelNameFromTr(tr);
	
	promptConfirm('Activate Model', 'Are you sure you wish to activate model ' + name + '?', function () {
		$.ajax('api/activateModel', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ modelId: mid, activate: true }),
			success: function (data, status, xhr) {
				tr.parent().remove(tr.attr('id'));
				$('#table-models-active').find('tbody').append(tr);
				
				tr.attr('id', 'active-' + mid);
				var newBtn = $('<button class="btn btn-danger btn-xs btn-deactivate" aria-label="Left Align"><span class="glyphicon glyphicon-off"></span> Deactivate</button>');
				var oldBtn = tr.find('.btn-activate');
				
				tr.find('.btn-activate').remove();
				tr.find('.span-btns').prepend(newBtn)
				
				newBtn.click(deactivate);
				
				if (tr.hasClass('success'))
					fetchModelDetails(mid);
				if (oldBtn.hasClass('tbl-btn-offset'))
					newBtn.addClass('tbl-btn-offset');
			},
			error: handleAjaxError()
		});
	});
	
	return false;
}

function deactivate() {
	var btn = $(this);
	var tr = getTrFromBtn(btn);
	var mid = getModelIdFromTr(tr);
	var name = getModelNameFromTr(tr);
	
	promptConfirm('Deactivate Model', 'Are you sure you wish to deactivate model ' + name + '?', function () {
		$.ajax('api/activateModel', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ modelId: mid, activate: false }),
			success: function (data, status, xhr) {
				tr.parent().remove(tr.attr('id'));
				$('#table-models-inactive').find('tbody').append(tr);
				
				var newBtn = $('<button class="btn btn-success btn-xs btn-activate" aria-label="Left Align"><span class="glyphicon glyphicon-off"></span> Activate</button>');
				var oldBtn = tr.find('.btn-deactivate');
				
				tr.find('.btn-deactivate').remove();
				tr.find('.span-btns').prepend(newBtn);
				
				newBtn.click(activate);
				
				if (tr.hasClass('success'))
					fetchModelDetails(mid);
				if (oldBtn.hasClass('tbl-btn-offset'))
					newBtn.addClass('tbl-btn-offset');
			},
			error: handleAjaxError()
		});
	});
	
	return false;
}

function share() {
	var btn = $(this);
	var tr = getTrFromBtn(btn);
	var mid = getModelIdFromTr(tr);
	var name = getModelNameFromTr(tr);
	
	promptConfirm('Share Model', 'Are you sure you wish to share model ' + name + '?', function () {
		$.ajax('api/shareModel', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ modelId: mid, share: true }),
			success: function (data, status, xhr) {
				tr.parent().remove(tr.attr('id'));
				$('#table-models-public').find('tbody').append(tr);
				
				var newBtn = $('<button class="btn btn-warning btn-xs btn-unshare" aria-label="Left Align"><span class="glyphicon glyphicon-globe"></span> Unshare</button>');
				var oldBtn = tr.find('.btn-share');
				
				tr.find('.btn-share').remove();
				tr.find('.span-btns').prepend(newBtn);
				
				newBtn.click(unshare);
				
				if (tr.hasClass('success'))
					fetchModelDetails(mid);
				if (oldBtn.hasClass('tbl-btn-offset'))
					newBtn.addClass('tbl-btn-offset');
			},
			error: handleAjaxError()
		});
	});
	
	return false;
}

function unshare() {
	var btn = $(this);
	var tr = getTrFromBtn(btn);
	var mid = getModelIdFromTr(tr);
	var name = getModelNameFromTr(tr);
	
	promptConfirm('Unshare Model', 'Are you sure you wish to unshare model ' + name + '?', function () {
		$.ajax('api/shareModel', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ modelId: mid, share: false }),
			success: function (data, status, xhr) {
				tr.parent().remove(tr.attr('id'));
				$('#table-models-offline').find('tbody').append(tr);
				
				var newBtn = $('<button class="btn btn-default btn-xs btn-share" aria-label="Left Align"><span class="glyphicon glyphicon-globe"></span> Share</button>');
				var oldBtn = tr.find('.btn-unshare');
				
				tr.find('.btn-unshare').remove();
				tr.find('.span-btns').prepend(newBtn);
				
				newBtn.click(share);
				
				if (tr.hasClass('success'))
					fetchModelDetails(mid);
				if (oldBtn.hasClass('tbl-btn-offset'))
					newBtn.addClass('tbl-btn-offset');
			},
			error: handleAjaxError()
		});
	});
	
	return false;
}

function pingProgress(isRealTime) {
	console.log('Pinging for model progress ...');
	
	$.ajax('api/pingProgress', {
		method: 'GET',
		contentType: 'application/json',
		success: function (data, status, xhr) {
			console.log('Got ping result!');
			
			if (xhr.status == 204) {	// no content
                console.log('Received no content, re-pinging ...');
				pingProgress(isRealTime);
				return;
			}
			
			$('#progress-build-model').css('width', data.progress + '%');
			$('#progress-build-model').html(data.message);
			
			if (data.isFinished) {
				$('#btn-add-online,#btn-add-offline').removeAttr('disabled', 'disabled');
			}
			
			if (data.error != null) {
                console.log('Received result with error! Highlighting ...');
				$('#progress-build-model').css('background-color', 'red');
			} else {
				if (!data.isFinished) {
                    console.log('Received data, but hasn\'t yet finished, re-pinging ...');
					pingProgress(isRealTime);
				} else {	// finished
					console.log('Finished building the model!');
					
					var mid = data.mid;
					
					// fetch the new model
					$.ajax('api/modelDetails', {
						dataType: 'json',
						method: 'GET',
						data: { modelId: mid },
						success: function (data) {
							var table = isRealTime ? $('#table-models-active') : $('#table-models-offline');
							
							var tr = $('<tr />');
							tr.attr('id', (isRealTime ? 'active-' : 'offline-') + data.mid);
							tr.addClass('ui-sortable-handle');
							tr.mousedown(onFetchDetails);
							
							var nameTd = $('<td />');
							var dateTd = $('<td />');
							var buttonsTd = $('<td />');
							
							nameTd.addClass('td-model-name');
							nameTd.html(data.name);
							
							dateTd.addClass('td-model-date');
							dateTd.html(formatDate(new Date(data.creationDate)));
							
							buttonsTd.addClass('td-btns');
														
							tr.append(nameTd);
							tr.append(dateTd);
							tr.append(buttonsTd);
							
							// initialize the buttons
							var buttonSpan = $('<span class="pull-right span-btns" />');
							
							var btnView = $('<button class="btn btn-info btn-xs btn-view" aria-label="Left Align"><span class="glyphicon glyphicon-eye-open"></span> View</button>');
							btnView.click(onViewModel);
							
							buttonSpan.append(btnView);
							buttonsTd.append(buttonSpan);
							
							if (isRealTime) {
								var deactivateBtn = $('<button class="btn btn-danger btn-xs btn-deactivate tbl-btn-offset" aria-label="Left Align"><span class="glyphicon glyphicon-off"></span> Deactivate</button>');
								deactivateBtn.click(deactivate);
								buttonSpan.prepend(deactivateBtn);
							} else {
								var shareBtn = $('<button class="btn btn-default btn-xs btn-share tbl-btn-offset" aria-label="Left Align" style="margin-right: 4px;"><span class="glyphicon glyphicon-globe"></span> Share</button>');
								shareBtn.click(share);
								buttonSpan.prepend(shareBtn);
							}
							
							table.find('tbody').append(tr);
							
							console.log('Setting closing timeout ...');
							setTimeout(function () {
								console.log('Closing ...');
								$('#div-model-progress').addClass('hidden');
								$('#progress-build-model').css('width', '0%');
							}, 5000);
						},
						error: handleAjaxError()
					});
				}
			}
		},
		error: handleAjaxError(null, function () {
			$('#div-model-progress').addClass('hidden');
		})
	});
}

(function () {
	var newModelPopup = $('#popup-data-upload');
	
	//========================================================
	// ADDING A NEW MODEL
	//========================================================
	
	function checkConfigureDataset() {
		var isOK = true;
		
		var radio = $('#radio-time');
		var timeVal = radio.find('input:radio').val();
		
		// check if all the values are there
		var hasTimeAttr = timeVal != null && timeVal != '';
		var hasData = $('#input-choose-upload').val() != '';
		var hasName = $('#input-model-name').val() != '';
		var clustAlg = $('#select-clust').val();
		
		if (!hasTimeAttr || !hasData || !hasName)
			isOK = false;
		
		if (clustAlg == null || clustAlg == '')
			isOK = false;
		
		if (clustAlg == 'kmeans') {
			// check K
			var k = $('#input-kmeans-k').val();
			if (!isInt(k)) isOK = false;
		} else if (clustAlg == 'dpmeans') {
			// check lambda and min, max
			var minStates = $('#input-dpmeans-minstates').val();
			var maxStates = $('#input-dpmeans-maxstates').val();
			var lambda = $('#input-dpmeans-lambda').val();
			
			if (minStates != null && minStates != '' && isNaN(minStates)) isOk = false;
			if (maxStates != null && maxStates != '' && isNaN(maxStates)) isOk = false;
			if (isNaN(lambda)) isOk = false;
		}
		
		if (isOK)
			$('#btn-done').removeAttr('disabled');
		else
			$('#btn-done').attr('disabled', 'disabled');
		
		return isOK;
	}

	$('#input-model-name').keyup(checkConfigureDataset);
	
	$('#input-choose-upload').change(function () {
		$('#form-phase2').hide(0);
		$('#form-phase3').hide(0);
		$('#form-phase4').hide(0);

		var hasData = $('#input-choose-upload').val() != '';
		
		if (!hasData) return;

		console.log('Uploading the file ...');
		
		var form = $('#form-upload');
		var formData = new FormData(form[0]);
		
		var action = form.attr('action');
		var enctype = form.attr('enctype');
		var method = form.attr('method');

		$('#progress-file-upload').css('width', '0%');
		$('#progress-file-upload').html('0%');
		
		$('#chk-include-time-ftrv').prop('checked', true);
		
		console.log('Uploading file:');
		console.log('Enctype: ' + enctype);
		console.log('Method: ' + method);

		$.ajax(action, {
			contentType: false,
			enctype: enctype,
			data: formData,
			method: method,
			processData: false,
			xhr: function () {
				var myXhr = $.ajaxSettings.xhr();
				if (myXhr.upload) { // Check if upload property exists
	                myXhr.upload.addEventListener('progress', function (event) {
	                	if (event.lengthComputable) {
	                		var prog = (100*(event.loaded / event.total)).toFixed(0);
	                		$('#progress-file-upload').css('width', prog + '%');
							$('#progress-file-upload').html(prog + '%');
	                		console.log('progress: ' + prog);
	                	}
	                }, false); // For handling the progress of the upload
	            }
	            return myXhr;
			},
			success: function (data, status, xhr) {
				var fields = data.headers;
				var guessedTypes = {};
				
				for (var i = 0; i < data.types.length; i++) {
					guessedTypes[fields[i].name] = data.types[i];
				}
				
				var select = $('#select-attrs');
					
				// clear the attributes
				select.html('');
				for (var i = 0; i < fields.length; i++) {
					var attr = fields[i].name;												
					select.append('<option value="' + attr.replace(/\"/g, '&quot;') + '">' + attr + '</option>');
				}
				
				select.bootstrapDualListbox({
					showFilterInputs: true,
					selectedListLabel: 'Selected Attributes',
					nonSelectedListLabel: 'Ignored Attributes'
				});
				select.bootstrapDualListbox('refresh');
			
				select.change(function () {
					$('#form-phase3').hide(0);
					$('#form-phase4').hide(0);
				
					var selectedAttrs = select.val();
					
					if (selectedAttrs == null) return;
					
					// set the time radio selector
					var timeRadio = $('#radio-time');
					timeRadio.html('');	// clear the element
					
					for (var i = 0; i < selectedAttrs.length; i++) {
						var div = $('<div class="radio" />') 
						var label = $('<label />');
						var input = $('<input />');
						
						input.attr('type', 'radio');
						input.attr('name', 'attr-time');
						input.val(selectedAttrs[i]);
						
						label.append(input);
						label.append(selectedAttrs[i]);
						div.append(label);
						timeRadio.append(div);
					}
					
					timeRadio.find('input:radio').change(function () {
						var timeAttr = $(this).val();
						var selectControls = $('#select-controls');
						var selectIgnored = $('#select-ignored');
												
						// clear the attributes
						selectControls.html('');
						selectIgnored.html('');
						for (var i = 0; i < selectedAttrs.length; i++) {
							var attr = selectedAttrs[i];
							if (attr != timeAttr) {
								selectControls.append('<option value="' + attr.replace(/\"/g, '&quot;') + '">' + attr + '</option>');
								selectIgnored.append('<option value="' + attr.replace(/\"/g, '&quot;') + '">' + attr + '</option>');
							}
						}
						
						// populate the attribute type section
						var typeDiv = $('#div-select-attr-types');
						typeDiv.html('');
						for (var i = 0; i < selectedAttrs.length; i++) {
							var attr = selectedAttrs[i];
							var type = guessedTypes[attr];
							
							if (attr == timeAttr) continue;
							
							var div = $('<div style="height: 27px;" />');
							var inputSpan = $('<span class="pull-right" style="clear: both;" />');
							
							var numLabel = $('<label>Numeric: </label>');
							var nomLabel = $('<label>Categorical: </label>');
							var inputNum = $('<input type="radio" value="numeric" />');
							var inputNom = $('<input type="radio" value="nominal" />');
							
							inputNum.attr('id', 'radio-type-num-' + i);
							inputNom.attr('id', 'radio-type-cat-' + i);
							inputNum.attr('name', 'radio-type-' + i);
							inputNom.attr('name', 'radio-type-' + i);
							
							numLabel.attr('for', 'radio-type-num-' + i);
							nomLabel.attr('for', 'radio-type-cat-' + i);
							
							if (type == 'numeric') {
								inputNum.attr('checked', 'checked');
							} else if (type == 'categorical') {
								inputNom.attr('checked', 'checked');
							}
							
							inputSpan.append(numLabel);
							inputSpan.append(inputNum);
							inputSpan.append('&nbsp;');
							inputSpan.append(nomLabel);
							inputSpan.append(inputNom);
							
							div.html(attr);
							div.append(inputSpan);
							
							typeDiv.append(div);
						}
						
						selectControls.bootstrapDualListbox({
							showFilterInputs: false,
							nonSelectedListLabel: 'State Attributes',
							selectedListLabel: 'Transition Atrtibutes'
						});
						selectIgnored.bootstrapDualListbox({
							showFilterInputs: false,
							nonSelectedListLabel: 'State Attributes',
							selectedListLabel: 'Ignored Atrtibutes'
						});
						selectControls.change(function () {
							var controlV = selectControls.val();
							
							var controlH = {};
							
							for (var i = 0; i < controlV.length; i++) {
								controlH[controlV[i]] = true;
							}
							
							for (var attrN = 0; attrN < selectedAttrs.length; attrN++) {
								var attr = selectedAttrs[attrN];
								
								if (attr in controlH) {
									selectIgnored.remove(attr);
								}
							}
							selectIgnored.bootstrapDualListbox('refresh');
						});
						selectIgnored.change(function () {
							var ignoredV = selectIgnored.val();
							for (var i = 0; i < ignoredV.length; i++) {
								var ignored = ignoredV[i];
								selectControls.remove('option[value="' + ignored.replace(/\"/g, '&quot;') + '"]');	// TODO
							}
							selectControls.bootstrapDualListbox('refresh');
						});
						selectControls.bootstrapDualListbox('refresh');
						selectIgnored.bootstrapDualListbox('refresh');
						
						// show the attribute selection
						$('#form-phase4').show();
					});
					
					timeRadio.find('input:radio').change(checkConfigureDataset);
					
					$('#form-phase3').show(0);
				});
				
				$('#form-phase2').show();
			},
			error: handleAjaxError()
		});
	});
	
	$('#select-clust').change(function () {
		var val = $(this).val();
		
		if (val != 'kmeans') $('#div-config-kmeans').addClass('hidden');
		if (val != 'dpmeans') $('#div-config-dpmeans').addClass('hidden');
		
		if (val == 'kmeans') $('#div-config-kmeans').removeClass('hidden');
		if (val == 'dpmeans') $('#div-config-dpmeans').removeClass('hidden');
	});
	
	$('#btn-done').click(function () {
		var btn = $(this);
		
		if (!checkConfigureDataset()) return;
		
		$('#progress-build-model').css('background-color', '');
		$('#progress-build-model-wrapper').show(0);
	
		var attrs = $('#select-attrs').val();
		var timeAttr = $('#radio-time').find('input:checked').val();
		var useTimeFtrV = $('#chk-include-time-ftrv').is(':checked');
		var controlAttrs = $('#select-controls').val();
		var ignoredAttrs = $('#select-ignored').val();
		var isRealTime = $('#check-realtime').is(':checked');
		var clustAlg = $('#select-clust').val();
		var hierarchyType = $('#select-hierarchy').val();
		var name = $('#input-model-name').val();
		var desc = $('#input-model-desc').val();
		
		if (controlAttrs == null) controlAttrs = [];
		if (ignoredAttrs == null) ignoredAttrs = [];
		
		var typeH = {};
		for (var i = 0; i < attrs.length; i++) {
			var attr = attrs[i];
			typeH[attr] = 'time';
		}
		
		var typeDiv = $('#div-select-attr-types');
		$.each(typeDiv.children('div'), function (i, divEl) {
			var div = $(divEl);
			$('input[name=radio-type-4]:checked')
			var checked = div.find('input[type=radio]:checked');
			
			var idx = checked.attr('id').split('-')[3];
			var attr = attrs[idx];
			var type = checked.val();
			typeH[attr] = type;
		});
		
		for (var i = 0; i < attrs.length; i++) {
			attrs[i] = {
				name: attrs[i].replace('&quot;', '"'),
				type: typeH[attrs[i]]
			}
		}
		
		for (var i = 0; i < controlAttrs.length; i++) {
			controlAttrs[i] = {
				name: controlAttrs[i].replace('&quot;', '"'),
				type: typeH[controlAttrs[i]]
			}
		}
		
		for (var i = 0; i < ignoredAttrs.length; i++) {
			ignoredAttrs[i] = {
				name: ignoredAttrs[i].replace('&quot;', '"'),
				type: typeH[ignoredAttrs[i]]
			}
		}
		
		var data = {
			username: $('#input-email').val(),
			time: timeAttr,
			timeUnit: $('#select-tu').val(),
			attrs: attrs,
			controlAttrs: controlAttrs,
			ignoredAttrs: ignoredAttrs,
			hierarchyType: hierarchyType,
			isRealTime: isRealTime,
			name: name,
			description: desc
		}
		
		if (clustAlg == 'kmeans') {
			data.clust = {
				type: clustAlg,
				k: parseInt($('#input-kmeans-k').val()),
				includeTimeFeatures: useTimeFtrV,
			}
		} else if (clustAlg == 'dpmeans') {
			data.clust = {
				type: clustAlg,
				lambda: parseFloat($('#input-dpmeans-lambda').val()),
				includeTimeFeatures: useTimeFtrV,
			}
			
			var minStates = $('#input-dpmeans-minstates').val();
			var maxStates = $('#input-dpmeans-maxstates').val();
			
			if (minStates != null && minStates != '')
				data.clust.minStates = minStates;
			if (maxStates != null && maxStates != '')
				data.clust.maxStates = maxStates;
		}
		
		$.ajax('api/buildModel', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify(data),
			timeout: 1000*60*60*24,	// 1 day
			success: function (data) {
				newModelPopup.modal('hide');
				$('#div-model-progress').removeClass('hidden');
				pingProgress(isRealTime);
			},
			error: handleAjaxError()
		});
		
		$('#btn-add-online,#btn-add-offline').attr('disabled', 'disabled');
		btn.attr('disabled', 'disabled');
	});
	
	//========================================================
	// TABLES
	//========================================================	
	
	$('#table-models-active tbody,#table-models-inactive tbody,#table-models-offline tbody,#table-models-public tbody').sortable({
		helper: function(e, tr) {
   			var $originals = tr.children();
   			var $helper = tr.clone();
   			$helper.children().each(function(index) {
   				$(this).width($originals.eq(index).width())
			});         
   			return $helper;     
		}
	});
	
	(function () {
		var tableRowsSelector = '#table-models-active tbody tr,#table-models-inactive tbody tr,#table-models-offline tbody tr,#table-models-public tbody tr';
		var tableRows = $(tableRowsSelector);
		
		tableRows.mousedown(onFetchDetails);
		
		$.contextMenu({
			selector: tableRowsSelector,
			items: {
				view: {
					name: 'View',
					callback: function (event) {
						var tr = $(this);
						var mid = getModelIdFromTr(tr);
						viewModel(mid);
					}
				},
				remove: {
					name: 'Remove',
					callback: function () {
						var tr = $(this);
						var mid = getModelIdFromTr(tr);
						var name = getModelNameFromTr(tr);
						
						promptConfirm('Remove Model', 'Are you sure you wish to remove model ' + name + '?', function () {
							removeModel(mid, tr);
						});
					}
				}
			}
		});
	})();
	
	//========================================================
	// BUTTONS ON THE DASHBOARD
	//========================================================	
	
	function clearConfigureDataset() {
		$('#input-choose-upload').val('');
		$('#select-attrs').val('');
		$('#select-tu').val('hour');
		$('#select-clust').val('kmeans');
		$('#input-kmeans-k').val('12');
		$('#input-dpmeans-minstates').val('10');
		$('#input-dpmeans-maxstates').val('30');
		$('#input-dpmeans-lambda').val('0.8');
		$('#select-hierarchy').val('aggClust');
		$('#input-model-name').val('');
		$('#input-model-desc').val('');
		
		$('#input-choose-upload').change();
		$('#progress-file-upload').css('width','0%');
		$('#progress-file-upload').html('0%');
	}
	
	$('#btn-add-online').click(function () {
		clearConfigureDataset();
		$('#check-realtime').prop('checked', true);
		newModelPopup.modal('show');
	});
	
	$('#btn-add-offline').click(function () {
		clearConfigureDataset();
		$('#check-realtime').prop('checked', false);
		newModelPopup.modal('show');
	});
	
	$('.btn-view').click(onViewModel);
	
	// table buttons
	$('.btn-activate').click(activate);
	$('.btn-deactivate').click(deactivate);
	$('.btn-share').click(share);
	$('.btn-unshare').click(unshare);
	
	//========================================================
	// MODEL DETAILS
	//========================================================
	
	$('#input-model-details-desc').keyup(function () {
		$('#div-model-details-btns').removeClass('hidden');
	});
	
	$('#btn-save-model-details').click(function () {
		var tr = $('#table-models-offline,#table-models-public,#table-models-active,#table-models-inactive').find('.success');
		var mid = getModelIdFromTr(tr);
		var desc = $('#input-model-details-desc').val();
		
		$.ajax('api/modelDescription', {
			dataType: 'json',
			data: { modelId: mid, description: desc },
			method: 'POST',
			success: function (data, status, xhr) {
				$('#div-model-details-btns').addClass('hidden');
				showAlert($('#alert-holder'), $('#alert-wrapper-model-details'), 'alert-success', 'Details saved!', null, true);
			},
			error: handleAjaxError($('#alert-wrapper-model-details'))
		});
	});
	
	$('#btn-cancel-model-details').click(function () {
		var tr = $('#table-models-offline,#table-models-public,#table-models-active,#table-models-inactive').find('.success');
		var mid = getModelIdFromTr(tr);
		
		fetchModelDetails(mid);
	});
	
	//========================================================
	// USE CASE CONFIGURATION 
	//========================================================	
 
    (function () {
        var calcCoeffDiv = $('#div-configure-coeff');

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
                error: handleAjaxError()
            });
        }

		$('#check-calc-coeff').change(function () {
			var isChecked = $(this).is(':checked');
			if (isChecked) {
				// fetch the configuration from the db
                calcCoeffDiv.removeClass('hidden');
			}
			else
                calcCoeffDiv.addClass('hidden');
		});

        $('#config-done').click(function () {
            $.ajax('api/config', {
                method: 'POST',
                data: {
                    calc_coeff: $('#check-calc-coeff').is(':checked'),
                    deviation_extreme_lambda: $('#input-extreme-lambda').val(),
                    deviation_major_lambda: $('#input-major-lambda').val(),
                    deviation_minor_lambda: $('#input-significant-lambda').val(),
                    deviation_significant_lambda: $('#input-minor-lambda').val()
                },
                error: handleAjaxError()
            });
        });

        $('#config-cancel').click(function () {
            fetchConfig();
        });

        $('#config-cancel, #config-done').click(function () {
            $('#popup-config').modal('hide');
        });

        $('#lnk-config').click(function (event) {
            event.preventDefault();
            $('#popup-config').modal({ show: true });
        });
    })();

	//========================================================
	// INITIALIZE NAVIGATION
	//========================================================	
	
	$('.nav-pills a').click(function () {
		$('#div-model-details').addClass('hidden');
		var tr = $('#table-models-offline,#table-models-public,#table-models-active,#table-models-inactive').find('.success').removeClass('success');
	});
	
	$('.nav-pills a')[0].click();
})();
