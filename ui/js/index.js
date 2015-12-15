(function () {
	function redirectToUI() {
		window.location.replace('ui.html');
	}
	
	function resetConfigureDataset() {	// TODO currently not used
		$('#select-clust').val('kmeans');
	}

	$(document).ready(function () {
		
		//================================================
		// CONFIGURE DATASET
		//================================================
		
		function checkConfigureDataset() {
			var isOK = true;
			
			var radio = $('#radio-time');
			var timeVal = radio.find('input:radio').val();
			
			// check if all the values are there
			var hasEmail = $('#input-email').val() != '';
			var hasTimeAttr = timeVal != null && timeVal != '';
			var hasData = $('#input-choose-upload').val() != '';
			var hasName = $('#input-model-name').val() != '';
			var clustAlg = $('#select-clust').val();
			
			if (!hasEmail || !hasTimeAttr || !hasData || !hasName)
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
		
		$('#input-choose-upload,#input-email,#select-clust,#select-clust,#input-dpmeans-lambda').change(checkConfigureDataset);
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
		
		$('#select-clust').change(function () {
			var val = $(this).val();
			
			if (val != 'kmeans') $('#div-config-kmeans').addClass('hidden');
			if (val != 'dpmeans') $('#div-config-dpmeans').addClass('hidden');
			
			if (val == 'kmeans') $('#div-config-kmeans').removeClass('hidden');
			if (val == 'dpmeans') $('#div-config-dpmeans').removeClass('hidden');
		});
		
		$('#btn-done').click(function () {
			if (!checkConfigureDataset()) return;
			
			$('#progress-build-model-wrapper').show(0);
		
			var attrs = $('#select-attrs').val();
			var controlAttrs = $('#select-controls').val();
			var isRealTime = $('#check-realtime').is(':checked');
			var name = $('#input-model-name').val();
			var clustAlg = $('#select-clust').val();
			
			var data = {
				username: $('#input-email').val(),
				time: $('#radio-time').find('input:radio').val(),
				timeUnit: $('#select-tu').val(),
				attrs: attrs,
				controlAttrs: controlAttrs != null ? controlAttrs : [],
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
					redirectToUI();
				},
				error: function (xhr, status) {
//					$('#input-choose-upload').val('');
//					$('#input-choose-upload').change();
					alert(status);
				},
				complete: function () {
					clearInterval(intervalId);
				}
			});
			
			$('#btn-done').attr('disabled', 'disabled');
		});
		
		//================================================
		// SELECT DATASET
		//================================================
		
		function enableDisableSelect() {
			var emailPresent = $('#input-email-select').val() != '';
			var datasetPresent = $('#select-dataset option[selected="selected"]').val() != null &&
				$('#select-dataset option[selected="selected"]').val() != '';
		
			if (emailPresent && datasetPresent) {
				$('#btn-upload-done').removeAttr('disabled');
			} else {
				$('#btn-upload-done').attr('disabled', 'disabled');
			}
		}
		$('#input-email-select').change(enableDisableSelect);
	
		$('#input-email-select').change(function () {
			var email = $(this).val();
			$.ajax('api/selectDataset', {
				contentType: false,
			data: { email: email },
			method: 'GET',
			success: function (data, status, xhr) {									
				var select = $('#select-dataset');
				select.html('');
				
				for (var i = 0; i < data.length; i++) {
					var option = $('<option />');
					
					var modelData = data[i];
					
					option.val(modelData.mid);
					option.html(modelData.name + ' (' + modelData.date_created + ')' + (modelData.is_realtime == 1 ? ' (online)' : ' (offline)'));
					if (i == 0) {
						option.attr('selected', 'selected');
					}
					if (modelData.is_active == 1) {
						option.addClass('model-active');
					}
					
					select.append(option);
				}
				
				$('#select-dataset').off('change');
				$('#select-dataset').change(enableDisableSelect);
				$('#select-dataset option[selected="selected"]').change();
			},
			error: function (xhr, status) {
				alert('Failed to upload file: ' + status + '!');
			}
			});
		});
		
		$('#btn-upload-done').click(function () {
			var modelId = $('#select-dataset').val();
			
			$.ajax('api/selectDataset', {
				method: 'POST',
				contentType: 'application/json',
			data: JSON.stringify({ modelId: modelId }),
			success: function (data, status, xhr) {
				redirectToUI();
			},
			error: function (xhr, status) {
				alert('Failed to select dataset: ' + status + '!');
			}
			});
		});
		
		//================================================
		// MODAL DIALOGS
		//================================================
		
		$('#input-upload').click(function () {
			$('#popup-data-upload').modal('show');
		});
		
		$('#input-select-source').click(function () {
			$('#popup-data-select').modal('show');
		});
		
		$('#popup-data-upload').modal({ show: false });
		$('#popup-data-select').modal({ show: false });
	});
})()