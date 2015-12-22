function drawHistogram(opts) {
	var data = opts.data;
	
	var min = data.binStartV[0];
	var max = data.binStartV[data.binStartV.length-1];
	
	var pointInterval = (max - min) / data.binStartV.length;
	var start = min - pointInterval / 2;
	
	var chart = new Highcharts.Chart({
	    chart: {
	        renderTo: opts.container,
	        type: 'column'
	    },
	    title: {
        	floating: true,
        	text: ''
        },
        legend: {
        	enabled: false
        },
	    xAxis: {
	    	min: min,
	    	max: max
	    },
	    yAxis: {
	    	title: {
	    		enabled: false
	    	},
	    	labels: {
	    		enabled: opts.showY != null ? opts.showY : true
	    	}
	    },
	    tooltip: {
	    	formatter: function () {
	    		return toUiPrecision(this.x);
	    	}
	    },
	    plotOptions: {
	        column: {
	            groupPadding: 0,
	            pointPadding: 0,
	            borderWidth: 0
	        }
	    },
	    series: [{
	        data: data.probs,
	        pointStart: start,
	        pointInterval: pointInterval
	    }]
	});
}