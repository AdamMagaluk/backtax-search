var util = require('util')
  , request = require('request')
  , async = require('async')
  , S = require('string')
  , fs = require('fs')
  , nodemailer = require("nodemailer");

var config = require('./config/config.json');
var aws = require('./config/aws.json');

var allResults = [];
var totalRequests = 0
var totalFinished = 0;

var q = async.queue(function (task, callback) {
    checkForParcels(task.street,task.start,task.end,task.cvt,function(err,ret){
      console.log(task)
      console.log("Found " + ret.length);
      allResults = allResults.concat(ret);
      delete ret;
      totalFinished++;
      console.log(totalFinished + "/" + totalRequests)
      callback();
    });
},config.workers);

q.drain = function() {
	console.log("Total Found " + allResults.length)
	fs.writeFile("out.json",JSON.stringify({parcels : allResults}), function(err) {
		if(err) {
		  console.log(err);
		} else {
		  console.log("The file was saved!");
		}
	}); 
};

var alphabet = ("abcdefghijklmnopqrstuvwxyz").split("");
var cvts = [51,44];
var run = [ [1,2500],[2500,5000],[5000,7500],[7500,10000],[10000,12500]];

cvts.forEach(function(cvt){
	alphabet.forEach(function(letter){

		for(var i=1;i<=11000;i+=config.blockSize){
			q.push({
				street : letter,
				start : i,
				end : Number(i+config.blockSize),
				cvt : cvt
			});
			totalRequests++;
		}
	});
});
console.log(totalRequests);

function checkForParcels(street,start,end,cvt,callback,jar){
	var jar = jar || request.jar();
	request.get(config.baseUrl+'/search.do',{jar : jar},function(e,res,body){
		delete body;
	    delete res;
	if(e) return callback(e);
	var form = {
		addressNoS : start,
		addressNoE : end,
		streetName : street,
		CVT : cvt
	};

	request.post(config.baseUrl+'/search.do',{form: form,jar : jar },function(e,res,body){
	    if(e) return callback(e);

	    if(body.search('There were no result found.') != -1){
	    	console.log('There were no result found. for ' + street + " " + start + " " + end);
	    	delete body;
	    	delete res;
	    	return callback(null,[]);
	    }else{
	    	request.post(config.baseUrl+'/searchLast.do',{form: form,jar : jar },function(e,res,body){
	    		if(e) return callback(e);
	    		var parcels = body.match(/parcelNo=\d\d-\d\d-\d\d-\d\d\d-\d\d\d/g);
	        	delete body;
	    		delete res;
	    		async.map(parcels,stripUnwantedParcelNoEq, function(err, results){
    				callback(null,results);
				});
	    	});
	    }
	  });
	});
}

function stripUnwantedParcelNoEq(p,callback){
	var x = p.substr(9,16);
	delete p;
	callback(null,x);
}