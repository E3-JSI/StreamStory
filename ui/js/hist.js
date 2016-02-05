var SERIES_COLORS = ['#5bc0de', '#ED561B', '#555555', '#DDDF00', '#24CBE5', '#64E572', 
	             '#FF9655', '#FFF263', '#6AF9C4'];

//$(document).ready(function () {
//	// change Highcharts theme
//	Highcharts.theme = {
//	    colors: SERIES_COLORS,
//	    chart: {
//	        backgroundColor: '#1c1e22'
//	    },
//	    title: {
//	        style: {
//	            color: '#000',
//	            font: 'bold 16px "Trebuchet MS", Verdana, sans-serif'
//	        }
//	    },
//	    subtitle: {
//	        style: {
//	            color: '#666666',
//	            font: 'bold 12px "Trebuchet MS", Verdana, sans-serif'
//	        }
//	    },
//	
//	    legend: {
//	        itemStyle: {
//	            font: '9pt Trebuchet MS, Verdana, sans-serif',
//	            color: 'black'
//	        },
//	        itemHoverStyle:{
//	            color: 'gray'
//	        }   
//	    }
//	};
//	
//	// Apply the theme
//	Highcharts.setOptions(Highcharts.theme);
//});

function drawHistogram(opts) {

//	var HISTOGRAM_COLOR = SERIES_COLORS[0];
//	var PREV_STATE_COLOR = SERIES_COLORS[1];
//	var BACKGROUND_COLOR = SERIES_COLORS[2];
//	
//	var PROB_THRESHOLD = .05;
//	

//	
//	var totalProb = data.probSum;
//
//	var min = data.binStartV[0];
//	var max = data.binStartV[data.binStartV.length-1];
//	
//	var pointInterval = (max - min) / data.binStartV.length;
//	var start = min - pointInterval / 2;
//	
//	var probTransformFact = 1;
//	var targetTransformFact = 1;
//	
//	if (totalProb < PROB_THRESHOLD) {
//		probTransformFact = PROB_THRESHOLD / totalProb;
//		
//		for (var i = 0; i < data.probV.length; i++) {
//			data.probV[i] *= probTransformFact;
//		}
//	}
	
	var probV, prevProbV;
	if (opts.data.targetProbV != null) {
		probV = opts.data.targetProbV;
		prevProbV = opts.data.probV;
	} else {
		probV = opts.data.probV;
		prevProbV = null;
	}
	
	var allProbV = opts.data.allProbV;
	var bins = opts.data.binStartV;
	var dx = bins[1] - bins[0];
	
	var data = [];
	for (var i = 1; i < probV.length; i++) {
		var el = {
			val: bins[i-1],
			prob: probV[i],
			totalProb: allProbV[i]
		};
		
		if (prevProbV != null) {
			el.prevProb = prevProbV[i];
			el.overlap = Math.min(el.prevProb, el.prob);
		}
		
		data.push(el);
	}
	
	var container = $(document.getElementById(opts.container));
	
	var margin = {
		left: 0,
		right: 0,
		top: 0,
		bottom: 20
	}
	
	var width = container.width() - margin.left - margin.right;
	var height = container.height() - margin.top - margin.bottom;
	
	var binW = width / (data.length + 1);
	
	var x = d3.scale.linear().range([0, width]);
	var y = d3.scale.linear().range([height, 0]);
	
	var xAxis = d3.svg.axis().scale(x)
    				.orient("bottom").ticks(4);
	var yAxis = d3.svg.axis().scale(y)
    				.orient("left").ticks(5);
	
	
	var chart = d3.select('#' + opts.container)
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
	
	
	var xDomain = d3.extent(data, function(d) { return d.val; });
	xDomain[1] += dx;
	x.domain(xDomain);
    y.domain([0, d3.max(data, function(d) { return d.totalProb; })]);
	
	chart.append("g")         // Add the X Axis
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);
	
//	chart.append("g")         // Add the Y Axis
//        .attr("class", "y axis")
//        .call(yAxis);
	
	function getX(d) {
		return x(d.val) - dx;
	}
	
	var enter = chart.selectAll(".bar").data(data).enter();
	
	enter.append("rect")
		.attr("class", "bar-background")
		.attr("x", getX)
		.attr("width", binW - 1)
		.attr("y", function (d) { return y(d.totalProb); })
		.attr("height", function(d) { return height - y(d.totalProb); });
	
	enter.append("rect")
      	.attr("class", "bar-foreground")
      	.attr("x", getX)
      	.attr("width", binW - 1)
      	.attr("y", function (d) { return y(d.prob); })
      	.attr("height", function(d) { return height - y(d.prob); });
	
	if (prevProbV != null) {
		enter.append("rect")
      		.attr("class", "bar-previous")
      		.attr("x", getX)
      		.attr("width", binW - 1)
      		.attr("y", function (d) { return y(d.prevProb); })
      		.attr("height", function(d) { return height - y(d.prevProb); });
		
		enter.append("rect")
      		.attr("class", "bar-overlap")
      		.attr("x", getX)
      		.attr("width", binW - 1)
      		.attr("y", function (d) { return y(d.overlap); })
      		.attr("height", function(d) { return height - y(d.overlap); });
	}
	
//	chart.attr('width', width);
//	chart.attr('height', height);
//	
//	var x = d3.scale.linear()
//					.range([d3.min(data, function (d) { return d.val; }), d3.max(data, function (d) { return d.val; })])
//					.domain(data.map(function (d) { return d.val; }));
//	var y = d3.scale.linear()
//					.range([height, 0])
//					.domain([0, 1]);
//	
//	var xAxis = d3.svg.axis()
//					.scale(x)
//					.orient('bottom');
//	var yAxis = d3.svg.axis()
//					.scale(y)
//					.orient('left')
//					.ticks(10, '%');
//	
//	chart.append('g')
//			.attr('class', 'x axis')
//			.attr('transform', 'translate(0,' + height + ')')
//			.call(xAxis);
//	chart.append('g')
//			.attr('class', 'y axis')
//			.call(yAxis)
//			.append('text')
//			.attr('transform', 'rotate(-90)')
//			.attr('y', 6)
//			.attr("dy", ".71em")
//			.style("text-anchor", "end")
//			.text("%");
//	
//	chart.selectAll('.bar')
//			.data(data)
//			.enter().append('rect')
//			.attr('class', 'bar')
//			.attr('x', function (d, i) { return i*binW; })
//			.attr('width', binW)
//			.attr('y', function (d) { return (1 - d.prob)*height; })
//			.attr('height', function(d) { return d.prob*height; });
}