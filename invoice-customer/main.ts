import * as ace from '@axway/ace-sdk';
import * as ByteBuffer from 'bytebuffer';
import {SpanContext} from 'opentracing';
import * as nodemailer from 'nodemailer'; 

const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		   user: 'amplify.choreo@gmail.com',
		   pass: 'thisismypassword'
	   }
   });

let businessMessageProcessor: ace.MessageProcessorInterface = function(
	spanCtx: SpanContext,
	bMsg: Array<ace.BusinessMessage>,
	clientRelay: ace.MessageProducer
): Error | null {
	// Load the business message body, which is a byte array, by creating a new Buffer object
	// Convert that buffer object to be a string type
	let span = ace.tracing.startSpanFromContext(spanCtx, 'Invoice Customer');
	let payloadBody = Buffer.from(bMsg[0].getPayload().getBody_asU8()).toString();
	let payloadJson = JSON.parse(payloadBody);

	span.log({InvoiceCust: payloadJson['customer_id']});

	// Sample Input
	// 		{
	// 		"orders":
	// 			[{
    //              "customer_id": "ZYX012",
	// 				"order_number":"0001",
	// 				"item_id":"ABC"
	// 			},{
    //              "customer_id": "ZYX012",
	// 				"order_number":"0002",
	// 				"item_id":"DEF"
	// 			}]
	//		"customer_id": "ZYX012",
	//      "total": 302.84
	// 		}
	//
	// Sample Output
	//    No Output, Send email

	// Create Email
	let mailOpts = {
		from: 'amplify.choreo@gmail.com',
		to: 'amplify.choreo+' + payloadJson['customer_id'] + '@gmail.com',
		subject: '*Invoice* Customer: ' + payloadJson['customer_id'] + ' Total: $' + payloadJson['total'],
		html: '<p>Invoice<br />Customer: ' + payloadJson['customer_id'] + '<br />Total: $' + payloadJson['total'] + '<br /><br />' + JSON.stringify(payloadBody['orders']) +'</p>'
	}
	span.log({"Email Info": mailOpts});
	
	transporter.sendMail(mailOpts, function(err: any, info: any) {
		if(err) {
			ace.logger.error('Email Fail', {'Error': err});
		} else {
			ace.logger.info('Email Success', {'Output': info});
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
