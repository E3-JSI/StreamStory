var SERIES_COLORS = ['#5bc0de', '#ED561B', '#555555', '#DDDF00', '#24CBE5', '#64E572', 
	             '#FF9655', '#FFF263', '#6AF9C4'];

function preprocessProbV(probV) {
	var PROB_THRESHOLD = .025;
	
	var probSum = 0;
	for (var i = 0; i < probV.length; i++) {
		probSum += probV[i];
	}
	
	if (probSum < PROB_THRESHOLD) {
		var ratio = PROB_THRESHOLD / probSum;
		for (var i = 0; i < probV.length; i++) {
			probV[i] *= ratio;
		}
	}
	
	return probV;
}

function drawHistogram(opts) {

	if (opts.xTicks == null) opts.xTicks = 4;
	if (opts.rotateX == null) opts.rotateX = 0;
	
	var probV, prevProbV;
	if (opts.data.targetProbV != null) {
		probV = preprocessProbV(opts.data.targetProbV);
		prevProbV = preprocessProbV(opts.data.probV);
	} else {
		probV = preprocessProbV(opts.data.probV);
		prevProbV = null;
	}
	
	var allProbV = opts.data.allProbV;
	var bins = opts.data.binValV;
	var dx = bins[1] - bins[0];
	
	var data = [];
	for (var i = 0; i < probV.length; i++) {
		var el = {
			val: bins[i],
			prob: probV[i]
		};
		
		if (allProbV != null) {
			el.totalProb = allProbV[i];
		}
		
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
	
	var xAxis = d3.svg.axis()
					.tickFormat(opts.formatX)
					.scale(x)
    				.orient("bottom")
    				.ticks(opts.xTicks);
	var yAxis = d3.svg.axis().scale(y)
    				.orient("left").ticks(5);
	
	
	var chart = d3.select('#' + opts.container)
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
	
	
	var getYForDomain = allProbV != null ? function (d) { return d.totalProb; } :
										   function (d) { return d.prob; }
	
	var xDomain = d3.extent(data, function(d) { return d.val; });
	xDomain[1] += dx;
	x.domain(xDomain);
    y.domain([0, d3.max(data, getYForDomain)]);
	
	chart.append("g")         // Add the X Axis
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
        .selectAll("text")
        .attr("transform", "rotate(" + opts.rotateX + ")");
	
	function getX(d) {
		return x(d.val);// - dx; // - x(dx);
	}
	
	function getY(d) {
		return y(d.prob);
	}
	
	var enter = chart.selectAll(".bar").data(data).enter();
	
	if (allProbV != null) {
		enter.append("rect")
			.attr("class", "bar-background")
			.attr("x", getX)
			.attr("width", binW - 1)
			.attr("y", function (d) { return y(d.totalProb); })
			.attr("height", function(d) { return height - y(d.totalProb); });
	}
	
	enter.append("rect")
      	.attr("class", "bar-foreground")
      	.attr("x", getX)
      	.attr("width", binW)//Math.max(1, binW - 1))
      	.attr("y", getY)
      	.attr("height", function(d) { return height - getY(d); });
	
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
}