/* exported isNumber, isInt, clone, getTimeUnit, formatDate, formatDateTime,
 handleAjaxError, addPressHandler, toUiPrecision, redirectToUI, reloadWindow,
 getHslStr, getFtrColor, getBrightness, hsl2rgb */

var StreamStory = {};

StreamStory.Utils = {};

StreamStory.Utils.asyncExecutor = function (callback) {
    // var currReqId = 0;
    var nReq = 0;
    var nRes = 0;
    return function (executeMe) {
        // var reqId = currReqId++;
        nReq++;
        executeMe(function () {
            nRes++;
            if (nReq == nRes) {
                callback();
            }
        })
    }
}

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
    return function (xhr) {
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
            callback();
    }
}

function addPressHandler(btn, callback) {
    var timeoutId = 0;
    var intervalId = 0;

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
    if(Math.floor(value) === value) return 0;
    return value.toString().split(".")[1].length || 0;
}

function toUiPrecision(val) {
    if (val > 1000) {
        return val.toFixed();
    } else {
        var decimals = countDecimals(val);
        if (decimals == 0)
            return val.toFixed();
        else
            return val.toPrecision(Math.min(decimals, 3));
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
    // window.location.replace('ui.html');
}

function reloadWindow() {
    window.location.reload();
}

//function mod(val, base) {
//	var result = val % base;
//	if (result < 0) result += base;
//	return result;
//}

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
}

function getBrightness(rgb) {
    return 0.3*rgb.r + 0.59*rgb.g + 0.11*rgb.b;
}

function hsl2rgb(h, s, l) {
    var c = (1 - Math.abs(2*l - 1))*s;
    var h1 = Math.round(h*360 / (120*Math.PI));	// = h * 360 / 60
    var x = c*(1 - Math.abs(h1 % 2 - 1));

    var red = 0;
    var green = 0;
    var blue = 0;

    if (h1 < 1) {
        red = c;
        green = x;
        blue = 0;
    } else if (h1 < 2) {
        red = x;
        green = c;
        blue = 0;
    } else if (h1 < 3) {
        red = 0;
        green = c;
        blue = x;
    } else if (h1 < 4) {
        red = 0;
        green = x;
        blue = c;
    } else if (h1 < 5) {
        red = x;
        green = 0;
        blue = c;
    } else if (h1 <= 6) {
        red = c;
        green = 0;
        blue = x;
    } else {
        alert('h1: ' + h1);
    }

    return {
        r: red,
        g: green,
        b: blue
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
