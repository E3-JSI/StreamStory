var SERIES_COLORS = ['#5bc0de', '#555555', '#ED561B', '#DDDF00', '#24CBE5', '#64E572', 
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
	var data = opts.data;
	
	var totalProb = data.probSum;

	var min = data.binStartV[0];
	var max = data.binStartV[data.binStartV.length-1];
	
	var pointInterval = (max - min) / data.binStartV.length;
	var start = min - pointInterval / 2;
	
	var series = [{
        data: data.probV,
        pointStart: start,
        cursor: 'pointer',
        pointInterval: pointInterval
    }];
	
	if (data.allProbV != null) {
		series[0].color = SERIES_COLORS[0];
		series.unshift({
	        data: data.allProbV,
	        color: SERIES_COLORS[1],
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
	    		var idx = this.point.index;
	    		var y = series.length == 1 || this.series._i == 1 ? this.y : series[1].data[idx];
	    		return 'x: ' + toUiPrecision(this.x) + ', y: ' + toUiPrecision(100*y / totalProb) + '%';
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