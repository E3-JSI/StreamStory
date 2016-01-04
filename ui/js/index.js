(function () {
	function resetConfigureDataset() {	// TODO currently not used
		$('#select-clust').val('kmeans');
	}

	$(document).ready(function () {
		
		//================================================
		// CONFIGURE DATASET
		//================================================
		
		
		
		$('#input-choose-upload,#input-email,#select-clust,#select-clust,#input-dpmeans-lambda').change(checkConfigureDataset);
		$('#input-model-name').keyup(checkConfigureDataset);
		
		$('#select-clust').change(function () {
			var val = $(this).val();
			
			if (val != 'kmeans') $('#div-config-kmeans').addClass('hidden');
			if (val != 'dpmeans') $('#div-config-dpmeans').addClass('hidden');
			
			if (val == 'kmeans') $('#div-config-kmeans').removeClass('hidden');
			if (val == 'dpmeans') $('#div-config-dpmeans').removeClass('hidden');
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
				error: handleAjaxError
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