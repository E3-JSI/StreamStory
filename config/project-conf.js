exports.hmcStoreName = 'drilling_resampled';
exports.hmcTimeField = 'time';
exports.hmcParams = {
	transitions: {
		type: 'continuous',
		timeUnit: 'hour'
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
        {name: 'hook_load', type: 'numeric', interpolator: 'previous'},
        {name: 'oil_temp_gearbox', type: 'numeric', interpolator: 'linear'},
        {name: 'oil_temp_swivel', type: 'numeric', interpolator: 'linear'},
        {name: 'pressure_gearbox', type: 'numeric', interpolator: 'linear'},
        {name: 'rpm', type: 'numeric', interpolator: 'linear'},
        {name: 'temp_ambient', type: 'numeric', interpolator: 'previous'},
        {name: 'torque', type: 'numeric', interpolator: 'linear'},
        {name: 'wob', type: 'numeric', interpolator: 'linear'},
        {name: 'mru_pos', type: 'numeric', interpolator: 'linear'},
        {name: 'mru_vel', type: 'numeric', interpolator: 'linear'},
        {name: 'ram_pos_measured', type: 'numeric', interpolator: 'linear'},
        {name: 'ram_pos_setpoint', type: 'numeric', interpolator: 'linear'},
        {name: 'ram_vel_measured', type: 'numeric', interpolator: 'linear'},
        {name: 'ram_vel_setpoint', type: 'numeric', interpolator: 'linear'}
    ];
};