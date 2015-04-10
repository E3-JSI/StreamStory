var storeName = 'fish';
var hmcStoreName = 'fish_hmc';

var DATE_IDXS = {
	January: 0,
	February: 1,
	March: 2,
	April: 3,
	May: 4,
	June: 5,
	July: 6,
	August: 7,
	September: 8,
	October: 9,
	November: 10,
	December: 11
}

function parseDate(dateStr) {
	var split = dateStr.split('/');

	var month = parseInt(split[0]);
	var day = parseInt(split[1]);
	var year = parseInt(split[2]);
	
	return new Date(year, month, day);
}

exports.hmcStoreName = hmcStoreName;
exports.hmcTimeField = 'time';
exports.hmcSequenceCategory = 'Batch';

exports.hmcParams = {
	transitions: {
		type: 'continuous',
		timeUnit: 'month'
	},
	clustering: {
		type: 'dpmeans',
		lambda: .7,
		minClusts: 5,
		rndseed: 1,
		sample: 1,
		histogramBins: 20
	},
	pastStates: 1,
	verbose: true
};

exports.createDb = function (qm, callback) {	
	// create a new qminer DB
	log.info('Creating QMiner database using configuration %s ...', QM_CONF_FILE);
	var base = qm.create(QM_CONF_FILE, QM_SCHEMA_FILE, true);
	
	log.info('Creating stores ...');
	var fishOpts = {
		file: '/media/lstopar/hdd/data/Ribe/Data mining 18022015 AM Ardag.csv',
		store: storeName,
		base: base,
		ignoreFields: ['Feeder']
	}
	
	base.loadCSV(fishOpts, function (e) {
		if (e != null) {
			callback(e);
			return;
		}
		
		try {
			log.info('Removing empty fields ...');
			// remove all the fields that are nullable
			var inStore = base.store(storeName);
			var inFields = inStore.fields;
			
			var outFields = {};
			var inFieldsMap = {};
			for (var i = 0; i < inFields.length; i++) {
				var fieldName = inFields[i].name;
				outFields[fieldName] = true;
				inFieldsMap[fieldName] = inFields[i];
			}
			
			inStore.each(function (rec) {
				for (var field in outFields) {
					var val = rec[field];
					
					if (val == null || (isNaN(val) && val.length == 0))
						delete outFields[field];
				}
			});
			
			// create another store with only non-empty fields
			var fromField = 'From';
			var toField = 'To';
			
			var ignoreFields = {
				Origin_Year: true,
				Origin_Month: true,
				Batch: true,
				Unit: true,
				Model_End_Av_Wt: true,
				Av_Wt_Deviation_: true,
				Sampling_No: true,
				Mortality_No: true,
				SFR_Period_: true,
				FCR_AF: true,
				FCR_Period: true,
				SFR_Period__AF: true,
				SGR_Period_: true,
				// some fields which are mostly 0
				Harvest_Biomass: true,
				Given_Biomass: true,
				Taken_Biomass: true,
				Feeding_Rate_Kg__Hour: true,
				Fastings_No: true,
				Transfer__No: true,
				Harvest_No: true,
				// fields which we replace with other fields
				Opening_Fish_No: true,
				Opening_Biomass: true,
				Closing_Fish_No: true,
				Closing_Biomass: true,
				Start_Av_Wt: true,
				End_AvWt: true,
				Av_Wt_AF: true,
				Biomass_Produced: true,
				Biomass_Produced_AF: true
			};
			ignoreFields[fromField] = true;
			ignoreFields[toField] = true;
			
			var storeDef = {
				name: hmcStoreName,
				fields: [{name: CTMC_TIME_FIELD_ID, type: 'datetime'}]
			};
			
			for (var fieldName in outFields) {
				var fieldDesc = inFieldsMap[fieldName];
				
				if (fieldName in ignoreFields) continue;
				
				if (inStore.isNumeric(fieldName)) {	// TODO add categorical fields
					storeDef.fields.push({
						name: fieldName,
						type: fieldDesc.type
					});
				}
			}
			
			storeDef.fields.push({
				name: 'avg_opening_mass',
				type: 'float'
			});
			
			storeDef.fields.push({
				name: 'avg_closing_mass',
				type: 'float'
			});
			
			storeDef.fields.push({
				name: 'produced_mass',
				type: 'float'
			});
			
			storeDef.fields.push({
				name: 'mortality',
				type: 'float'
			});
			
			base.createStore(storeDef);
			
			// insert all the records into the store
			log.info('Copying records to store \'%s\'', hmcStoreName);
			
			function getRecTime(rec) {
				var from = parseDate(rec[fromField]);
				var to = parseDate(rec[toField]);
				
				return Math.floor((from.getTime() + to.getTime()) / 2);
			}
			
			var recSet = inStore.recs;
			recSet.sort(function (rec1, rec2) {
				if (rec1.Unit == rec2.Unit && rec1.Batch == rec2.Batch) {
					return getRecTime(rec1) - getRecTime(rec2);
				} else if (rec1.Batch != rec2.Batch) {
					if (rec1.Batch < rec2.Batch) return -1;
					else if (rec1.Batch > rec2.Batch) return 1;
					else return 0;
				} else {
					if (rec1.Unit < rec2.Unit) return -1;
					else if (rec1.Unit > rec2.Unit) return 1;
					else return 0;
				}
			});
			
			var outStore = base.store(hmcStoreName);
			
			log.debug('Copying store and creating batch vector ...');
			
			var endsBatchV = new qm.la.BoolVector();
			var ignoreRecV = new qm.la.BoolVector();	// ignore batches of length 1
			
			var currUnitId = null;
			var currBatchId = null;
			
			recSet.each(function (rec, i) {
				var unit = rec['Unit'];
				var batch = rec['Batch'];
				
				if (unit != currUnitId || batch != currBatchId) {
					if (endsBatchV.length > 0)
						endsBatchV[endsBatchV.length-1] = true;
					currUnitId = unit;
					currBatchId = batch;
				}
				
				if (endsBatchV.length > 1 && endsBatchV[endsBatchV.length-1] && endsBatchV[endsBatchV.length-2]) {
					ignoreRecV[ignoreRecV.length-1] = true;
					endsBatchV.splice(endsBatchV.length-1, 1);
				}
				
				endsBatchV.push(false);
				ignoreRecV.push(false);
			});
			
			var ignoreCount = 0;
			recSet.each(function (rec, i) {
				if (ignoreRecV[i]) {
					ignoreCount++;
					return;
				}
				
				var cpy = {};
				for (var field in outFields) {
					if (field in ignoreFields)
						continue;
					
					if (inStore.isNumeric(field))	// TODO add categorical fields
						cpy[field] = rec[field];
				}
				
				cpy.avg_opening_mass = rec.Opening_Biomass / rec.Opening_Fish_No;
				cpy.avg_closing_mass = rec.Closing_Biomass / rec.Closing_Fish_No;
				cpy.produced_mass = rec.Closing_Biomass / rec.Opening_Biomass - 1;
				cpy.mortality = (rec.Opening_Fish_No - rec.Closing_Fish_No) / rec.Opening_Fish_No;
				
				cpy.time = new Date(getRecTime(rec)).toISOString().split('Z')[0];
				outStore.add(cpy);
				
				if (log.trace())
					log.trace('Ends batch: ' + endsBatchV[i - ignoreCount] + ', (%s,%s,%s,%s)', rec.Unit, rec.Batch, rec.From, rec.To);
			});
			
			callback(null, {base: base, endsBatchV: endsBatchV});
		} catch (e) {
			callback(e);
		}
	});
}

exports.getFieldConfig = function (base) {
	var obsFields = [];
	var contrFields = [];
	
	var controlFlds = {
		Food_Price: true,
		Max_Food_Qty: true,
		Period_Food_Qty: true
	}
	
	var fields = base.store(hmcStoreName).fields;
	fields.forEach(function (field, idx) {
		if (field.name == CTMC_TIME_FIELD_ID) return;
		
		var fieldConfig = {
			name: field.name,
			type: field.type == 'float' ? 'numeric' : 'categorical',
			interpolator: field.type == 'float' ? 'linear' : 'previous',
			inModel: true
		};
		
		if (log.debug())
			log.debug('Field: %s', field.name);
		
		if (!controlFlds[field.name]) {
			obsFields.push(fieldConfig);
		}
		else {
			contrFields.push(fieldConfig);
		}
		
	});
	
	return { obsFields: obsFields, contrFields: contrFields };
}