"use strict";
exports.__esModule = true;
var ace = require("@axway/ace-sdk");
var ByteBuffer = require("bytebuffer");
var businessMessageProcessor = function (spanCtx, bMsgs, clientRelay) {
    // Load the business message body, which is a byte array, by creating a new Buffer object
    // Convert that buffer object to be a string type
    var span = ace.tracing.startSpanFromContext(spanCtx, 'Check Inventory');
    var payloadBody = Buffer.from(bMsgs[0].getPayload().getBody_asU8()).toString();
    span.log({ CheckInventory: payloadBody });
    // Sample Input 1
    // 		{
    // 		"orders":
    // 			[{
    //          	"customer_id": "ZYX012",
    // 				"order_number":"0004",
    // 				"item_id":"CAB",
    //				"quantity": 8
    // 			}]
    //      "item_id": "CAB",
    //      "quantity": 8
    // 		}
    //
    // Sample Output 1
    // 		{
    //		    "item_id": "CAB",
    //		    "quantity": 0
    // 		}
    //
    // Sample Input 2
    // 		{
    // 		"orders":
    // 			[{
    //              "customer_id": "XYZ123",
    // 			    "order_number":"0002",
    // 			    "item_id":"DEF",
    //			    "quantity": 2
    // 			},{
    //              "customer_id": "ZYX012",
    // 			    "order_number":"0005",
    // 			    "item_id":"DEF",
    //			    "quantity": 8
    // 			}]
    //      "item_id": "DEF",
    //      "quantity": 10
    // 		}
    //
    // Sample Output 2
    // 		{
    //		    "item_id": "DEF",
    //		    "quantity": 3
    // 		}
    var quantityMap = {
        'ABC': 8,
        'CAB': 20,
        'DEF': 7
    };
    var payloadJson = JSON.parse(payloadBody);
    // Check quantity
    var supplierMsg = {
        "item_id": payloadJson.item_id,
        "quantity": payloadJson.quantity > quantityMap[payloadJson.item_id] ? payloadJson.quantity - quantityMap[payloadJson.item_id] : 0
    };
    createNewBusinessMessage(bMsgs[0], JSON.stringify(supplierMsg), function (newBusinessMessage) {
        // Send that Business Message back to the linker client
        span.log({ Payload: JSON.stringify(supplierMsg) });
        var error = clientRelay.send(newBusinessMessage);
        if (error) {
            span.finish();
            return error;
        }
    });
    span.finish();
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
