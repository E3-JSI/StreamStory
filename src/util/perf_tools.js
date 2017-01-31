function micros(dt) {
    return dt[0] * 1e6 + dt[1] / 1e3;
}

function millis(dt) {
    return micros(dt) / 1000;
}

function seconds(dt) {
    return millis(dt) / 1000;
}

exports.throughput = function () {
    var totalMsgs = 0;
    var startTime = null;
    var lastThroughput = 0;
    var prevBatchEnd = null;
    var maxThroughput = -Number.MAX_VALUE;
    var minThroughput = Number.MAX_VALUE;

    return {
        init: function () {
            startTime = process.hrtime();
            prevBatchEnd = startTime;
        },

        update: function (batchSize) {
            var dt = process.hrtime(prevBatchEnd);
            totalMsgs += batchSize;
            prevBatchEnd = process.hrtime();
            lastThroughput = batchSize / seconds(dt);

            if (lastThroughput > maxThroughput) maxThroughput = lastThroughput;
            if (lastThroughput < minThroughput) minThroughput = lastThroughput;
        },

        print: function () {
            var totalDt = process.hrtime(startTime);
            var throughtput = totalMsgs / seconds(totalDt);
            log.debug('================================');
            log.debug('THROUGHPUT');
            log.debug('throughput: %d', throughtput);
            log.debug('throughput (last): %d', lastThroughput);
            log.debug('minimum: %d', minThroughput);
            log.debug('maximum: %d', maxThroughput);
            log.debug('================================');
        }
    }
}

exports.latency = function () {
    var totalDur = 0;
    var maxDur = -Number.MAX_VALUE;
    var minDur = Number.MAX_VALUE;
    var n = 0;
    return {
        tic: function () {
            var start = process.hrtime();
            var done = false;
            return function toc() {
                if (done) return;

                var dur = millis(process.hrtime(start));
                totalDur += dur;
                if (dur > maxDur) maxDur = dur;
                if (dur < minDur) minDur = dur;

                n++;
                done = true;
            }
        },
        print: function () {
            log.debug('================================');
            log.debug('LATENCY');
            log.debug('number of measurements: %d', n);
            log.debug('average latency: %d', totalDur / n);
            log.debug('minimum: %d', minDur);
            log.debug('maximum: %d', maxDur);
            log.debug('================================');
        }
    }
}
