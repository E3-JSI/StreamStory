var SERIES_COLORS = [
    '#5bc0de',
    '#ED561B',
    '#555555',
    '#DDDF00',
    '#24CBE5',
    '#64E572',
    '#FF9655',
    '#FFF263',
    '#6AF9C4'
];

var HistogramType = {
	CATEGORICAL: 'categorical',
	NUMERIC: 'numeric'
}

function getProbV(countV) {
	var PROB_THRESHOLD = .025;
	
	var probV = new Array(countV.length);
	
	var sum = 0;
	for (var i = 0; i < countV.length; i++) {
		sum += countV[i];
	}
	
	for (var i = 0; i < countV.length; i++) {
		probV[i] = countV[i] / sum;
	}
	
	if (sum < PROB_THRESHOLD) {
		var ratio = PROB_THRESHOLD / sum;
		for (var i = 0; i < probV.length; i++) {
			probV[i] *= ratio;
		}
	}
	
	return probV;
}

function drawHistogram(opts) {

	if (opts.xTicks == null) opts.xTicks = 4;
	if (opts.rotateX == null) opts.rotateX = 0;
	if (opts.topPadding == null) opts.topPadding = 0;
	if (opts.bottomPadding == null) opts.bottomPadding = 20;
	if (opts.labelXOffsetPerc == null) opts.labelXOffsetPerc = 0;
	if (opts.data.type == null) opts.data.type = HistogramType.NUMERIC;
	
	var histogramType = opts.data.type;
	
	// number of ticks on the x-axis
	if (histogramType == HistogramType.CATEGORICAL) {
		opts.xTicks = opts.data.countV.length;
//		opts.formatX = function (val) { return 'A'; }
	} else if (histogramType == HistogramType.NUMERIC) {
		if (opts.xTicks == null) opts.xTicks = 4;
	} else {
		throw new Error('Unknown histogram type: ' + histogramType);
	}
	
	var countV, prevCountV;
	var probV, prevProbV;
	
	if (opts.data.targetCountV != null) {
		countV = opts.data.targetCountV;
		prevCountV = opts.data.countV;
		
		probV = getProbV(countV);
		prevProbV = getProbV(prevCountV);
	} else {
		countV = opts.data.countV;
		prevCountV = null;
		
		probV = getProbV(countV);
		prevProbV = null;
	}
	
	var allCountV = opts.data.allCountV;
	var allProbV = allCountV != null ? getProbV(allCountV) : null;
	
	var bins = opts.data.binValV;
	var dx;
	if (histogramType == HistogramType.CATEGORICAL) {
		dx = 1;
	}
	else {
		dx = bins[1] - bins[0];
	}
	
	
	var totalProb = 1;
	var prevTotalProb = 1;
	
	if (allCountV != null) {
		var allTotalCount = 0;
		var totalCount = opts.data.totalCount;
		
		for (var countN = 0; countN < allCountV.length; countN++) {
			allTotalCount += allCountV[countN];
		}
		
		var ratio = totalCount / allTotalCount;
		for (var i = 0; i < probV.length; i++) {
			probV[i] *= ratio;
		}
		
		totalProb = ratio;
		
		if (prevCountV != null) {
			var prevTotalCount = 0;
			
			for (var i = 0; i < prevCountV.length; i++) {
				prevTotalCount += prevCountV[i];
			}
			
			var prevRatio = prevTotalCount / allTotalCount;
			
			for (var i = 0; i < prevProbV.length; i++) {
				prevProbV[i] *= prevRatio;
			}
			
			prevTotalProb = prevRatio;
		}
	}
	
	var data = [];
	for (var i = 0; i < probV.length; i++) {
		var el = {
			val: bins[i],
			prob: probV[i],
			count: countV[i]
		};
		
		if (allProbV != null) {
			el.totalProb = allProbV[i];
			el.totalCount = allCountV[i];
		}
		
		if (prevProbV != null) {
			el.prevProb = prevProbV[i],
			el.prevCount = prevCountV[i];
			el.overlap = Math.min(el.prevProb, el.prob);
		}
		
		data.push(el);
	}
	
	
	if (histogramType == HistogramType.CATEGORICAL) {
		// only keep the 10 most probable elements
		data.sort(function (el0, el1) {
			return el1.prob - el0.prob;
		});
		
		data.splice(10, data.length);
		bins = [];
		for (var i = 0; i < data.length; i++) {
			data[i].val = (i+1) + '';
			bins[i] = data[i].val;
		}
	}
	
	var container = $(document.getElementById(opts.container));
	
	var margin = {
		left: 0,
		right: 0,
		top: opts.topPadding,
		bottom: opts.bottomPadding
	}
	
	var containerW = opts.width != null ? opts.width : container.width();
	var containerH = opts.height != null ? opts.height : container.height();
	
	var width = containerW - margin.left - margin.right// - 1;
	var height = containerH - margin.top - margin.bottom;
	
	var binW = width / (data.length + 1);
	var recW = binW - 1;
	
	var yTicks = 5;
	
	var x;
	var y;
	var xAxis;
	var yAxis;
	if (histogramType == HistogramType.NUMERIC) {
		x = d3.scale.linear().range([0, width]);
		y = d3.scale.linear().range([height, 0]);
		
		xAxis = d3.svg.axis()
			.tickFormat(opts.formatX)
			.scale(x)
			.orient("bottom")
			.ticks(opts.xTicks);
		yAxis = d3.svg.axis().scale(y)
			.orient("left").ticks(yTicks);	
	}
	else {
		x = d3.scale.ordinal()
			.rangeBands([0, width])
	    	.domain(bins);
		y = d3.scale.linear().range([height, 0]);
		
		xAxis = d3.svg.axis()
			.tickFormat(opts.formatX)
			.scale(x)
			.orient("bottom")
			.ticks(opts.xTicks);
		yAxis = d3.svg.axis().scale(y)
			.orient("left").ticks(yTicks);
	}
	
	var chart = d3.select('#' + opts.container)
			.append('svg')
			.attr('width', width + margin.left + margin.right)
			.attr('height', height + margin.top + margin.bottom)
			.append('g')
			.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
	
	
	var getYForDomain = allProbV != null ? function (d) { return d.totalProb; } :
										   function (d) { return d.prob; }
	
	if (histogramType == HistogramType.NUMERIC) {
		var xDomain = d3.extent(data, function(d) { return d.val; });
		xDomain[1] += dx;
		x.domain(xDomain);
	}
    y.domain([0, d3.max(data, getYForDomain)]);
	
	chart.append("g")         // Add the X Axis
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .attr('width', width)
        .call(xAxis)
        .selectAll("text")
        .attr('x', function (d) {
        	return opts.labelXOffsetPerc*binW;
        })
        .attr('y', function () {
        	return opts.bottomPadding/2;
        })
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(" + opts.rotateX + ")");
	
	// create tooltips
	var tip = d3.tip()
		  .attr('class', 'd3-tip')
		  .offset([-10, 0])
		  .html(function(d) {
			  return '<span>' + toUiPrecision(d.prob / totalProb) + ' (' + d.count + ')</span>';
		  });
	
	
	chart.call(tip);
	
	if (prevProbV != null) {
		var prevTip = d3.tip()
			.attr('class', 'd3-tip')
			.offset([-10, 0])
			.html(function(d) {
				return '<span>' + toUiPrecision(d.prevProb / prevTotalProb) + ' (' + d.prevCount + ')</span>';
			});
		chart.call(prevTip);
	}
	
	function getX(d) {
		if (histogramType == HistogramType.NUMERIC) {
			return x(d.val + dx/2) - recW / 2;
		} else if (histogramType == HistogramType.CATEGORICAL) {
			return x(d.val);
		} else {
			throw new Error('Unknown histogram type: ' + histogramType);
		}
	}
	
	// create the bars
	var enter = chart.selectAll(".bar").data(data).enter();

	if (allProbV != null) {
		enter.append("rect")
			.attr("class", "bar-background")
			.attr("x", getX)
			.attr("width", recW)
			.attr("y", function (d) { return y(d.totalProb); })
			.attr("height", function(d) { return height - y(d.totalProb); });
	}
	
	enter.append("rect")
      	.attr("class", "bar-foreground")
      	.attr("x", getX)
      	.attr("width", recW)//Math.max(1, binW - 1))
      	.attr("y", function (d) {
      		return y(d.prob);
      	})
      	.attr("height", function(d) {
      		return height - y(d.prob);
      	}).on('mouseover', tip.show)
		.on('mouseout', tip.hide);
	
	if (prevProbV != null) {
		enter.append("rect")
      		.attr("class", "bar-previous")
      		.attr("x", getX)
      		.attr("width", recW)
      		.attr("y", function (d) { return y(d.prevProb); })
      		.attr("height", function(d) { return height - y(d.prevProb); })
      		.on('mouseover', prevTip.show)
      		.on('mouseout', prevTip.hide);
		
		enter.append("rect")
      		.attr("class", "bar-overlap")
      		.attr("x", getX)
      		.attr("width", recW)
      		.attr("y", function (d) { return y(d.overlap); })
      		.attr("height", function(d) { return height - y(d.overlap); });
	}
}
