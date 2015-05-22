exports.hmcStoreName = 'drilling_resampled';
exports.hmcTimeField = 'time';

exports.hmcParams = {
	transitions: {
		type: 'continuous',
		timeUnit: 'minute'
	},
	clustering: {
		type: 'dpmeans',
		lambda: 0.7,
		minClusts: 10,
		rndseed: 1,
		sample: 1,
		histogramBins: 20
	},
	pastStates: 2,
	verbose: true
};

exports.createDb = function (qm, callback) {
	try {
		// create a new qminer DB
		log.info('Creating QMiner database using configuration %s ...', QM_CONF_FILE);
		var base = qm.create(QM_CONF_FILE, QM_SCHEMA_FILE, true);
		callback(null, { base: base });
	} catch (e) {
		callback(e);
	}
};

exports.getFieldConfig = function () {
	var obsFields = [
		{name: 'hook_load', type: 'numeric', interpolator: 'previous', inModel: false, isRaw: true},
		{name: 'hoist_press_A', type: 'numeric', interpolator: 'linear', inModel: false, isRaw: true},
		{name: 'hoist_press_B', type: 'numeric', interpolator: 'linear', inModel: false, isRaw: true},
		{name: 'ibop', type: 'numeric', interpolator: 'previous', inModel: true, isRaw: true},
		{name: 'oil_temp_gearbox', type: 'numeric', interpolator: 'linear', inModel: true, isRaw: true},
		{name: 'oil_temp_swivel', type: 'numeric', interpolator: 'linear', inModel: true, isRaw: true},
		{name: 'pressure_gearbox', type: 'numeric', interpolator: 'linear', inModel: true, isRaw: true},
		{name: 'temp_ambient', type: 'numeric', interpolator: 'previous', inModel: false, isRaw: true},
		{name: 'wob', type: 'numeric', interpolator: 'linear', inModel: true, isRaw: false},
		{name: 'mru_pos', type: 'numeric', interpolator: 'linear', inModel: false, isRaw: false},
		{name: 'mru_vel', type: 'numeric', interpolator: 'linear', inModel: false, isRaw: false},
		{name: 'ram_pos_measured', type: 'numeric', interpolator: 'linear', inModel: false, isRaw: true},
		{name: 'ram_pos_setpoint', type: 'numeric', interpolator: 'linear', inModel: false, isRaw: true},
		{name: 'ram_vel_measured', type: 'numeric', interpolator: 'linear', inModel: false, isRaw: true},
		{name: 'ram_vel_setpoint', type: 'numeric', interpolator: 'linear', inModel: false, isRaw: true},
		{name: 'friction_coeff', type: 'numeric', interpolator: 'linear', inModel: true, isRaw: false}             
	];
	var contrFields = [
	    {name: 'rpm', type: 'numeric', interpolator: 'previous', inModel: true, isRaw: true},
	    {name: 'torque', type: 'numeric', interpolator: 'linear', inModel: true, isRaw: true}
	];
	
	return { obsFields: obsFields, contrFields: contrFields }
};