var BROKER_URL = '89.216.116.44';
var BROKER_PORT = 9092;

// comsumer port: 2181
// producer port: 9092

var kafkaesque = require('kafkaesque')({
	brokers: [{host: BROKER_URL, port: BROKER_PORT}],
	clientId: 'InternalOA',
	maxBytes: 2000000
});

var msgCallback = null;


function initBroker() {
	log.info('Initializing broker ...');
	
	kafkaesque.tearUp(function() {
		log.info('Kafka initialized!');
		
		var nReceived = 0;
		
		function handleMsg(e, kafka) {
			if (e != null) {
				log.error(e, 'Failed to initialize Kafka!');
				return;
			}
			
			// handle each message
			kafka.on('message', function (offset, msgInfo, commit) {
				try {
					var msg = JSON.parse(msgInfo.value);
					
					if (++nReceived % 100 == 0)
						log.debug('Received %d messages ...', nReceived);
//					if (log.debug())
//						log.debug('Received kafka offset: %d, message: %s', offset, JSON.stringify(msg));
					
					if (msgCallback != null)
						msgCallback(msg);
				} catch (e) {
					log.error(e, 'Error while handling a message!');
				}
				
				commit();
			});
			// report errors
			kafka.on('error', function (e) {
				log.error(e, 'Error while listening to kafka!');
			});
		}
		
		kafkaesque.poll({topic: 'si.ijs.request.internal.raw', partition: 0}, handleMsg);
		kafkaesque.poll({topic: 'si.ijs.request.internal.cep', partition: 0}, handleMsg);
		
		{
			var nSent = 0;
			setInterval(function () {
				// send two messages to the testing topic
				var timestamp = new Date().getTime();
				
//				log.debug('Timestamp: %d', timestamp);
				
				kafkaesque.produce(
					{topic: 'si.ijs.request.internal.raw', partition: 0},
					[JSON.stringify({timestamp: timestamp, value: 2, sensorId: 'MHWirth.DDM.HookLoad', type: 'raw'})], 
			        function (err, response) {
						if (err != null) {
							log.error(err, 'Failed to send a message to Kafka!');
							return;
						}
						// shutdown connection
						if (++nSent % 100 == 0)
							log.debug('Sent %d messages ...', nSent);
					}
				);
			}, 20);
		}
	});
}

initBroker();

exports.sendPrediction = function () {
	var message = {
		pdfType: 'exp',
		params: [.1]
	}
	
	// send two messages to the testing topic
	kafkaesque.produce(
		{topic: 'si.ijs.response.internal.prediction', partition: 0},
		[JSON.stringify(message)], 
        function (err, response) {
			if (err != null) {
				log.error(err, 'Failed to send a message to Kafka!');
				return;
			}
			// shutdown connection
		    log.debug(response);
		}
	);
};

exports.onMessage = function (callback) {
	msgCallback = callback;
}