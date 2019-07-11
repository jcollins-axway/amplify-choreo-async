import * as ace from '@axway/ace-sdk';
import * as ByteBuffer from 'bytebuffer';
import {SpanContext} from 'opentracing';

let businessMessageProcessor: ace.MessageProcessorInterface = function(
	spanCtx: SpanContext,
	bMsgs: Array<ace.BusinessMessage>,
	clientRelay: ace.MessageProducer
): Error | null {
	// Load the business message body, which is a byte array, by creating a new Buffer object
	// Convert that buffer object to be a string type
	let span = ace.tracing.startSpanFromContext(spanCtx, 'Check Inventory');
	var payloadBody = Buffer.from(bMsgs[0].getPayload().getBody_asU8()).toString();

	span.log({CheckInventory: payloadBody});

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

	let quantityMap = {
		'ABC': 8,
		'CAB': 20,
		'DEF': 7
	}
	var payloadJson = JSON.parse(payloadBody);

	// Check quantity
	let supplierMsg = {
		"item_id": payloadJson.item_id,
		"quantity": payloadJson.quantity > quantityMap[payloadJson.item_id] ? payloadJson.quantity - quantityMap[payloadJson.item_id] : 0
	}
	createNewBusinessMessage(bMsgs[0], JSON.stringify(supplierMsg), newBusinessMessage => {
		// Send that Business Message back to the linker client
		span.log({Payload: JSON.stringify(supplierMsg)});
		let error = clientRelay.send(newBusinessMessage);
		if (error) {
			span.finish();
			return error;
		}
	});

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