(function () {
	function clearResetPassword() {
		$('#input-password').val('');
		$('#input-password-new').val('');
		$('#input-password-repeat').val('');
	}
	
	$(document).ready(function () {
		$('#btn-password-submit').click(function () {
			var old = $('#input-password').val();
			var newPasswd = $('#input-password-new').val();
			var repeat = $('#input-password-repeat').val();
			
			$.ajax('api/changePassword', {
				dataType: 'json',
				data: { old: old, newP: newPasswd, repeat: repeat },
				method: 'POST',
				success: function () {
					clearResetPassword();
					showAlert($('#alert-holder'), $('#alert-wrapper'), 'alert-success', 'Password reset!', null, true);
				},
				error: function (xhr, status, err) {
					if (xhr.status == 400) {
						var responseText = xhr.responseText;
						showAlert($('#alert-holder'), $('#alert-wrapper'), 'alert-danger', responseText, null, false);
					} else {
						alert(xhr.responseText);
					}
				}
			});
		});
		
		$('#btn-password-cancel').click(function () {
			clearResetPassword();
		});
		
		$('#btn-theme-submit').click(function () {
			$.ajax('api/theme', {
				dataType: 'json',
				method: 'POST',
				data: { theme: $('#select-theme').val() },
				success: function () {
					reloadWindow();
				},
				error: handleAjaxError($('#alert-wrapper-theme'))
			});
		});
		
		$('#btn-theme-cancel').click(function () {
			$.ajax('api/theme', {
				dataType: 'json',
				method: 'GET',
				success: function (data) {
					$('#select-theme').val(data.theme);
					showAlert($('#alert-holder'), $('#alert-wrapper'), 'alert-success', 'Password reset!', null, true);
				},
				error: handleAjaxError($('#alert-wrapper-theme'))
			});
		});
		
	   	$('.nav-pills a')[0].click();
	});
})()