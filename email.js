var nodemailer = require("nodemailer");
var aws = require('./config/aws.json');

var transport = nodemailer.createTransport("SES", {
    AWSAccessKeyID: aws.key,
    AWSSecretKey: aws.secret
});

var mailOptions = {
    from: "Adam Magaluk <AdamMagaluk@gmail.com>", // sender address
    to: "AdamMagaluk@gmail.com", // list of receivers
    subject: "Hello", // Subject line
    text: "Hello world", // plaintext body
    html: "<b>Hello world</b>" // html body
}

transport.sendMail(mailOptions, function(error, response){
    if(error){
        console.log(error);
    }else{
        console.log("Message sent: " + response.message);
    }
});