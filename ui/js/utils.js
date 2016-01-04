function isInt(val) {
	if (isNaN(val)) return false;
	return parseFloat(val) == parseInt(val);
}

function clone(obj) {
	return JSON.parse(JSON.stringify(obj));
}

function getTimeUnit() {
	return $('#span-tu').html();
}

function handleAjaxError(xhr, status, err) {
	alert(xhr.responseText);
}

function toUiPrecision(val) {
	if (val > 1000) {
		return val.toFixed();
	} else {
		return val.toPrecision(3);
	}
}

function showAlert(holder, wrapper, clazz, title, msg, close) {
	wrapper.children('div').alert('close');
	wrapper.html(holder.html());
	
	var alertDiv = wrapper.children('div');
	
	alertDiv.removeClass('alert-danger');
	alertDiv.removeClass('alert-success');
	alertDiv.addClass(clazz);
	
	if (title != null)
		alertDiv.children('.alert-title').html(title);
	if (msg != null)
		alertDiv.children('.alert-text').html(msg);
	
	alertDiv.alert();
	
	if (close == true) {
		setTimeout(function () {
			alertDiv.alert('close');
		}, 5000);
	}
}

function redirectToUI() {
	window.location.replace('ui.html');
}