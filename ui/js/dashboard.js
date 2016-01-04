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
		$('#progress-build-model-wrapper').hide(0);

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
			success: function (fields, status, xhr) {
				var select = $('#select-attrs');
					
				// clear the attributes
				select.html('');
				for (var i = 0; i < fields.length; i++) {
					var attr = fields[i].name;												
					select.append('<option value="' + attr + '">' + attr + '</option>');
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
						var select = $('#select-controls');
						
						// clear the attributes
						select.html('');
						for (var i = 0; i < selectedAttrs.length; i++) {
							var attr = selectedAttrs[i];
							if (attr != timeAttr)
								select.append('<option value="' + attr + '">' + attr + '</option>');
						}
						
						$('#select-controls').bootstrapDualListbox({
							showFilterInputs: false,
							selectedListLabel: 'Control Atrtibutes',
							nonSelectedListLabel: 'Observation Attributes'
						});
						$('#select-controls').bootstrapDualListbox('refresh');
						
						// show the attribute selection
						$('#form-phase4').show();
					});
					
					timeRadio.find('input:radio').change(checkConfigureDataset);
					
					$('#form-phase3').show(0);
				});
				
				$('#form-phase2').show();
			},
			error: function (xhr, status) {
				alert('Failed to upload file: ' + status + '!');
			}
		});
	});
	
	$('#btn-done').click(function () {
		var btn = $(this);
		
		if (!checkConfigureDataset()) return;
		
		$('#progress-build-model-wrapper').show(0);
	
		var attrs = $('#select-attrs').val();
		var controlAttrs = $('#select-controls').val();
		var isRealTime = $('#check-realtime').is(':checked');
		var name = $('#input-model-name').val();
		var clustAlg = $('#select-clust').val();
		var hierarchyType = $('#select-hierarchy').val();
		
		var data = {
			username: $('#input-email').val(),
			time: $('#radio-time').find('input:radio').val(),
			timeUnit: $('#select-tu').val(),
			attrs: attrs,
			controlAttrs: controlAttrs != null ? controlAttrs : [],
			hierarchyType: hierarchyType,
			isRealTime: isRealTime,
			name: name
		}
		
		if (clustAlg == 'kmeans') {
			data.clust = {
				type: clustAlg,
				k: parseInt($('#input-kmeans-k').val())
			}
		} else if (clustAlg == 'dpmeans') {
			data.clust = {
				type: clustAlg,
				lambda: parseFloat($('#input-dpmeans-lambda').val())
			}
			
			var minStates = $('#input-dpmeans-minstates').val();
			var maxStates = $('#input-dpmeans-maxstates').val();
			
			if (minStates != null && minStates != '')
				data.clust.minStates = minStates;
			if (maxStates != null && maxStates != '')
				data.clust.maxStates = maxStates;
		}
		
		var startTime = new Date().getTime();
		
		var currProgress = 0;
		var prevProgress = 0;
		var intervalId = setInterval(function () {
			var time = (new Date().getTime() - startTime) / 1000;
			currProgress = Math.floor((1 - Math.exp(-time/(60*2))) * 100);
			
			if (currProgress != prevProgress) {
				$('#progress-build-model').css('width', currProgress + '%');
				$('#progress-build-model').html(currProgress + '%');
				prevProgress = currProgress;
			}
		}, 500);
		
		$.ajax('api/configureModel', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify(data),
			timeout: 1000*60*60*24,	// 1 day
			success: function (data) {
				newModelPopup.modal('hide');
				window.location.reload();
			},
			error: function (xhr, status) {
				alert(status);
			},
			complete: function () {
				clearInterval(intervalId);
			}
		});
		
		btn.attr('disabled', 'disabled');
	});
	
	//========================================================
	// TABLES
	//========================================================	
	
	function getContainerFromTable(table) {
		return table.parent().parent().parent().parent().parent().parent();
	}
	
	function getModelIdFromBtn(btn) {
		var tr = btn.parent().parent().parent();
		var mid = tr.attr('id').split('-')[1];
		return mid;
	}
	
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
	
	$('#table-models-active tbody tr,#table-models-inactive tbody tr,#table-models-offline tbody tr,#table-models-public tbody tr').click(function () {
		var tr = $(this);
		var table = tr.parent().parent();
		var container = getContainerFromTable(table);
		
		table.find('tr').removeClass('success');
		tr.addClass('success');
		
		container.find('.btn-view').attr('disabled', false);
	});
	
	
	
	//========================================================
	// BUTTONS ON THE DASHBOARD
	//========================================================	
	
	$('#btn-add-online').click(function () {
		$('#check-realtime').prop('checked', true);
		newModelPopup.modal('show');
	});
	
	$('#btn-add-offline').click(function () {
		$('#check-realtime').prop('checked', false);
		newModelPopup.modal('show');
	});
	
	$('.btn-view').click(function () {
		var btn = $(this);
		var mid = getModelIdFromBtn(btn);
		
		$.ajax('api/selectDataset', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ modelId: mid }),
			success: function (data, status, xhr) {
				redirectToUI();
			},
			error: handleAjaxError
		});
		
		return false;
	});
	
	$('.btn-deactivate').click(function () {
		var btn = $(this);
		var mid = getModelIdFromBtn(btn);
		
		$.ajax('api/activateModel', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ modelId: mid, activate: false }),
			success: function (data, status, xhr) {
				window.location.reload();
			},
			error: handleAjaxError
		});
		
		return false;
	});
	
	$('.btn-activate').click(function () {
		var btn = $(this);
		var mid = getModelIdFromBtn(btn);
		
		$.ajax('api/activateModel', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ modelId: mid, activate: true }),
			success: function (data, status, xhr) {
				window.location.reload();
			},
			error: handleAjaxError
		});
		
		return false;
	});
	
	$('.btn-share').click(function () {
		var btn = $(this);
		var mid = getModelIdFromBtn(btn);
		
		$.ajax('api/shareModel', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ modelId: mid, share: true }),
			success: function (data, status, xhr) {
				window.location.reload();
			},
			error: handleAjaxError
		});
		
		return false;
	});
	
	$('.btn-unshare').click(function () {
		var btn = $(this);
		var mid = getModelIdFromBtn(btn);
		
		$.ajax('api/shareModel', {
			method: 'POST',
			contentType: 'application/json',
			data: JSON.stringify({ modelId: mid, share: false }),
			success: function (data, status, xhr) {
				window.location.reload();
			},
			error: handleAjaxError
		});
		
		return false;
	});
	
	//========================================================
	// INITIALIZE NAVIGATION
	//========================================================	
	
	$('.nav-pills a')[0].click();
})();