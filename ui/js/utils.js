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