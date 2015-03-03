exports.hmcStoreName = 'drilling_resampled';
exports.hmcTimeField = 'time';
exports.hmcParams = {
	transitions: {
		type: 'continuous',
		timeUnit: 'minute'
	},
	clustering: {
		type: 'dpmeans',
		lambda: 1.1,
		minClusts: 30,
		rndseed: 1,
		sample: 1,
		histogramBins: 20
	},
	pastStates: 1,
	verbose: true
};

exports.createDb = function (qm, callback) {
	try {
		// create a new qminer DB
		log.info('Creating QMiner database using configuration %s ...', QM_CONF_FILE);
		global.base = qm.create(QM_CONF_FILE, QM_SCHEMA_FILE, true);
	} catch (e) {
		callback(e);
	}
};

exports.getFieldConfig = function () {
	return [
        {name: 'hook_load', type: 'numeric', interpolator: 'previous', inModel: true},
        {name: 'oil_temp_gearbox', type: 'numeric', interpolator: 'linear', inModel: false},
        {name: 'oil_temp_swivel', type: 'numeric', interpolator: 'linear', inModel: false},
        {name: 'pressure_gearbox', type: 'numeric', interpolator: 'linear', inModel: true},
        {name: 'rpm', type: 'numeric', interpolator: 'linear', inModel: true},
        {name: 'temp_ambient', type: 'numeric', interpolator: 'previous', inModel: false},
        {name: 'torque', type: 'numeric', interpolator: 'linear', inModel: true},
        {name: 'wob', type: 'numeric', interpolator: 'linear', inModel: true},
        {name: 'mru_pos', type: 'numeric', interpolator: 'linear', inModel: true},
        {name: 'mru_vel', type: 'numeric', interpolator: 'linear', inModel: false},
        {name: 'ram_pos_measured', type: 'numeric', interpolator: 'linear', inModel: false},
        {name: 'ram_pos_setpoint', type: 'numeric', interpolator: 'linear', inModel: true},
        {name: 'ram_vel_measured', type: 'numeric', interpolator: 'linear', inModel: false},
        {name: 'ram_vel_setpoint', type: 'numeric', interpolator: 'linear', inModel: true}
    ];
};