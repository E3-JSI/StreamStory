/* exported isNumber, isInt, clone, getTimeUnit, formatDate, formatDateTime,
 handleAjaxError, addPressHandler, toUiPrecision, redirectToUI, reloadWindow,
 getHslStr, getFtrColor, hsl2rgb */

var StreamStory = {};

StreamStory.Utils = {};

StreamStory.Utils.asyncExecutor = function (onAllFinished) {
    // var currReqId = 0;
    var nReq = 0;
    var nRes = 0;
    return function execute(task) {
        // var reqId = currReqId++;
        nReq++;
        task(function done() {
            nRes++;
            if (nReq == nRes) {
                onAllFinished();
            }
        })
    }
}

/**
 * A task executor which always executes only the last task in the queue (if
 * tasks are piling up, the middle ones are forgotten).
 */
StreamStory.Utils.executeLastExecutor = function () {
    var currTask = null;
    var pendingTask = null;

    var executeCurrTask = function () {
        if (currTask == null) return;
        currTask(function () {
            // finished the current task, now execute whichever task is pending
            currTask = pendingTask;
            pendingTask = null;
            executeCurrTask();
        })
    }

    return function execute(task) {
        if (currTask == null) {
            currTask = task;
            executeCurrTask();
        } else {
            pendingTask = task;
        }
    }
}

/**
 * Handles GET requests to the server.
 *
 * @param {string} url - the path on the server
 * @param {Object} params - parameters
 * @param {function} callback - standard callback
 */
StreamStory.Utils.get = function (url, params, callback) {
    if (params == null) { params = {}; }

    $.ajax(url, {
        data: params,
        method: 'GET',
        dataType: 'json',
        contentType: 'application/json',
        success: function (data) {
            callback(undefined, data);
        },
        error: StreamStory.Utils.handleAjaxError(null, callback)
    });
}

StreamStory.Utils.post = function (url, data, callback) {
    if (data == null) { data = {}; }

    $.ajax(url, {
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        data: data,
        success: function (data) {
            callback(undefined, data);
        },
        error: StreamStory.Utils.handleAjaxError(null, callback)
    });
}

StreamStory.Utils.handleAjaxError = handleAjaxError;

//=============================================
// BROWSER
//=============================================

StreamStory.Browser = {};

StreamStory.Browser.getUrlPath = function () {
    return window.location.href;
}
StreamStory.Browser.redirect = function (url) {
    window.location.assign(url);
}

StreamStory.Browser.replaceUrlPath = function (url) {
    window.history.replaceState({}, document.title, url);
}

//=============================================
// FORMATTING
//=============================================

StreamStory.Format = {}

StreamStory.Format.toUiPrecision = toUiPrecision;

function isNumber(val) {
    return !isNaN(val);
}

function isInt(val) {
    if (isNaN(val)) return false;
    return parseFloat(val) == parseInt(val);
}
function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function getTimeUnit() {
    return $('#span-tu').html();
}

function formatDate(date) {
    var year = date.getFullYear();
    var month = date.getMonth() + 1;
    var day = date.getDate();

    if (month < 10) month = '0' + month;
    if (day < 10) day = '0' + day;

    return day + '/' + month + '/' + year;
}

function formatDateTime(date) {
    var hour = date.getHours();
    var minute = date.getMinutes();
    var second = date.getSeconds();

    if (hour < 10) hour = '0' + hour;
    if (minute < 10) minute = '0' + minute;
    if (second < 10) second = '0' + second;

    return formatDate(date) + ' ' + hour + ':' + minute + ':' + second;
}

function handleAjaxError(alertField, callback) {
    return function (xhr, status, err) {
        if (xhr.readyState == 0) {
            console.log('Ajax error with request not initialized!');
        } else {
            if (xhr.status == 400 && alertField != null) {
                showAlert($('#alert-holder'), alertField, 'alert-danger', xhr.responseText, null, false);
            } else {
                alert(xhr.responseText);
            }
        }

        if (callback != null)
            callback(err);
    }
}

