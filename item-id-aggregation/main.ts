import * as ace from '@axway/ace-sdk';
import * as ByteBuffer from 'bytebuffer';
import {SpanContext} from 'opentracing';

let businessMessageProcessor: ace.MessageProcessorInterface = function(
	spanCtx: SpanContext,
	bMsgs: Array<ace.BusinessMessage>,
	clientRelay: ace.MessageProducer
): Error | null {
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
	let span = ace.tracing.startSpanFromContext(spanCtx, 'Item ID Aggregation Service');
	let orders = [];
	for (let i in bMsgs) {
		let spanLog = {};
		let payloadString = Buffer.from(bMsgs[i].getPayload().getBody_asU8()).toString();
		orders.push(JSON.parse(payloadString));
		spanLog['Order[' + i + ']'] = payloadString;
		span.log(spanLog);
	}

	var groupBy = function(objArray: Array<any>, key: string) {
		return objArray.reduce(function(rv: any, x: any) {
			(rv[x[key]] = rv[x[key]] || []).push(x);
			return rv;
		}, {});
	};

	let orderGroups = groupBy(orders, 'item_id');

	for (let grouping in orderGroups) {
		// Creating an object with an array of orders
		let ordersObj = {orders: orderGroups[grouping]};
		
		// Sum the quantity of all orders
		let total = 0;
		for (let order of ordersObj.orders) {
			total = total + order.quantity;
		}
		ordersObj['quantity'] = total;

		// Put the item_id in the top level object
		ordersObj['item_id'] = ordersObj.orders[0].item_id;

		// Create new Business Message using current o ne as base
		createNewBusinessMessage(bMsgs[0], JSON.stringify(ordersObj), newBusinessMessage => {
			// Send that Business Message back to the linker client
			span.log({Payload: JSON.stringify(ordersObj)});
			let error = clientRelay.send(newBusinessMessage);
			if (error) {
				span.finish();
				return error;
			}
		});
	}
	span.finish();
	return;
};

function createNewBusinessMessage(bMsg: ace.BusinessMessage, newPayload: string, callback: any) {
	let newBMsg = ace.cloneBusinessMessage(bMsg);

	// Set the new payload, converting the UTF8 string into a byte array
	newBMsg.getPayload().setBody(ByteBuffer.fromUTF8(newPayload).buffer);

	callback(newBMsg);
}

function main() {
    // Create new App Config and register the service with the ACE Linker
    let serviceType = ace.ServiceType[process.env.SERVICE_TYPE];
    let cfg = new ace.ServiceConfig(process.env.SERVICE_NAME, process.env.SERVICE_VERSION, serviceType, process.env.SERVICE_DESCRIPTION);

	ace.logger.info('Business service config', {[ace.fields.logFieldServiceName]: cfg.name});

	ace.register(cfg, businessMessageProcessor, (link, error) => {
		if (error) {
			ace.logger.error('registration error', {[ace.fields.logFieldError]: error.message});
			return;
		}
		// Start the link between the business message processor and linker
		link.start();
	});
}

main();
