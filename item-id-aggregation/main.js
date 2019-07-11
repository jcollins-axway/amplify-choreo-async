"use strict";
exports.__esModule = true;
var ace = require("@axway/ace-sdk");
var ByteBuffer = require("bytebuffer");
var businessMessageProcessor = function (spanCtx, bMsgs, clientRelay) {
    //this simulates 'splitting' the received message by ' ' character
    // Sample Input, each in a different business message
    // [
    // 		{
    //          "customer_id": "ZYX012",
    // 			"order_number":"0001",
    // 			"item_id":"ABC",
    //			"quantity": 5
    // 		}
    // ],
    // [
    //		{
    //          "customer_id": "XYZ123",
    // 			"order_number":"0002",
    // 			"item_id":"DEF",
    //			"quantity": 2
    // 		}
    // ],
    // [
    //		{
    //          "customer_id": "XYZ123",
    // 			"order_number":"0003",
    // 			"item_id":"ABC",
    //			"quantity": 13
    // 		}
    // ],
    // [
    //		{
    //          "customer_id": "ZYX012",
    // 			"order_number":"0004",
    // 			"item_id":"CAB",
    //			"quantity": 8
    // 		}
    // ],
    // [
    //		{
    //          "customer_id": "ZYX012",
    // 			"order_number":"0005",
    // 			"item_id":"DEF",
    //			"quantity": 8
    // 		}
    // ]
    //
    // Sample Output 1
    // 		{
    // 		"orders":
    // 			[{
    //              "customer_id": "ZYX012",
    // 			    "order_number":"0001",
    // 			    "item_id":"ABC",
    //			    "quantity": 5
    // 			},{
    //              "customer_id": "XYZ123",
    // 			    "order_number":"0003",
    // 			    "item_id":"ABC",
    //			    "quantity": 13
    // 			}]
    //      "item_id": "ABC",
    //      "qunatity": 18
    // 		}
    //
    // Sample Output 2
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
    // Sample Output 3
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
    // Load the business message body, which is a byte array, by creating a new Buffer object
    // Convert that buffer object to be a string type
    var span = ace.tracing.startSpanFromContext(spanCtx, 'Item ID Aggregation Service');
    var orders = [];
    for (var i in bMsgs) {
        var spanLog = {};
        var payloadString = Buffer.from(bMsgs[i].getPayload().getBody_asU8()).toString();
        orders.push(JSON.parse(payloadString));
        spanLog['Order[' + i + ']'] = payloadString;
        span.log(spanLog);
    }
    var groupBy = function (objArray, key) {
        return objArray.reduce(function (rv, x) {
            (rv[x[key]] = rv[x[key]] || []).push(x);
            return rv;
        }, {});
    };
    var orderGroups = groupBy(orders, 'item_id');
    var _loop_1 = function (grouping) {
        // Creating an object with an array of orders
        var ordersObj = { orders: orderGroups[grouping] };
        // Sum the quantity of all orders
        var total = 0;
        for (var _i = 0, _a = ordersObj.orders; _i < _a.length; _i++) {
            var order = _a[_i];
            total = total + order.quantity;
        }
        ordersObj['quantity'] = total;
        // Put the item_id in the top level object
        ordersObj['item_id'] = ordersObj.orders[0].item_id;
        // Create new Business Message using current o ne as base
        createNewBusinessMessage(bMsgs[0], JSON.stringify(ordersObj), function (newBusinessMessage) {
            // Send that Business Message back to the linker client
            span.log({ Payload: JSON.stringify(ordersObj) });
            var error = clientRelay.send(newBusinessMessage);
            if (error) {
                span.finish();
                return error;
            }
        });
    };
    for (var grouping in orderGroups) {
        _loop_1(grouping);
    }
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
