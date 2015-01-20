function drawHistogram(opts) {
	var data = opts.data;
	
	var categories = [];
	for (var i = 0; i < data.binStartV.length; i++) {
		categories.push('<= ' + data.binStartV[i].toFixed(1));
	}
	categories.push('> ' + data.binStartV[data.binStartV.length - 1].toFixed(1));
	
	var chart = new Highcharts.Chart({
	    chart: {
	        renderTo: opts.container,
	        type: 'column'
	    },
	    xAxis: {
	        categories: categories
	    },
	    plotOptions: {
	        column: {
	            groupPadding: 0,
	            pointPadding: 0,
	            borderWidth: 0
	        }
	    },
	    series: [{
	        data: data.probs
	    }]
	});
}