"use strict";
exports.__esModule = true;
var ace = require("@axway/ace-sdk");
var ByteBuffer = require("bytebuffer");
var businessMessageProcessor = function (spanCtx, bMsg, clientRelay) {
    // Load the business message body, which is a byte array, by creating a new Buffer object
    // Convert that buffer object to be a string type
    var span = ace.tracing.startSpanFromContext(spanCtx, 'Node JS Service- SPLIT');
    var payloadBody = Buffer.from(bMsg[0].getPayload().getBody_asU8()).toString();
    span.log({ Payload: payloadBody });
    // Sample Input
    // 		{
    // 		"orders":
    // 			[{
    //              "customer_id": "ZYX012",
    // 				"order_number":"0001",
    // 				"item_id":"ABC"
    // 			},{
    //              "customer_id": "XYZ123",
    // 				"order_number":"0002",
    // 				"item_id":"DEF"
    // 			}]
    // 		}
    //
    // Sample Outputs
    //    Output 1
    // 		{
    //          "customer_id": "ZYX012",
    // 			"order_number":"0001",
    // 			"item_id":"ABC"
    // 		}
    //    Output 2
    // 		{
    //          "customer_id": "XYZ123",
    // 			"order_number":"0002",
    // 			"item_id":"DEF"
    // 		}
    // Split orders
    if (payloadBody.length > 0) {
        var payloadJson = JSON.parse(payloadBody);
        var _loop_1 = function (order) {
            // Create new Business Message using current one as base
            createNewBusinessMessage(bMsg[0], JSON.stringify(order), function (newBusinessMessage) {
                // Send that Business Message back to the linker client
                try {
                    var spanLog = {};
                    spanLog['Payload[' + order.order_number + ']'] = JSON.stringify(order);
                    span.log(spanLog);
                    clientRelay.send(newBusinessMessage);
                }
                catch (error) {
                    span.finish();
                    return error;
                }
            });
        };
        // Loop through each word in the payloadBody string
        for (var _i = 0, _a = payloadJson['orders']; _i < _a.length; _i++) {
            var order = _a[_i];
            _loop_1(order);
        }
        span.finish();
    }
    return;
};
function createNewBusinessMessage(bMsg, newPayload, callback) {
    var newBMsg = ace.cloneBusinessMessage(bMsg);
    // Set the new payload, converting the UTF8 string into a byte array
    newBMsg.getPayload().setBody(ByteBuffer.fromUTF8(newPayload).buffer);
    callback(newBMsg);
}
function main() {
    var _a;
    // Create new App Config and register the service with the ACE Linker
    var serviceType = ace.ServiceType[process.env.SERVICE_TYPE];
    var cfg = new ace.ServiceConfig(process.env.SERVICE_NAME, process.env.SERVICE_VERSION, serviceType, process.env.SERVICE_DESCRIPTION);
    ace.logger.info('Business service config', (_a = {}, _a[ace.fields.logFieldServiceName] = cfg.name, _a));
    ace.register(cfg, businessMessageProcessor, function (link, error) {
        var _a;
        if (error) {
            ace.logger.error('registration error', (_a = {}, _a[ace.fields.logFieldError] = error.message, _a));
            return;
        }
        // Start the link between the business message processor and linker
        link.start();
    });
}
main();
