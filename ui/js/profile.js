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
		
	   	$('.nav-pills a')[0].click();
	});
})()