var SERIES_COLORS = ['#5bc0de', '#ED561B', '#555555', '#DDDF00', '#24CBE5', '#64E572', 
	             '#FF9655', '#FFF263', '#6AF9C4'];

$(document).ready(function () {
	// change Highcharts theme
	Highcharts.theme = {
	    colors: SERIES_COLORS,
	    chart: {
	        backgroundColor: '#1c1e22'
	    },
	    title: {
	        style: {
	            color: '#000',
	            font: 'bold 16px "Trebuchet MS", Verdana, sans-serif'
	        }
	    },
	    subtitle: {
	        style: {
	            color: '#666666',
	            font: 'bold 12px "Trebuchet MS", Verdana, sans-serif'
	        }
	    },
	
	    legend: {
	        itemStyle: {
	            font: '9pt Trebuchet MS, Verdana, sans-serif',
	            color: 'black'
	        },
	        itemHoverStyle:{
	            color: 'gray'
	        }   
	    }
	};
	
	// Apply the theme
	Highcharts.setOptions(Highcharts.theme);
});

function drawHistogram(opts) {
	var HISTOGRAM_COLOR = SERIES_COLORS[0];
	var PREV_STATE_COLOR = SERIES_COLORS[1];
	var BACKGROUND_COLOR = SERIES_COLORS[2];
	
	var PROB_THRESHOLD = .05;
	
	var data = opts.data;
	
	var totalProb = data.probSum;

	var min = data.binStartV[0];
	var max = data.binStartV[data.binStartV.length-1];
	
	var pointInterval = (max - min) / data.binStartV.length;
	var start = min - pointInterval / 2;
	
	var probTransformFact = 1;
	var targetTransformFact = 1;
	
	if (totalProb < PROB_THRESHOLD) {
		probTransformFact = PROB_THRESHOLD / totalProb;
		
		for (var i = 0; i < data.probV.length; i++) {
			data.probV[i] *= probTransformFact;
		}
	}
	
	var series = [{
        data: data.probV,
        color: HISTOGRAM_COLOR,
        pointStart: start,
        cursor: 'pointer',
        pointInterval: pointInterval
    }];
	
	if (data.targetProbV != null) {
		if (data.targetProbSum < PROB_THRESHOLD) {
			targetTransformFact = PROB_THRESHOLD / data.targetProbSum;
			for (var i = 0; i < data.targetProbV.length; i++) {
				data.targetProbV *= targetTransformFact;
			}
		}
		
		series[0].color = PREV_STATE_COLOR;
		series.push({
	        data: data.targetProbV,
	        color: HISTOGRAM_COLOR,
	        pointStart: start,
	        cursor: 'pointer',
	        pointInterval: pointInterval
	    });
	}
	
	if (data.allProbV != null) {
		series.unshift({
	        data: data.allProbV,
	        color: BACKGROUND_COLOR,
	        pointStart: start,
	        showInLegend: false,
	        animation: false,
	        enableMouseTracking: false,
	        events: {
	        	mouseOver: function () {
	        		return false;
	        	}
	        },
	        pointInterval: pointInterval
	    });
	}
	
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
	    	formatter: function (data) {
	    		var seriesN = this.series._i;
	    		
	    		var y;
	    		if (seriesN == 1) {
	    			y = toUiPrecision(100*(this.y / probTransformFact) / totalProb);
	    		} else if (seriesN == 2) {
	    			y = toUiPrecision(100*(this.y / targetTransformFact) / data.targetProbSum);
	    		}
	    			    		
	    		return 'x: ' + toUiPrecision(this.x) + ', y: ' + y + '%';
	    	}
	    },
	    plotOptions: {
	        column: {
	            groupPadding: 0,
	            pointPadding: 0,
	            borderWidth: 0,
	            
	            grouping: false,
	            shadow: false
	        }
	    },
	    series: series
	});
}