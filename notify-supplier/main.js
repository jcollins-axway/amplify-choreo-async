"use strict";
exports.__esModule = true;
var ace = require("@axway/ace-sdk");
var ByteBuffer = require("bytebuffer");
var nodemailer = require("nodemailer");
var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'amplify.choreo@gmail.com',
        pass: 'thisisnotmypassword'
    }
});
var businessMessageProcessor = function (spanCtx, bMsg, clientRelay) {
    // Load the business message body, which is a byte array, by creating a new Buffer object
    // Convert that buffer object to be a string type
    var payloadBody = Buffer.from(bMsg[0].getPayload().getBody_asU8()).toString();
    var payloadJson = JSON.parse(payloadBody);
    if (payloadJson['quantity'] === 0) {
        var span_1 = ace.tracing.startSpanFromContext(spanCtx, 'No Notifing Supplier');
        span_1.finish();
        return;
    }
    var span = ace.tracing.startSpanFromContext(spanCtx, 'Notify Supplier');
    span.log({ ReorderItem: payloadJson['item_id'] });
    // Sample Input
    // 		{
    //		    "item_id": "DEF",
    //		    "quantity": 3
    // 		}
    //
    // Sample Output
    //    No Output, Send email
    // Create Email
    var mailOpts = {
        from: 'amplify.choreo@gmail.com',
        to: 'amplify.choreo+' + payloadJson['item_id'] + '@gmail.com',
        subject: '*Ordering* Item: ' + payloadJson['item_id'] + ' Number Needed: ' + payloadJson['quantity'],
        html: '<p>Ordering<br />Item: ' + payloadJson['item_id'] + '<br />Number Needed: ' + payloadJson['quantity'] + '</p>'
    };
    span.log({ "Email Info": mailOpts });
    transporter.sendMail(mailOpts, function (err, info) {
        if (err) {
            ace.logger.error('Email Fail', { 'Error': err });
        }
        else {
            ace.logger.info('Email Success', { 'Output': info });
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
