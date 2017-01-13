/* exported zoomVis */

var zoomVis = function (opts) {

    var visContainer = document.getElementById(opts.visContainer);

    var MODE_NORMAL = 'normal';
    var MODE_PROBS = 'probs';
    var MODE_TARGET_FTR = 'ftr';
    var MODE_ACTIVITY = 'activity';

    // colors
    var DEFAULT_NODE_COLOR;
    var CURRENT_NODE_COLOR;
    var FUTURE_NODE_BASE_COLOR;
    var DEFAULT_BORDER_COLOR;
    var VIZ_NODE_COLOR;
    var VIZ_NODE_FTR_NEG_COLOR;
    var VIZ_NODE_FTR_POS_COLOR;

    var EDGE_COLOR;
    var BOLD_EDGE_COLOR;
    var MIDDLE_EDGE_COLOR;
    var SMALL_EDGE_COLOR;
    var EDGE_TEXT_COLOR;

    if (THEME == 'light') {
        DEFAULT_NODE_COLOR = '#A9A9A9';
        CURRENT_NODE_COLOR = '#33CC00';
        FUTURE_NODE_BASE_COLOR = 216;

        DEFAULT_BORDER_COLOR = '#5A5A5A';

        VIZ_NODE_COLOR = 360;
        VIZ_NODE_FTR_NEG_COLOR = 360;
        VIZ_NODE_FTR_POS_COLOR = 117;

        EDGE_COLOR = 'darkgray';
        BOLD_EDGE_COLOR = '#A0A0A0';
        MIDDLE_EDGE_COLOR = '#606060';
        SMALL_EDGE_COLOR = '#707070';
        EDGE_TEXT_COLOR = '#000000';
    } else {
        DEFAULT_NODE_COLOR = '#073642';
        CURRENT_NODE_COLOR = '#FFA500';
        FUTURE_NODE_BASE_COLOR = 216;	// green

        DEFAULT_BORDER_COLOR = 'rgb(150, 150, 150)';

        VIZ_NODE_COLOR = 360;
        VIZ_NODE_FTR_NEG_COLOR = 360;
        VIZ_NODE_FTR_POS_COLOR = 117;

        EDGE_COLOR = 'darkgray';
        BOLD_EDGE_COLOR = '#A0A0A0';
        MIDDLE_EDGE_COLOR = '#606060';
        SMALL_EDGE_COLOR = '#606060';
        EDGE_TEXT_COLOR = '#F0F0F0';
    }

    // var PREVIOUS_NODE_EDGE_COLOR = CURRENT_NODE_COLOR;

    var SELECTED_NODE_SHADOW_COLOR = 'white';
    var SELECTED_NODE_SHADOW_SIZE = 100;
    var SELECTED_NODE_SHADOW_OPACITY = 1;

    var FONT_SIZE = '12';
    var DEFAULT_BORDER_WIDTH = 5;
    var CURRENT_BORDER_WIDTH = 10;

    var BACKGROUND_Z_INDEX = 0;
    var MIDDLEGROUND_Z_INDEX = 10;
    var FOREGROUND_Z_INDEX = 20;

    // size
    var MIN_NODE_DIAMETER = 40;

    //====================================================
    // TOOLTIPS
    //====================================================

    var DEFAULT_QTIP_OPTS = {
        position: {
            my: 'bottom center',
            at: 'top center'
        },
        style: {
            classes: 'qtip-bootstrap',
            tip: {
                width: 16,
                height: 8
            }
        },
        show: {
            solo: true,
            event: 'mouseover'
        },
        hide: {
            event: 'click mouseout',
            fixed: true
        }
    }

    var nodeQtipOpts = clone(DEFAULT_QTIP_OPTS);
    var edgeQtipOpts = clone(DEFAULT_QTIP_OPTS);

    (function () {
        nodeQtipOpts.content = function (event, api) {
            var data = this.data();
            var name = data.style.content;//name;
            var label = data.style.label;

            // async sections
            var ruleExplainDiv = $('<div />');
            var undesiredDiv = $('<div />');
            var narrationDiv = $('<div />');
            var timeIntervalDiv = $('<div />');

            var asyncExecute = StreamStory.Utils.asyncExecutor(function () {
                var tt = $('<div />');

                // name
                if (name != null) {
                    var nameDiv = $('<h3 />');
                    nameDiv.html(name + ' (' + label + ')');
                    tt.append(nameDiv);
                }
                // time
                var timeDiv = $('<div />');
                timeDiv.html('Typically lasts <strong>' + data.holdingTime.toPrecision(2) + ' ' + getTimeUnit() + 's</strong>');

                // async stuff
                tt.append(undesiredDiv);
                tt.append(narrationDiv);
                tt.append(timeDiv);
                tt.append(timeIntervalDiv);
                tt.append(ruleExplainDiv);

                api.set('content.text', tt.html());
                // api.reposition(undefined, false);
            });

            // rule explanation
            (function () {
                ruleExplainDiv.attr('id', 'div-explain-' + data.id);
                ruleExplainDiv.addClass('tooltip-div-explain');
                if ($('#div-explain-' + data.id).html() != null) {
                    ruleExplainDiv.html($('#div-explain-' + data.id).html());
                }

                asyncExecute(function (done) {
                    $.ajax('api/explanation', {
                        dataType: 'json',
                        method: 'GET',
                        data: { stateId: getServerNodeId(data.id) },
                        success: function (union) {
                            var score = function (interserct) {
                                return interserct.covered*interserct.purity;
                            }

                            union.sort(function (inter1, inter2) {
                                return score(inter2) - score(inter1);
                            });

                            var bestScore = score(union[0]);
                            var lastN = 0;
                            while (lastN < union.length-1 && score(union[lastN+1]) > bestScore / 10) {
                                lastN++;
                            }

                            if (union.length > 1) {
                                union.splice(lastN+1);
                            }

                            // construct the rules
                            var unionStr = '';
                            for (var i = 0; i < union.length; i++) {
                                var intersect = union[i];
                                var intersectStr = '';
                                var terms = intersect.terms;

                                // sort the terms
                                terms.sort(function (t1, t2) {
                                    if (t2.feature < t1.feature)
                                        return -1;
                                    else if (t2.feature > t1.feature)
                                        return 1;
                                    else return 0;
                                });

                                for (var j = 0; j < terms.length; j++) {
                                    var term = terms[j];

                                    intersectStr += '&#09;';

                                    if (term.le != null || term.gt != null) {
                                        if (term.le != null && term.gt != null) {
                                            intersectStr += term.feature + ' &isin; (' + toUiPrecision(term.gt) + ', ' + toUiPrecision(term.le) + ']';
                                        } else if (term.le != null) {
                                            intersectStr += term.feature + ' \u2264 ' + toUiPrecision(term.le);
                                        } else {
                                            intersectStr += term.feature + ' > ' + toUiPrecision(term.gt);
                                        }
                                    }
                                    else if (term.eq != null) {
                                        intersectStr += term.feature + ' = ' + term.eq;
                                    }
                                    else if (term.neq != null) {
                                        intersectStr += term.feature + ' \u2260 ' + term.neq;
                                    }
                                    else {
                                        throw new Error('Feature explanation le, gt, eq and neq are all NULL!');
                                    }

                                    if (j < terms.length-1)
                                        intersectStr += '<br />';
                                }

                                unionStr += '<br />' + intersectStr + '<br />';

                                if (i < union.length-1) {
                                    unionStr += '<br />';
                                }
                            }

                            ruleExplainDiv.html('It can be characterized by the following rules:<br />' + unionStr);

                            done();
                        },
                        error: handleAjaxError(null, done)
                    });
                })
            })();

            // event id
            (function () {
                undesiredDiv.attr('id', 'div-tooltip-undesired-' + data.id);
                undesiredDiv.addClass('tooltip-undesired');
                if ($('#div-tooltip-undesired-' + data.id).html() != null) {
                    undesiredDiv.html($('#div-tooltip-undesired-' + data.id).html());
                }

                asyncExecute(function (done) {
                    $.ajax('api/targetProperties', {
                        dataType: 'json',
                        method: 'GET',
                        data: { stateId: getServerNodeId(data.id) },
                        success: function (props) {
                            if (props.isUndesired) {
                                undesiredDiv.html('Event id: ' + props.eventId);
                            } else {
                                undesiredDiv.html('');
                            }

                            done();
                        },
                        error: handleAjaxError(null, done)
                    });
                })
            })();

            // state narration
            (function () {
                narrationDiv.attr('id', 'div-narration-' + data.id);
                narrationDiv.addClass('tooltip-div-narration');
                if ($('#div-narration-' + data.id).html() != null) {
                    narrationDiv.html($('#div-narration-' + data.id).html());
                }

                asyncExecute(function (done) {
                    $.ajax('api/stateNarration', {
                        dataType: 'json',
                        method: 'GET',
                        data: { stateId: getServerNodeId(data.id) },
                        success: function (narration) {
                            if (narration.length == 0) return done();

                            var p = $('<p />');
                            var html = 'The state is characterized by ';

                            var n = Math.min(3, narration.length);
                            for (var i = 0; i < n; i++) {
                                var item = narration[i];

                                var ftr = item.ftrId;
                                var type = item.type;
                                switch (type) {
                                    case 'numeric': {
                                        var level = item.ftrDesc;
                                        html += '<strong>' + level + ' ' + ftr + '</strong>';
                                        break;
                                    }
                                    case 'categorical': {
                                        html += '<strong>' + ftr + ' is ' + item.bin + '</strong>';
                                        break;
                                    }
                                    default: {
                                        throw new Error('Unknown feature type: ' + type);
                                    }
                                }

                                if (i < n - 2) {
                                    html += ', ';
                                } else if (i == n - 2) {
                                    html += ' and ';
                                }
                            }

                            p.html(html);
                            narrationDiv.html('').append(p);

                            done();
                        },
                        error: handleAjaxError(null, done)
                    });
                })
            })();

            // time explanation
            (function () {
                timeIntervalDiv.attr('id', 'div-tminterval-' + data.id);
                timeIntervalDiv.addClass('tooltip-div-tminterval');
                if ($('#div-tminterval-' + data.id).html() != null) {
                    timeIntervalDiv.html($('#div-tminterval-' + data.id).html());
                }

                asyncExecute(function (done) {
                    $.ajax('api/timeExplain', {
                        dataType: 'json',
                        method: 'GET',
                        data: { stateId: getServerNodeId(data.id) },
                        success: function (timeExplain) {
                            if (timeExplain == null || timeExplain.length == 0) return done();

                            var p = $('<p />');
                            // var html = 'The state occurs ';
                            var html = '';

                            for (var i = 0; i < timeExplain.length; i++) {
                                var item = timeExplain[i];

                                var start = item.start;
                                var end = item.end;

                                if (start != end) {
                                    html += ' between <strong>' + start + '</strong> and <strong>' + end + '</strong>'
                                } else {
                                    html += ' in <strong>' + start + '</strong>';
                                }

                                if (i < timeExplain.length - 1) {
                                    html += ', ';
                                }
                            }

                            p.html(html);
                            timeIntervalDiv.html('').append(p);

                            done();
                        },
                        error: handleAjaxError(null, done)
                    });
                })
            })();

            return 'Loading ...';
        };
    })();

    nodeQtipOpts.show.event = 'hover';
    nodeQtipOpts.hide.event = 'hovercancel';

    edgeQtipOpts.content = function () {
        return 'Probability ' + this.data().prob.toPrecision(2)
    };
    edgeQtipOpts.show.event = 'hover';
    edgeQtipOpts.hide.event = 'hovercancel';
    edgeQtipOpts.hide.inactive = 3000;


    var TARGET_NODE_CSS = {
        'background-image-opacity': 0.2,
        'background-fit': 'cover',
        'border-style': 'double'
    }

    var hierarchy = null;
    var modeConfig = {
        selected: null,
        current: null,
        future: {},
        past: {},
        mode: { type: MODE_NORMAL, config: {} },
    };

    var drawEdgeVals = false;
    var scrollZoomEnabled = false;

    var uiConfig = {
        maxNodeSize: 0,
        levelMaxNodeSize: []
    }

    var callbacks = {
        stateSelected: function () {},
        edgeSelected: function () {},
        zoomChanged: function () {},
        heightChanged: function () {},
        onStateCtxMenu: function () {},
        onInitialized: function () {}
    }

    var minCyZoom = 0.3;
    var maxCyZoom = 1.3;
    var fontFactor = 1;

    var ZOOM_STEPS = 100;
    var heightStep;// = 0.01;

    var minHeight = 0;
    var maxHeight = 0;
    var currentHeight = 0;
    var currentLevel = 0;

    var levelNodes = [];
    var levelJumps = [];
    var levelHeights = [];
    var levelCurrentStates = [];
    var levelNodeMap = {};

    var minX = Number.POSITIVE_INFINITY;
    var maxX = Number.NEGATIVE_INFINITY;
    var minY = Number.POSITIVE_INFINITY;
    var maxY = Number.NEGATIVE_INFINITY;
    var xOffset = 0.1;
    var yOffset = 0.1;

    var transitionThreshold = 1;

    var boundingBox = {
        x: { min: Number.MAX_VALUE, max: Number.MIN_VALUE },
        y: { min: Number.MAX_VALUE, max: Number.MIN_VALUE }
    }

    var parentH = {};

    //===============================================================
    // UTILITY FUNCTIONS
    //===============================================================

    var colorGenerator = (function () {
        var MIN_SATURATION = 0.15;
        var DEFAULT_LIGHT = 0.5;

        var colorH = {};


        var that = {
            init: function (levels) {
                colorH = {};

                var nLevels = levels.length;

                // generate the colors on the lowest scale
                var childH = {};
                var nodeH = {};

                // construct the top-down hierarchy
                (function () {
                    for (var levelN = 0; levelN < nLevels; levelN++) {
                        var level = levels[levelN];
                        var states = level.states;

                        for (var stateN = 0; stateN < states.length; stateN++) {
                            var state = states[stateN];
                            var nodeId = state.id;
                            var parentId = state.parentId;

                            if (parentId != null && parentId != nodeId) {
                                if (!(parentId in childH)) { childH[parentId] = []; }

                                if (childH[parentId].indexOf(nodeId) < 0) {
                                    childH[parentId].push(nodeId);
                                }
                            }

                            nodeH[nodeId] = state;
                        }
                    }
                })();

                // color the states
                // first color the leafs
                (function () {
                    var nLeafs = levels[0].states.length;

                    var angle = 2*Math.PI / nLeafs;
                    var currAngle = 0;

                    function colorLeafs(parentId) {
                        if (parentId in childH) {
                            var children = childH[parentId];
                            for (var i = 0; i < children.length; i++) {
                                colorLeafs(children[i]);
                            }
                        }
                        else {
                            colorH[parentId] = {
                                hue: currAngle,
                                saturation: 1,
                                light: DEFAULT_LIGHT
                            };
                            currAngle += angle;
                        }
                    }

                    var lastLevel = levels[levels.length-1];
                    var rootStates = lastLevel.states;

                    for (var stateN = 0; stateN < rootStates.length; stateN++) {
                        colorLeafs(rootStates[stateN].id);
                    }
                })();

                // then color all the others
                (function () {
                    for (var levelN = 1; levelN < nLevels; levelN++) {
                        var level = levels[levelN];
                        var states = level.states;

                        for (var stateN = 0; stateN < states.length; stateN++) {
                            var state = states[stateN];
                            var nodeId = state.id;

                            if (nodeId in colorH) continue;

                            var children = childH[nodeId];

                            var hue = 0;
                            var totalWgt = 0;
                            for (var i = 0; i < children.length; i++) {
                                var childId = children[i];
                                var wgt = nodeH[childId].timeProportion;

                                hue += colorH[childId].hue*wgt;
                                totalWgt += wgt;
                            }
                            hue /= totalWgt;

                            colorH[nodeId] = {
                                hue: hue,
                                saturation: 1 - levelN*(1 - MIN_SATURATION) / (levels.length - 1),
                                light: DEFAULT_LIGHT
                            };
                        }
                    }
                })();
            },
            getColorStr: function (nodeId) {
                return getHslStr(that.getColor(nodeId));
            },
            getColor: function (nodeId) {
                if (!(nodeId in colorH)) { return undefined; }
                return clone(colorH[nodeId]);
            },
            getComplementaryColorStr: function (nodeId)	 {
                var color = that.getColor(nodeId);

                var h = color.hue;
                var s = color.saturation;
                var l = color.light;

                var rgb = hsl2rgb(h, s, l);

                return getBrightness(rgb) >= 0.5 ? '#000000' : '#F0F0F0';
            },
            toColorStr: function (color) {
                return getHslStr(color)
            }
        }

        return that;
    })();

    var ElementCache = function () {
        var nodeCache = {};

        var prevLevelNodeCache = {};
        var currLevelNodeCache = {};
        var addedNodes = [];

        var that = {
            addNode: function (id, level, nodeConfig) {
                nodeCache[id] = nodeConfig;
            },
            getNode: function (id) {
                return nodeCache[id];
            },
            getNodes: function () {
                return nodeCache;
            },
            startNewNodeLevel: function () {
                addedNodes = [];
                prevLevelNodeCache = currLevelNodeCache;
                currLevelNodeCache = {};
            },
            updateLevelNode: function (id) {
                if (!(id in currLevelNodeCache)) {
                    currLevelNodeCache[id] = true;

                    if (!(id in prevLevelNodeCache))
                        addedNodes.push(nodeCache[id]);
                    else
                        delete prevLevelNodeCache[id];
                }
            },
            getModifiedNodes: function () {
                var removed = [];

                for (var id in prevLevelNodeCache) {
                    removed.push(id);
                }

                return {
                    added: addedNodes,
                    removed: removed
                }
            },
            clear: function () {
                nodeCache = {};
                prevLevelNodeCache = {};
                currLevelNodeCache = {};
                addedNodes = [];
            },
            updateCss: function (property, value) {
                for (var nodeId in nodeCache) {
                    nodeCache[nodeId].css[property] = value;
                }
            }
        };

        return that;
    }

    var cache = ElementCache();

    //===============================================================
    // UTILITY FUNCTIONS
    //===============================================================

    function getServerNodeId(id) {
        if (id == null) { return id; }
        return parseInt(id) & 0xFFFF;
    }

    function getNodeLabel(node) {
        var label = node.name != null ? node.name : node.autoName;

        if (label == null) label = '';//node.label;

        var spl = label.split(/\s+/);
        var maxLineLen = 10;

        var result = '';
        var lineLen = 0;
        for (var i = 0; i < spl.length; i++) {
            result += spl[i];
            lineLen += spl[i].length;
            if (lineLen > maxLineLen && i < spl.length - 1) {
                result += '\n';
                lineLen = 0;
            } else if (i < spl.length - 1) {
                result += ' ';
            }
        }

        return result;
    }

    // function colorFromProb(prob) {
    // 	return prob*prob;
    // }

    function futureColorFromProb(prob) {
        return Math.sqrt(prob);
    }

    function minAndMaxCoords() {
        // get the num and max of the server centers
        (function () {
            for (var i = 0; i < levelNodes.length; i++) {
                for (var j = 0; j < levelNodes[i].length; j++) {
                    var node = levelNodes[i][j];
                    var x = node.x, y = node.y;
                    if (x < minX) minX = x
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        })();

        // get the bounding box
        (function () {
            for (var i = 0; i < levelNodes.length; i++) {
                for (var j = 0; j < levelNodes[i].length; j++) {
                    var node = levelNodes[i][j];
                    var pos = cyPosition(node);
                    var size = cySize(node.radius);
                    var x = pos.x, y = pos.y;

                    var halfW = size.width / 2;
                    var halfH = size.height / 2;

                    if (x - halfW < boundingBox.x.min) boundingBox.x.min = x - halfW;
                    if (x + halfW > boundingBox.x.max) boundingBox.x.max = x + halfW;
                    if (y - halfH < boundingBox.y.min) boundingBox.y.min = y - halfH;
                    if (y + halfH > boundingBox.y.max) boundingBox.y.max = y + halfH;
                }
            }
        })();
    }

    function cyPosition(node) {
        return {
            x: cy.width() * (xOffset + (1 - 2*xOffset) * (node.x - minX) / (maxX - minX)),
            y: cy.height() * (yOffset + (1 - 2*yOffset) * (node.y - minY) / (maxY - minY))
        };
    }

    function serverPosition(pos) {
        var w = cy.width();
        var h = cy.height();
        return {
            x: minX + (pos.x - w*xOffset)*(maxX - minX) / (w*(1 - 2*xOffset)),
            y: minY + (pos.y - h*yOffset)*(maxY - minY) / (h*(1 - 2*yOffset))
        }
    }

    function cySize(radius) {
        var scaleX = (1 - 2*xOffset)*cy.width() / (maxX - minX);
        var scaleY = (1 - 2*yOffset)*cy.height() / (maxY - minY);
        var scale = Math.min(scaleX, scaleY);

        var diameter = 2*radius;

        return {
            width: Math.max(scale * diameter, MIN_NODE_DIAMETER),
            height: Math.max(scale * diameter, MIN_NODE_DIAMETER)
        };
    }

    function calcCyPan(newZoom) {
        if (newZoom < minCyZoom) newZoom = minCyZoom;
        if (newZoom > maxCyZoom) newZoom = maxCyZoom;

        var width = cy.width();
        var height = cy.height();
        var pan = cy.pan();
        var zoom = cy.zoom();

        var centerX = (width - 2*pan.x) / zoom;
        var centerY = (height - 2*pan.y) / zoom;

        return {
            x: (width - newZoom*centerX) / 2,
            y: (height - newZoom*centerY) / 2
        }
    }

    function setZoom(newZoom, fireEvent) {
        if (fireEvent == null) fireEvent = true;

        cy.viewport({zoom: newZoom, pan: calcCyPan(newZoom)});
        if (fireEvent) {
            callbacks.zoomChanged(newZoom);
        }
    }

    function setViewport(bb, fireEvent) {
        if (fireEvent == null) fireEvent = true;

        var cyWidth = cy.width();
        var cyHeight = cy.height();

        var width = bb.x.max - bb.x.min;
        var height = bb.y.max - bb.y.min;

        var paddingX = xOffset*cyWidth;
        var paddingY = yOffset*cyHeight;

        var zoom = Math.min((cyWidth - 2*paddingX) / width, (cyHeight - 2*paddingY) / height);
        var pan = { // now pan to middle
            x: (cyWidth - zoom*(bb.x.min + bb.x.max))/2,
            y: (cyHeight - zoom*(bb.y.min + bb.y.max))/2
        };

        cy.viewport({zoom: zoom, pan: pan});

        if (fireEvent) {
            callbacks.zoomChanged(zoom);
        }
    }

    //===============================================================
    // CLEAR FUNCTIONS
    //===============================================================

    function clear(isInBatch) {
        if (!isInBatch)
            cy.startBatch();

        cy.remove(cy.nodes());
        cy.remove(cy.edges());
        cache.clear();

        if (!isInBatch)
            cy.endBatch();
    }

    function clearStructures() {
        uiConfig.maxNodeSize = 0;
        uiConfig.levelMaxNodeSize = [];

        levelHeights = [];
        levelJumps = [];
        levelCurrentStates = [];
        levelNodes = [];
        levelNodeMap = {};

        parentH = {};
    }

    //===============================================================
    // DRAW FUNCTIONS
    //===============================================================

    function drawTransitionText(edge) {
        var show = drawEdgeVals;

        var data = edge.data();
        var prob = data.prob;

        if (prob > 0.2 || prob == edge.source().data().maxProb)
            show = true;

        edge.css({ content: show ? toUiPrecision(prob) : '' });
    }

    function getEdgeConfig(sourceN, targetN, transitions, nodeInfo, cumProb, maxProb) {
        var sourceId = nodeInfo[sourceN].id;
        var targetId = nodeInfo[targetN].id;

        var id = sourceId + '-' + targetId;
        var val = transitions[targetN];

        var css = {
            'text-transform': 'none',
            'text-halign': 'center',
            'text-valign': 'center',
            'color': EDGE_TEXT_COLOR,
            'font-style': 'normal',
            'font-size': FONT_SIZE,
            'font-family': 'inherit',
            'font-weight': 'normal',
            'target-arrow-shape': 'triangle',
            'source-arrow-shape': 'none',
            'display': 'element',
            'haystack-radius': 0,
            'curve-style': 'bezier',
            'control-point-step-size': 100,
            // 'text-valign': 'top',
            'control-point-weight': 0.5,
            'line-style': 'dotted',
            'line-color': SMALL_EDGE_COLOR,
            'target-arrow-color': SMALL_EDGE_COLOR,
            'width': Math.max(1, (val*10).toFixed()),
            'z-index': 100,
            'content': ''
        };

        var data = {
            id: id,
            source: sourceId,
            target: targetId,
            style: css,
            prob: val,
            cumProb: cumProb,
            maxProb: maxProb
        };

        return {
            group: 'edges',
            data: data,
            css: css
        };
    }

    function getEdgesAboveThreshold(transitions) {
        var edges = [];
        var cumProbs = [];
        var probs = [];

        var k;
        for (k = 0; k < transitions.length; k++) {
            probs.push({prob: transitions[k], idx: k});
        }

        probs.sort(function (a, b) {
            return b.prob - a.prob;
        })

        var cumProb = 0;
        k = 0;
        while (k < probs.length && probs[k].prob > 0 && cumProb <= transitionThreshold) {
            edges.push(probs[k].idx);
            cumProbs.push(1 - cumProb);
            cumProb += probs[k].prob;
            k++;
        }

        return {
            maxProb: probs[0].prob,
            edges: edges,
            cumProbs: cumProbs
        }
    }

    function getEdgesWithSource(sourceN, transitions, nodeInfo) {
        var result = [];

        var aboveThreshold = getEdgesAboveThreshold(transitions);
        var maxVal = aboveThreshold.maxProb;
        var edges = aboveThreshold.edges;
        var cumProbs = aboveThreshold.cumProbs;

        for (var i = 0; i < edges.length; i++) {
            var targetN = edges[i];
            result.push(getEdgeConfig(sourceN, targetN, transitions, nodeInfo, cumProbs[i], maxVal));
        }

        return result;
    }

    function getEdgesWithTarget(targetN, transitionMat, nodeInfo) {
        var result = [];

        for (var sourceN = 0; sourceN < transitionMat.length; sourceN++) {
            if (sourceN == targetN) continue;

            var aboveThreshold = getEdgesAboveThreshold(transitionMat[sourceN]);
            var maxVal = aboveThreshold.maxProb;
            var edges = aboveThreshold.edges;
            var cumProbs = aboveThreshold.cumProbs;

            var idx;
            if ((idx = edges.indexOf(targetN)) >= 0) {
                result.push(getEdgeConfig(sourceN, targetN, transitionMat[sourceN], nodeInfo, cumProbs[idx], maxVal));
            }
        }

        return result;
    }

    function insertLevel(level) {
        var levelInfo = levelNodes[level];

        cache.startNewNodeLevel();

        var nodeIdxs = {};

        // add/remove nodes
        var node;
        var nodeN;
        var i;
        for (i = 0; i < levelInfo.length; i++) {
            node = levelInfo[i];
            var id = node.id;

            nodeIdxs[id] = i;

            if (cache.getNode(id) == null) {
                var position = cyPosition(node);
                var nodeSize = cySize(levelInfo[i].radius);
                var label = getNodeLabel(node);

                var style = {
                    'content': label,//node.label,
                    'text-transform': 'none',
                    'text-halign': 'center',
                    'text-valign': 'center',
                    'text-wrap': 'wrap',
                    'color': colorGenerator.getComplementaryColorStr(id),
                    'font-style': 'normal',
                    'font-size': 10000,	// hack, for automatic font size
                    'font-factor': fontFactor,
                    'font-family': 'inherit',
                    'font-weight': 'normal',
                    'shape': 'ellipse',
                    'display': 'element',
                    'background-color': colorGenerator.getColorStr(id),
                    'width': nodeSize.width,
                    'height': nodeSize.height,
                    'border-width': DEFAULT_BORDER_WIDTH,
                    'border-color': DEFAULT_BORDER_COLOR,
                    'label': node.label,
                    'z-index': BACKGROUND_Z_INDEX
                }

                if (node.isTarget) {
                    for (var cssClass in TARGET_NODE_CSS) {
                        style[cssClass] = TARGET_NODE_CSS[cssClass];
                    }
                }

                var nodeConfig = {
                    group: 'nodes',
                    data: {
                        id: '' + node.id,
                        style: style,
                        holdingTime: node.holdingTime,
                        name: node.name,
                        parentId: node.parentId
                    },
                    position: {
                        x: position.x,
                        y: position.y
                    },
                    css: style,
                    selected: false,
                    selectable: true,
                    locked: false
                }

                cache.addNode(id, level, nodeConfig);
            }

            cache.updateLevelNode(id);
        }

        var nodesArr = cache.getModifiedNodes();
        var added = nodesArr.added;
        var removed = nodesArr.removed;

        var addedEdges = [];
        var removedNodeSelector = '';
        var removedEdgeSelector = '';

        // add/remove edges
        var takenEdgeIds = {};
        for (i = 0; i < added.length; i++) {
            node = added[i].data;
            nodeN = nodeIdxs[node.id];

            addedEdges = addedEdges.concat(getEdgesWithSource(nodeN, levelJumps[level][nodeN], levelInfo));
        }

        for (i = 0; i < addedEdges.length; i++) {
            takenEdgeIds[addedEdges[i].data.id] = true;
        }

        for (i = 0; i < added.length; i++) {
            node = added[i].data;
            nodeN = nodeIdxs[node.id];

            var edges = getEdgesWithTarget(nodeN, levelJumps[level], levelInfo);

            for (var j = 0; j < edges.length; j++) {
                if (edges[j].data.id in takenEdgeIds) continue;
                addedEdges.push(edges[j]);
            }
        }

        for (var sourceN = 0; sourceN < removed.length; sourceN++) {
            var sourceId = removed[sourceN];

            for (var targetN = 0; targetN < levelInfo.length; targetN++) {
                var targetId = levelInfo[targetN].id;

                removedEdgeSelector += '#' + sourceId + '-' + targetId + ',#' + targetId + '-' + sourceId;

                if (sourceN < removed.length-1 || targetN < levelInfo.length-1)
                    removedEdgeSelector += ',';
            }
        }

        for (i = 0; i < removed.length; i++) {
            removedNodeSelector += '#' + removed[i];
            if (i < removed.length-1)
                removedNodeSelector += ',';
        }

        // draw
        if (removedEdgeSelector.length > 0) cy.remove(cy.edges(removedEdgeSelector));
        if (removedNodeSelector.length > 0) cy.remove(cy.nodes(removedNodeSelector));
        if (added.length > 0) cy.add(added).qtip(nodeQtipOpts);
        if (addedEdges.length > 0) addedEdges = cy.add(addedEdges).qtip(edgeQtipOpts);

        // recolor the edges
        if (addedEdges.length > 0 || removedEdgeSelector.length > 0) {
            // recompute the probabilities
            (function () {
                for (var i = 0; i < addedEdges.length; i++) {
                    var edge = addedEdges[i];
                    var node = edge.source();
                    var outEdges = node.edgesTo('');

                    var maxProb = 0;
                    for (var j = 0; j < outEdges.length; j++) {
                        if (outEdges[j].data().prob > maxProb)
                            maxProb = outEdges[j].data().prob;
                    }
                    node.data().maxProb = maxProb;
                }
            })();

            // recolor the most and middle probable edges
            var middle = cy.edges().filter(function () {
                var data = this.data();
                return data.prob > 0.2 || data.prob == this.source().data().maxProb;
            });
            var bold = middle.filter(function () {
                var data = this.data();
                return data.prob > 0.4 || data.prob == this.source().data().maxProb;
            });

            middle.css('line-style', 'solid');
            middle.css('content', 'data(prob)');
            bold.css('line-color', BOLD_EDGE_COLOR);
            bold.css('target-arrow-color', BOLD_EDGE_COLOR);

            // remember for later
            (function () {
                for (var i = 0; i < middle.length; i++) {
                    var edge = middle[i];
                    var prob = toUiPrecision(edge.data().prob);

                    edge.data().style['line-style'] = 'solid';
                    edge.data().style.content = prob;
                    edge.css({ content: toUiPrecision(edge.data().prob) });
                }
            })();
            (function () {
                for (var i = 0; i < bold.length; i++) {
                    bold[i].data().style['line-color'] = BOLD_EDGE_COLOR;
                    bold[i].data().style['target-arrow-color'] = BOLD_EDGE_COLOR;
                }
            })();
        }
    }

    function redraw(opts) {
        if (opts == null) opts = {};

        if (!opts.isInBatch)
            cy.startBatch();

        if (!opts.keepCached)
            clear(true);

        insertLevel(currentLevel);

        if (!opts.isInBatch)
            cy.endBatch();
    }

    function redrawAll(forceRedraw) {
        cy.startBatch();

        setCurrentLevel(currentLevel, true);
        if (forceRedraw) {
            redraw({ isInBatch: true });
        }
        redrawSpecial(true);

        cy.endBatch();
    }

    function constructLevels(data, isInit) {
        clearStructures();
        colorGenerator.init(data);

        for (var i = 0; i < data.length; i++) {
            var states = data[i].states;

            levelHeights.push(data[i].height);
            levelJumps.push(data[i].transitions);
            levelCurrentStates.push({currentState: data[i].currentState, futureStates: data[i].futureStates});
            levelNodes.push(states);
            levelNodeMap[i] = {};

            uiConfig.levelMaxNodeSize.push(0);

            for (var j = 0; j < states.length; j++) {
                var node = states[j];
                var nodeId = node.id;

                levelNodeMap[i][nodeId] = node;
                parentH[nodeId] = node.parentId;

                var size = node.raduis;
                if (size > uiConfig.maxNodeSize)
                    uiConfig.maxNodeSize = states[j].raduis;
                if (size > uiConfig.levelMaxNodeSize[i])
                    uiConfig.levelMaxNodeSize[i] = size;
            }
        }

        if (isInit) {
            maxHeight = levelHeights[levelHeights.length - 1];
            minHeight = levelHeights[0];

            heightStep = (maxHeight - minHeight) / ZOOM_STEPS;

            minAndMaxCoords();

            setViewport(boundingBox, false);	// don't fire an event

            currentHeight = maxHeight;
            currentLevel = levelHeights.length - 1;

            callbacks.heightChanged(internalToUiScale(currentHeight));
        }

        redraw();
    }

    function setCurrentLevel(levelIdx, isInBatch) {
        if (isInBatch == null) isInBatch = false;

        var mode = getMode();

        if (mode == MODE_TARGET_FTR) {
            fetchTargetFtr(modeConfig.mode.config.targetFtr);
        }

        redraw({ keepCached: true, isInBatch: isInBatch });

        fetchCurrentState(hierarchy[levelIdx].height);

        if (mode == MODE_ACTIVITY) {
            var nodes = cy.nodes();

            for (var i = 0; i < nodes.length; i++) {
                var node = nodes[i];
                var data = node.data();

                var parentId = data.parentId;
                var parent = cache.getNode(parentId);

                if (parent != null && parent.data.backgroundColor != null) {
                    var color = parent.data.backgroundColor;
                    setNodeColor(node.id(), color);
                }
            }
        }
    }

    function setNodeColor(nodeId, color) {
        var graphNode;
        if (color != null) {
            cache.getNode(nodeId).css.backgroundColor = color;
            graphNode = cy.nodes('#' + nodeId);
            if (graphNode.length > 0) {
                graphNode.data().backgroundColor = color;
                graphNode.css('backgroundColor', color);
                // TODO set the font color
            }
        }
        else {
            delete cache.getNode(nodeId).css.backgroundColor;
            graphNode = cy.nodes('#' + nodeId);
            if (graphNode.length > 0) {
                delete graphNode.data().backgroundColor;
                graphNode.css('backgroundColor', DEFAULT_NODE_COLOR);
                // TODO reset the font color
            }
        }
    }

    function drawNode(nodeId, batchPresent) {
        if (nodeId == null) return;

        if (!batchPresent)
            cy.startBatch();

        var node = cy.nodes('#' + nodeId);
        var data = node.data();

        var mode = getMode();

        var prob;
        var color;
        var config;

        if (mode != MODE_ACTIVITY) {
            if (nodeId == modeConfig.selected) {
                node.css('z-index', FOREGROUND_Z_INDEX);

                node.css('shadow-color', SELECTED_NODE_SHADOW_COLOR);
                node.css('shadow-blur', SELECTED_NODE_SHADOW_SIZE);
                node.css('shadow-opacity', SELECTED_NODE_SHADOW_OPACITY)
            }

            if (nodeId == modeConfig.current) {
                node.css('border-width', CURRENT_BORDER_WIDTH);
                node.css('border-color', CURRENT_NODE_COLOR);
                //				node.css('backgroundColor', CURRENT_NODE_COLOR);
            }
            // if (nodeId in modeConfig.past) {
            //     node.css('border-color', PREVIOUS_NODE_EDGE_COLOR);
            // }
            if (nodeId in modeConfig.future) {
                prob = futureColorFromProb(modeConfig.future[nodeId]);
                color = 'hsla(' + FUTURE_NODE_BASE_COLOR + ',' + (15 + Math.floor((100-15)*prob)) + '%, 55%, 1)';
                node.css('border-color', color);
            }

            if (mode == MODE_PROBS) {
                config = modeConfig.mode.config;
                var probs = config.probs;
                prob = probs[nodeId];
                var intens = 100*prob;//*futureColorFromProb(prob);

                color = 'hsla(' + VIZ_NODE_COLOR + ',' + Math.ceil(intens) + '%, 55%, 1)';
                node.css('backgroundColor', color);
            }
            else if (mode == MODE_TARGET_FTR) {
                config = modeConfig.mode.config;
                var ftrVal = config.ftrVals[nodeId];

                var ftrRange = config.maxVal - config.minVal;
                var middleVal = config.minVal + ftrRange/2;

                color = getFtrColor(ftrVal, config.minVal, config.maxVal, middleVal);

                node.css('backgroundColor', color);
            }
            else {
                var nodeColor = colorGenerator.getColorStr(nodeId);
                node.css('backgroundColor', nodeColor);
            }
        }
        else {
            if (data.backgroundColor != null) {
                node.css('backgroundColor', data.backgroundColor);
            }
            else {
                node.css('backgroundColor', DEFAULT_NODE_COLOR);
            }
        }

        if (!batchPresent)
            cy.endBatch();
    }

    function clearStyles(inBatch) {
        if (!inBatch)
            cy.startBatch();

        var nodes = cy.nodes();

        nodes.css('border-color', DEFAULT_BORDER_COLOR);
        nodes.css('backgroundColor', DEFAULT_NODE_COLOR);
        nodes.css('border-color', DEFAULT_BORDER_COLOR);
        nodes.css('z-index', BACKGROUND_Z_INDEX);

        if (!inBatch)
            cy.endBatch();
    }

    function drawNodes() {
        cy.batch(function () {
            clearStyles(true);

            var levelInfo = levelNodes[currentLevel];
            for (var i = 0; i < levelInfo.length; i++) {
                drawNode(levelInfo[i].id, true);
            }
        });
    }

    function clearCurrentState() {
        clearStyles();

        modeConfig.current = null;
        modeConfig.future = {};
        modeConfig.past = {};
    }

    function redrawSpecial(isInBatch) {
        if (!isInBatch)
            cy.startBatch();

        var nodeId;
        var node;

        var nodes = cy.nodes();
        for (var i = 0; i < nodes.length; i++) {
            node = nodes[i];
            node.css(node.data().style);
        }

        drawNode(modeConfig.selected, true);
        drawNode(modeConfig.current, true);
        for (nodeId in modeConfig.future)
            drawNode(nodeId, true);
        for (nodeId in modeConfig.past)
            drawNode(nodeId, true);
        if (modeConfig.mode.type == MODE_PROBS) {
            for (nodeId in modeConfig.mode.config.probs)
                drawNode(nodeId, true);
        }

        if (!isInBatch)
            cy.endBatch();
    }

    //===============================================================
    // SET STATES
    //===============================================================

    function setCurrentState(stateId, height) {
        clearCurrentState();
        modeConfig.current = stateId;
        cy.nodes('#' + stateId).select();

        if (modeConfig.mode.type == MODE_NORMAL)
            fetchFutureStates(stateId, height);
        fetchPastStates(stateId, height);

        drawNodes();
    }

    function setSelectedState(node) {
        var prevStateId = modeConfig.selected;

        if (node == null) {
            modeConfig.selected = null;

            cy.batch(function () {
                var nodes = cy.nodes();
                nodes.css('shadow-color', 'white');
                nodes.css('shadow-blur', 0);
                nodes.css('shadow-opacity', 0);
                //				cy.nodes().css('border-width', DEFAULT_BORDER_WIDTH);

                // emphasize edges
                var edges = cy.edges();
                var nedges = edges.length;
                for (var i = 0; i < nedges; i++) {
                    var edge = edges[i];
                    edge.css(edge.data().style);
                }
            });

            // notify the handler
            if (prevStateId != modeConfig.selected)
                callbacks.stateSelected(null, hierarchy[currentLevel].height);
        } else {
            var stateId = parseInt(node.id());
            // set selected state
            modeConfig.selected = stateId;
            // redraw
            cy.batch(function () {
                var nodes = cy.nodes();
                nodes.css('shadow-color', 'white');
                nodes.css('shadow-blur', 0);
                nodes.css('shadow-opacity', 0);
                //				nodes.css('border-width', DEFAULT_BORDER_WIDTH);
                drawNode(stateId, true);

                // emphasize edges
                var edges = cy.edges();
                var nedges = edges.length;
                for (var i = 0; i < nedges; i++) {
                    var edge = edges[i];
                    edge.css(edge.data().style);
                }

                node.edgesTo('').css({
                    'line-color': 'green',
                    'target-arrow-color': 'green',
                    'line-style': 'solid'
                });
            });

            // notify the handler
            if (prevStateId != modeConfig.selected)
                callbacks.stateSelected(getServerNodeId(stateId), hierarchy[currentLevel].height);
        }
    }

    //===============================================================
    // FETCH METHODS
    //===============================================================

    function fetchFutureStates(currStateId, height) {
        modeConfig.future = {};

        $.ajax('api/futureStates', {
            dataType: 'json',
            data: { state: currStateId, level: height },
            success: function (states) {
                for (var i = 0; i < Math.min(3, states.length); i++) {
                    var stateId = states[i].id;

                    modeConfig.future[stateId] = states[i].prob;
                    drawNode(stateId);
                }
            }
        });
    }

    function fetchPastStates(currStateId, height) {
        modeConfig.past = {};

        $.ajax('api/history', {
            dataType: 'json',
            data: { state: currStateId, level: height },
            success: function (stateIds) {
                for (var i = 0; i < stateIds.length; i++) {
                    var stateId = stateIds[i];

                    modeConfig.past[stateId] = true;
                    drawNode(stateId);
                }
            }
        });
    }

    function fetchCurrentState(height) {
        modeConfig.current = null;

        $.ajax('api/currentState', {
            dataType: 'json',
            data: { level: height },
            success: function (state) {
                setCurrentState(state.id, height);
            }
        });
    }

    function preprocessStateIds(data) {
        for (var levelN = 0; levelN < data.length; levelN++) {
            var stateIdH = {};
            var states = data[levelN].states;

            for (var stateN = 0; stateN < states.length; stateN++) {
                var id = states[stateN].id;
                var step = 0;
                while (id in stateIdH) {
                    id |= ++step << 16;
                }

                if (step != 0) {
                    states[stateN].id = id;
                }

                stateIdH[id] = true;
            }
        }
    }

    function isInitialized() {
        return levelNodes.length > 0;
    }

    function setUI(data, isInit) {
        preprocessStateIds(data);
        cache.clear();
        data.sort(function (a, b) {
            return a.height - b.height;
        });
        hierarchy = data;
        constructLevels(hierarchy, isInit);
        fetchCurrentState(currentHeight);
    }

    function fetchUI() {
        $.ajax({
            url: 'api/model',
            success: function (data) {
                setUI(data, true);
                // notify the UI that we are initialized
                callbacks.onInitialized();
            },
            dataType: 'json',
            error: handleAjaxError()
        });
    }

    function fetchTargetFtr(ftrIdx) {
        var height = hierarchy[currentLevel].height;

        $.ajax('api/targetFeature', {
            dataType: 'json',
            data: { height: height, ftr: ftrIdx },
            success: function (data) {
                var stateVals = {};

                var maxVal = Number.NEGATIVE_INFINITY;
                var minVal = Number.POSITIVE_INFINITY;

                for (var i = 0; i < data.length; i++) {
                    var state = data[i].state;
                    var value = data[i].value;

                    if (value > maxVal) maxVal = value;
                    if (value < minVal) minVal = value;

                    stateVals[state] = value;
                }

                setMode(MODE_TARGET_FTR, {
                    targetFtr: ftrIdx,
                    ftrVals: stateVals,
                    maxVal: maxVal,
                    minVal: minVal
                });

                drawNodes();
            }
        });
    }

    //===============================================================
    // INITIALIZE
    //===============================================================

    function internalToUiScale(scale) {
        return 100 - (1 - (scale - minHeight) / (maxHeight - minHeight)) * 100;
    }

    function uiToInternalScale(scale) {
        //		var negScale = 100 - scale;
        return (1 - (100 - scale) / 100)*(maxHeight - minHeight) + minHeight;
    }

    function setLevel(levelN) {
        if (levelN != currentLevel) {
            currentLevel = levelN;
            setCurrentLevel(currentLevel);
        }
    }

    function setScale(scale) {
        var prevHeight = currentHeight;
        currentHeight = Math.min(maxHeight, Math.max(minHeight, scale));

        var levelN = currentLevel;

        while (levelN < levelHeights.length - 1 && currentHeight >= levelHeights[levelN+1]) {
            levelN++;
        }
        while (levelN > 0 && currentHeight < levelHeights[levelN]) {
            levelN--;
        }

        if (levelN != currentLevel) {
            setLevel(levelN);
        }

        if (currentHeight != prevHeight) {
            callbacks.heightChanged(internalToUiScale(currentHeight));
        }
    }

    function onMouseWheel(event) {
        if (event.preventDefault) event.preventDefault();

        //console.log(event.wheelDelta);
        var zoomIn = event.deltaY != null ? event.deltaY > 0 : event.wheelDelta < 0;

        if (zoomIn) {
            setScale(currentHeight + heightStep);
        } else {
            setScale(currentHeight - heightStep);
        }

        if (scrollZoomEnabled) {
            var zoom = cy.zoom();
            var factor = 1.01;
            var newZoom = zoom * (zoomIn ? 1 / factor : factor);

            setZoom(newZoom);
        }
    }

    // adding mouse wheel listener
    if (visContainer.onwheel !== undefined) {
        visContainer.addEventListener('wheel', onMouseWheel)
    } else if (visContainer.onmousewheel !== undefined) {
        visContainer.addEventListener('mousewheel', onMouseWheel)
    } else {
        // unsupported browser
        alert("your browser is unsupported");
    }

    var cy = cytoscape({
        container: document.getElementById(opts.visContainer),
        style: [
            {
                selector: 'node',
                css: {
                    'background-color': DEFAULT_NODE_COLOR,
                    'text-valign': 'center',
                    'font-size': FONT_SIZE
                },
            },
            {
                selector: 'edge',
                css: {
                    'target-arrow-shape': 'triangle',
                    'target-arrow-color': EDGE_COLOR,
                    'lineColor': EDGE_COLOR
                }
            }
        ],

        motionBlur: false,
        fit: false,
        userZoomingEnabled: false,
        boxSelectionEnabled: false,
        wheelSensitivity: 0.01,

        // moving the viewport
        panningEnabled: true,
        userPanningEnabled: true,
        hideEdgesOnViewport: false,
        textureOnViewport: true,

        minZoom: minCyZoom,
        maxZoom: maxCyZoom,

        ready: function() {
            fetchUI();

            cy.on('click', 'node', function (event) {	// left click
                var node = event.cyTarget;
                setSelectedState(node);
            });

            cy.on('click', function (event) {	// left click
                var target = event.cyTarget;

                if (target === cy) {
                    setSelectedState(null);
                }
            });

            // initialize the context menu
            cy.cxtmenu({
                selector: 'node',
                commands: function (node) {
                    // check if the node is on the bottom level
                    var id = getServerNodeId(node.id());
                    var label = node.data().style.label;
                    var level = parseInt(label.split('\.')[0]);

                    return callbacks.onStateCtxMenu(id, label, level, currentHeight);
                }
            });

            cy.on('mouseover', 'node', function (event) {
                var node = event.cyTarget;

                if (parseInt(node.id()) != modeConfig.selected) {
                    node.css('z-index', MIDDLEGROUND_Z_INDEX);
                }
            });

            cy.on('mouseout', 'node', function (event) {
                var node = event.cyTarget;

                if (parseInt(node.id()) != modeConfig.selected) {
                    node.css('z-index', BACKGROUND_Z_INDEX);
                }
            });

            (function () {
                var startPos = null;

                function dist(p1, p2) {
                    return Math.sqrt((p1.x - p2.x)*(p1.x - p2.x) + (p1.y - p2.y)*(p1.y - p2.y));
                }

                cy.on('grab', 'node', function (event) {
                    var cyNode = event.cyTarget;
                    var pos = cyNode.position();

                    startPos = { x: pos.x, y: pos.y };
                });

                // fired when a node is moved
                cy.on('free', 'node', function (event) {
                    var cyNode = event.cyTarget;
                    var id = parseInt(cyNode.id());
                    var pos = cyNode.position();
                    var serverPos = serverPosition(pos);

                    // check if we haven't moved
                    if (startPos != null) {
                        var d = dist(pos, startPos);
                        startPos = null;

                        if (d < 3) {
                            console.log('Moved for: ' + d + ' ignoring ...');
                            return;
                        }
                    }

                    for (var level in levelNodeMap) {
                        for (var nodeId in levelNodeMap[level]) {
                            if (nodeId == id) {
                                var node = levelNodeMap[level][nodeId];
                                node.x = serverPos.x;
                                node.y = serverPos.y;
                            }
                        }
                    }
                });
            })();

            cy.on('click', 'edge', function (event) {
                var edge = event.cyTarget;
                var sourceId = edge.source().id();
                var targetId = edge.target().id();

                callbacks.edgeSelected(parseInt(sourceId), parseInt(targetId));
            });

            (function () {	// fixes the non-working qtip delay
                var tooltipElement = cy.collection();
                var tooltipShown = false;
                var hoverTimeout;

                function cancelHover() {
                    clearTimeout(hoverTimeout);
                    tooltipElement.trigger('hovercancel');
                    tooltipShown = false;
                }

                cy.on('mousemove', 'edge,node', function (event) {
                    if (tooltipShown) {
                        cancelHover();
                    }

                    tooltipElement = this;

                    if (!tooltipShown) {
                        if (tooltipElement.group() == 'edges') {
                            var offset = $(cy.container()).offset();
                            var api = tooltipElement.qtip('api');
                            api.set('position.adjust.x', event.cyRenderedPosition.x + offset.left);
                            api.set('position.adjust.y', event.cyRenderedPosition.y + offset.top);
                        }
                        clearTimeout(hoverTimeout);
                        hoverTimeout = setTimeout(function () {
                            tooltipShown = true;
                            tooltipElement.trigger('hover');
                        }, 1000);
                    } else {
                        cancelHover();
                    }
                }).on('mouseout', 'edge,node', function () {
                    cancelHover();
                });
            })();
        }
    });

    function getMode() {
        return modeConfig.mode.type;
    }

    function setMode(mode, config) {
        modeConfig.mode.type = mode;

        if (config != null)
            modeConfig.mode.config = config;

        if (mode == MODE_ACTIVITY) {
            // reset the selected state
            setSelectedState(null);
        }
    }

    function resetMode() {
        if (!isInitialized()) return;

        cy.batch(function () {
            setMode(MODE_NORMAL, {});
            redraw({ keepCached: true, isInBatch: true });
            redrawSpecial(true);
        });
    }

    //===============================================================
    // INTERNAL TO EXTERNAL CONVERSION
    //===============================================================

    function findNodeFromStateId(stateId) {
        var level = currentLevel;
        var levelInfo = levelNodes[level];

        var targetNode = null;
        for (var i = 0; i < levelInfo.length; i++) {
            var node = levelInfo[i];
            if (node.id == stateId) {
                targetNode = node;
            }
        }

        return targetNode;
    }

    //===============================================================
    // OBJECT
    //===============================================================

    var that = {

        MODE_ACTIVITY: MODE_ACTIVITY,

        isInit: function () {
            return isInitialized();
        },

        /*
         * Sets a new model which is visualized. Zoom and other properties are not
         * refreshed!
         */
        setModel: function (data) {
            setUI(data, false);
        },

        setSubModel: function (data) {
            setUI(data, true);
        },

        getParent: function (stateId) {
            return parentH[stateId];
        },

        setCurrentStates: function (currentStates) {
            if (hierarchy == null) return;

            currentStates.sort(function (a, b) {
                return a.height - b.height;
            });

            var currState = currentStates[currentLevel].id;
            if (currState != modeConfig.current)
                setCurrentState(currState, currentStates[currentLevel].height);
        },

        setTransitionThreshold: function (threshold) {
            transitionThreshold = Math.max(0.5, Math.min(1, threshold));
            redrawAll(true);
        },

        setProbDist: function (dist) {
            var config = {maxProb: 0, probs: {}};

            for (var i = 0; i < dist.length; i++) {
                var stateId = dist[i].stateId;
                var prob = dist[i].prob;

                if (prob > config.maxProb) config.maxProb = prob;

                config.probs[stateId] = prob;
            }

            setMode(MODE_PROBS, config);
            redrawSpecial();
        },

        getMode: getMode,
        setMode: function (mode, config) {
            setMode(mode, config);
            redrawAll();
        },
        resetMode: resetMode,

        getNodePositions: function () {
            var posArr = [];
            var positions = {};

            var nodeId;
            for (var level in levelNodeMap) {
                for (nodeId in levelNodeMap[level]) {
                    var node = levelNodeMap[level][nodeId];

                    positions[nodeId] = {
                        x: node.x,
                        y: node.y
                    }
                }
            }

            for (nodeId in positions) {
                posArr.push({ id: parseInt(nodeId), position: positions[nodeId] });
            }

            return posArr;
        },

        setTargetFtr: function (ftrIdx) {
            if (ftrIdx == null) {	// reset to normal mode
                resetMode();
            } else {
                fetchTargetFtr(ftrIdx);
            }
        },

        setTargetState: function (stateId, isTarget) {
            // find the node
            (function () {
                for (var levelN = 0; levelN < levelNodes.length; levelN++) {
                    var levelInfo = levelNodes[levelN];
                    for (var i = 0; i < levelInfo.length; i++) {
                        var node = levelInfo[i];
                        if (node.id == stateId) {
                            node.isTarget = isTarget;
                            break;
                        }
                    }
                }
            })();

            var node = cy.nodes('#' + stateId);
            if (isTarget) {
                (function () {
                    for (var cssClass in TARGET_NODE_CSS) {
                        node.css(cssClass, TARGET_NODE_CSS[cssClass]);
                        cache.getNode(stateId).css[cssClass] = TARGET_NODE_CSS[cssClass];
                    }
                })();
            } else {
                (function () {
                    for (var cssClass in TARGET_NODE_CSS) {
                        node.removeCss(cssClass);
                        delete cache.getNode(stateId).css[cssClass];
                    }
                })();
            }
        },

        setStateName: function (stateId, name) {
            var targetNode = findNodeFromStateId(stateId);

            if (targetNode == null) return;

            targetNode.name = name;

            var label = getNodeLabel(targetNode);
            cache.getNode(stateId).css.content = label;

            var graphNode = cy.nodes('#' + stateId);
            if (graphNode.length > 0) {
                graphNode.data().name = name;
                graphNode.css('content', getNodeLabel(targetNode));
                graphNode.flashClass('nolabel', 1);	// fix, doesn't work without this
            }
        },

        setSelectedState: function (stateId) {
            setSelectedState(cy.nodes('#' + stateId));
        },

        setNodeColor: setNodeColor,
        getDefaultNodeColor: function (id) {
            return colorGenerator.getColor(id);
        },

        clearNodeColors: function () {
            var cachedNodes = cache.getNodes();
            for (var nodeId in cachedNodes) {
                setNodeColor(nodeId, null);
            }
            redrawAll();
        },

        setShowTransitionProbs: function (show) {
            drawEdgeVals = show;

            cy.batch(function () {
                var edges = cy.edges();
                for (var i = 0; i < edges.length; i++) {
                    var edge = edges[i];
                    drawTransitionText(edge);
                }
            })
        },

        setFontFactor: function (factor) {
            fontFactor = factor;
            // update the font factor in the cache and update the
            // currently drawn nodes
            cache.updateCss('font-factor', factor);

            cy.batch(function () {
                var nodes = cy.nodes();
                nodes.style('font-factor', factor);
            });
        },

        autoLayout: function () {
            var center = { x: 0, y: 0 };
            var newCenter = { x: 0, y: 0 };

            var nodes = cy.nodes();
            for (var i = 0; i < nodes.length; i++) {
                var cyNode = nodes[i];
                var pos = cyNode.position();
                center.x += pos.x;
                center.y += pos.y;
            }

            center.x /= nodes.length;
            center.y /= nodes.length;

            cy.layout({
                name: 'cose',
                animate: 'true',
                nodeOverlap: 500,
                useMultitasking: true,
                stop: function () {
                    cy.batch(function () {
                        (function () {
                            var nodes = cy.nodes();
                            for (var i = 0; i < nodes.length; i++) {
                                var cyNode = nodes[i];
                                var pos = cyNode.position();
                                newCenter.x += pos.x;
                                newCenter.y += pos.y;
                            }
                        })();

                        newCenter.x /= nodes.length;
                        newCenter.y /= nodes.length;

                        var deltaCenter = { x: center.x - newCenter.x, y: center.y - newCenter.y };

                        (function () {
                            var nodes = cy.nodes();
                            for (var i = 0; i < nodes.length; i++) {
                                var cyNode = nodes[i];
                                var id = parseInt(cyNode.id());
                                var pos = cyNode.position();
                                var newPos = { x: pos.x + deltaCenter.x, y: pos.y + deltaCenter.y }

                                cyNode.position('x', newPos.x);
                                cyNode.position('y', newPos.y);

                                var level = currentLevel;
                                var node = levelNodeMap[level][id];

                                var serverPos = serverPosition(newPos);
                                node.x = serverPos.x;
                                node.y = serverPos.y;
                            }
                        })();

                        var padding = parseInt(Math.min(cy.width()*xOffset, cy.height()*yOffset).toFixed());
                        cy.fit(nodes, padding);
                    });
                }
            })
        },

        setWheelScroll: function (scroll) {
            scrollZoomEnabled = scroll;
        },

        setScale: function (scale) {
            setScale(uiToInternalScale(scale));
        },

        setLevel: function (levelN) {
            setScale(levelHeights[levelN]);
        },

        getLevel: function () {
            return currentLevel;
        },

        setZoom: function (value) {
            setZoom(value, false);
        },

        getZoom: function () {
            return cy.zoom();
        },

        getMinZoom: function () {
            return minCyZoom;
        },

        getMaxZoom: function () {
            return maxCyZoom;
        },

        getZoomLevels: function () {
            var zoomLevels = [];
            for (var i = 0; i < levelHeights.length; i++) {
                zoomLevels.push(internalToUiScale(levelHeights[i]));
            }
            return zoomLevels;
        },

        getScale: function () {
            return hierarchy[currentLevel].height;
        },

        getCurrentHeight: function () {
            return currentHeight;
        },

        getCurrentState: function () {
            return modeConfig.current;
        },

        getSelectedState: function () {
            return modeConfig.selected;
        },

        getPNG: function () {
            return cy.png( {full: true, scale: 1} );
        },

        // callbacks
        onStateSelected: function (callback) {
            callbacks.stateSelected = callback;
        },

        onEdgeSelected: function (callback) {
            callbacks.edgeSelected = callback;
        },

        onZoomChanged: function (callback) {
            callbacks.zoomChanged = callback;
        },

        onHeightChanged: function (callback) {
            callbacks.heightChanged = callback;
        },

        onStateCtxMenu: function (callback) {
            callbacks.onStateCtxMenu = callback;
        },

        onInitialized: function (callback) {
            callbacks.onInitialized = callback;
        }
    }

    return that;
}