function addPressHandler(btn, callback) {
    var timeoutId = 0;
    var intervalId = 0;

    // remove previous handlers
    btn.off('click mousedown mouseup mouseleave');

    btn.click(function (event) {
        if (event.which != 1) return;

        callback(event);
    });
    btn.mousedown(function (event) {
        if (event.which != 1) return;	// only listen to the left mouse button

        timeoutId = setTimeout(function () {
            // the button is pressed
            timeoutId = null;
            intervalId = setInterval(function () {
                callback(event);
            }, 50);
        }, 1000);
    }).bind('mouseup mouseleave', function () {
        if (timeoutId != null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (intervalId != null) {
            clearInterval(intervalId);
            intervalId = null;
        }
    });
}

function countDecimals(value) {
    if (Math.floor(value) === value) return 0;
    return value.toString().split(".")[1].length || 0;
}

function toUiPrecision(val) {
    var N_DIGITS = 4;
    var magnitude = Math.floor(Math.log10(Math.abs(val)));
    var decimals;
    if (magnitude >= N_DIGITS) { // > 1000
        return val + '';
    }
    else if (magnitude < 0) { // < 1
        decimals = countDecimals(val);
        var len = decimals + magnitude + 1;
        return val.toPrecision(1 + Math.max(0, Math.min(len-1, N_DIGITS + magnitude)));
    }
    else {
        decimals = countDecimals(val);
        if (decimals == 0) {
            return val + '';
        } else {
            var m = magnitude + 1;
            return val.toPrecision(m + Math.min(decimals, Math.max(0, N_DIGITS - m)));
        }
    }
}

function showAlert(holder, wrapper, clazz, title, msg, close) {
    wrapper.children('div').alert('close');
    wrapper.html(holder.html());

    var alertDiv = wrapper.children('div');

    alertDiv.removeClass('alert-danger');
    alertDiv.removeClass('alert-success');
    alertDiv.addClass(clazz);

    if (title != null)
        alertDiv.children('.alert-title').html(title);
    if (msg != null)
        alertDiv.children('.alert-text').html(msg);

    alertDiv.alert();

    if (close == true) {
        setTimeout(function () {
            alertDiv.alert('close');
        }, 5000);
    }
}

function redirectToUI() {
    window.location.assign('ui.html');
}

function reloadWindow() {
    window.location.reload();
}

function getFtrColorRgb(val, minVal, maxVal, middleVal) {
    if (middleVal == null) middleVal = 0;

    var negColor = [0,0,255];	// purple
    var posColor = [255,128,0];	// yellow

    var baseColor = val > middleVal ? posColor : negColor;
    var colorWgt = val > middleVal ? (val - middleVal) / (maxVal - middleVal) : (val - middleVal) / (minVal - middleVal);

    var color = [];
    for (var i = 0; i < baseColor.length; i++) {
        color.push((baseColor[i]*colorWgt).toFixed());
    }

    return {
        r: color[0],
        g: color[1],
        b: color[2]
    }
    // return 'rgb(' + color.join(',') + ')';
}

function getFtrColor(val, minVal, maxVal, middleVal) {
    if (middleVal == null) middleVal = 0;

    var negColor = [0,0,255];	// purple
    var posColor = [255,128,0];	// yellow

    var baseColor = val > middleVal ? posColor : negColor;
    var colorWgt = val > middleVal ? (val - middleVal) / (maxVal - middleVal) : (val - middleVal) / (minVal - middleVal);

    var color = [];
    for (var i = 0; i < baseColor.length; i++) {
        color.push((baseColor[i]*colorWgt).toFixed());
    }
    return 'rgb(' + color.join(',') + ')';
    // var color = getFtrColorRgb(val, minVal, maxVal, middleVal);
    // return 'rgb(' + color.r.toFixed() + ',' + color.g.toFixed() + ',' + color.b.toFixed() + ')';
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
// function hsl2rgb(h, s, l) {
//     // if (h > 1) throw new Error('hue is: ' + h);
//     var c = (1 - Math.abs(2*l - 1))*s;
//     var h1 = Math.round(h*360 / (120*Math.PI));	// = h * 360 / 60
//     var x = c*(1 - Math.abs(h1 % 2 - 1));

//     var red = 0;
//     var green = 0;
//     var blue = 0;

//     if (h1 < 1) {
//         red = c;
//         green = x;
//         blue = 0;
//     } else if (h1 < 2) {
//         red = x;
//         green = c;
//         blue = 0;
//     } else if (h1 < 3) {
//         red = 0;
//         green = c;
//         blue = x;
//     } else if (h1 < 4) {
//         red = 0;
//         green = x;
//         blue = c;
//     } else if (h1 < 5) {
//         red = x;
//         green = 0;
//         blue = c;
//     } else if (h1 <= 6) {
//         red = c;
//         green = 0;
//         blue = x;
//     } else {
//         alert('h1: ' + h1);
//     }

//     return {
//         r: red,
//         g: green,
//         b: blue
//     }
// }
// function hsl2rgb(h, s, l){
//     var r;
//     var g;
//     var b;

//     if (s == 0) {
//         r = g = b = l; // achromatic
//     } else {
//         var hue2rgb = function hue2rgb(p, q, t){
//             if(t < 0) t += 1;
//             if(t > 1) t -= 1;
//             if(t < 1/6) return p + (q - p) * 6 * t;
//             if(t < 1/2) return q;
//             if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
//             return p;
//         }

//         var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
//         var p = 2 * l - q;
//         r = hue2rgb(p, q, h + 1/3);
//         g = hue2rgb(p, q, h);
//         b = hue2rgb(p, q, h - 1/3);
//     }

//     return {
//         r: r*255,
//         g: g*255,
//         b: b*255
//     }
//     // return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
// }

/**
 * Converts an HSL color value to RGB.
 * Based on algoritym from: based on algorithm from http://en.wikipedia.org/wiki/hsl_and_hsv#converting_to_rgb
 * Assumes h is in range [0,2*PI) and s, l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation
 */
function hsl2rgb(hue, saturation, lightness) {
    hue = 360*hue / (2*Math.PI);

    if (hue == undefined) { return { r: 0, g: 0, b: 0 }; }
  
    var chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
    var huePrime = hue / 60;
    var secondComponent = chroma * (1 - Math.abs((huePrime % 2) - 1));
  
    huePrime = Math.floor(huePrime);
    var red;
    var green;
    var blue;
  
    if (huePrime === 0){
        red = chroma;
        green = secondComponent;
        blue = 0;
    } else if (huePrime === 1){
       red = secondComponent;
       green = chroma;
       blue = 0;
    } else if (huePrime === 2){
       red = 0;
       green = chroma;
       blue = secondComponent;
    } else if (huePrime === 3){
       red = 0;
       green = secondComponent;
       blue = chroma;
    } else if (huePrime === 4){
       red = secondComponent;
       green = 0;
       blue = chroma;
    } else if (huePrime === 5){
       red = chroma;
       green = 0;
       blue = secondComponent;
    }
  
    var lightnessAdjustment = lightness - (chroma / 2);
    red += lightnessAdjustment;
    green += lightnessAdjustment;
    blue += lightnessAdjustment;

    return {
        r: Math.round(red*255),
        g: Math.round(green*255),
        b: Math.round(blue*255)
    }
}

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h in [0,2*PI), s, and l in the set [0, 1].
 *
 * @param   {number}  r       The red color value
 * @param   {number}  g       The green color value
 * @param   {number}  b       The blue color value
 * @return  {Array}           The HSL representation
 */
function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if (max == min) {
        h = s = 0; // achromatic
    } else {
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return {
        hue: h*2*Math.PI,
        saturation: s,
        light: l
    }
}

function getHslStr(val) {
    return 'hsl(' + (360*val.hue / (2*Math.PI)).toFixed() + ',' + (100*val.saturation).toFixed() + '%,' + (100*val.light).toFixed() + '%)';
}

$(document).ready(function () {
    // hack, so that console.log doesn't crash the app in IE
    if (window.console == null) {
        window.console = {
            log: function () {}
        }
    }

    var tooltipElements = $('[rel=tooltip]');

    tooltipElements.qtip({
        content: {
            title: function () {
                return $(this).attr('title');
            },
            text: function () {
                return $(this).attr('content');
            }
        },
        style: {
            classes: 'qtip-bootstrap'
        }
    });
});
