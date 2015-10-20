function isInt(val) {
	if (isNaN(val)) return false;
	return parseFloat(val) == parseInt(val);
}