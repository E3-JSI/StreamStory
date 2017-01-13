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
            log.info('================================');
            log.info('THROUGHPUT');
            log.info('throughput: %d', throughtput);
            log.info('throughput (last): %d', lastThroughput);
            log.info('minimum: %d', minThroughput);
            log.info('maximum: %d', maxThroughput);
            log.info('================================');
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
            log.info('================================');
            log.info('LATENCY');
            log.info('number of measurements: %d', n);
            log.info('average latency: %d', totalDur / n);
            log.info('minimum: %d', minDur);
            log.info('maximum: %d', maxDur);
            log.info('================================');
        }
    }
}
