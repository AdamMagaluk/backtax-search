//require('nodetime').profile()
var util = require('util')
  , request = require('request')
  , async = require('async')
  , S = require('string')
  , fs = require('fs')
  , nodemailer = require("nodemailer");

var config = require('./config/config.json');
var aws = require('./config/aws.json');
var parcelsToScrape = require(config.parcelFile).parcels;


var mailOptions = {
    from: "Adam Magaluk <AdamMagaluk@gmail.com>", // sender address
    to: "AdamMagaluk@gmail.com", // list of receivers
    subject: "Scrape Report : " + process.pid, // Subject line
    html: "" // html body
}

var transport = nodemailer.createTransport("SES", {
    AWSAccessKeyID: aws.key,
    AWSSecretKey: aws.secret
});


function paddy(n, p, c) {
    var pad_char = typeof c !== 'undefined' ? c : '0';
    var pad = new Array(1 + p).join(pad_char);
    return (pad + n).slice(-pad.length);
}

var ParcelPin = function(id){
  var self = this;
  this.id = {
    county : 0
    , township: 0
    , section: 0
    , chunk: 0
    , id: 0
  };

  var a = id;
  if(typeof id == "string"){
    a = id.split('-');
  }

  if(a.length < Object.keys(self.id))
    throw new Error("Id format not correct eg.41-14-29-181-007");

  var i=0;
  Object.keys(self.id).forEach(function(k){
    self.id[k] = Number(a[i]);
    i++;
  });
};
ParcelPin.prototype.toString = function() {
  return this.id.county + "-" + this.id.township + "-" + this.id.section + "-" + this.id.chunk + "-" + paddy(this.id.id,3);
};
ParcelPin.prototype.searchFormData = function() {
  var self = this;
  return {
    parcelNo2 : ""+self.id.township,
    parcelNo3 : ""+self.id.section,
    parcelNo4 : ""+self.id.chunk,
    parcelNo5 : paddy(self.id.id,3)
  };
};


var output = {
  totalChecked : 0,
  totalFinished : 0,
  matched : [],
  maxId : 0
};

var startTime = new Date().getTime();
var lastTime = 0;
var endTime;
var last = 0;
function printPercentage(){
  var per = Math.round(100.0*(output.totalFinished / output.totalChecked));
  
  if(per % 5 == 0 && per != last || new Date().getTime()-lastTime > 108000000){
   lastTime = new Date().getTime();
   console.log(per + "% complete " + output.totalFinished + "/"+output.totalChecked);
   mailOptions.html = per + "% complete " + output.totalFinished + "/"+output.totalChecked;
   mailOptions.html += "<br>"+"Found:"+output.matched.length+"<br><br>";
   mailOptions.html += JSON.stringify(process.memoryUsage());


   transport.sendMail(mailOptions, function(error, response){
    if(error){
        console.log(error);
    }
   });

   last = per;
  }else if(per % 1 == 0 && per != last){
    console.log(per + "% complete " + output.totalFinished + "/"+output.totalChecked);
    last = per;
  }
}


var stream = fs.createWriteStream(config.outFile);

function consoleShow(){
  var time =  endTime-startTime;
  console.log("all items have been processed " +time + "/"+output.totalChecked+" Avg:" + (time/output.totalChecked) + ' Found:' + output.totalMatched + " MaxId:" + output.maxId );
  output.matched.forEach(function(item){
    console.log("   "+item.parcel.toString()+" "+item.info.addressSteet + " " + item.info.area);
    item.years.forEach(function(y){
      console.log("    - " + y.year + " - Tax Value:" + y.taxValue + "   Delinquent Tax Amount Due:"+y.taxMissing)
    });
  });
}

function writeToFile(){
  fs.writeFile(config.outFile+".json",JSON.stringify(output), function(err) {
      if(err) {
          console.log(err);
      } else {
          console.log("The file was saved!");
      }
  }); 
}


var q = async.queue(function (task, callback) {
    checkProp(task.parcel,function(err,ret){
      if(err) return console.error(err);
      if(ret.foundInSearch){
        if(task.parcel.id.id > output.maxId){
          output.maxId = task.parcel.id.id;
        }
      }
      if(ret.years.length == config.yearsToCheck.length){
        output.matched.push(ret);
        stream.write(ret.parcel.toString()+","+ret.info.addressSteet+" "+ret.info.area+"\n");
      }

      output.totalFinished++;
      printPercentage();
      callback();
    });
},config.workers);


q.drain = function() {
  endTime = new Date().getTime();
  output.totalMatched = output.matched.length; 
  consoleShow();
  writeToFile();
};

parcelsToScrape.forEach(function(pString){
  output.totalChecked++;
  q.push({parcel: new ParcelPin(pString)});
});


function checkProp(parcel,callback){

  var ret = {
    parcel : parcel,
    foundInSearch : false,
    bodyEmpty : true,
    years : []
  };

  var jar = request.jar();
  request.get(config.baseUrl+'/search.do',{jar : jar},function(e,res,body){
    if(e) return callback(e);
    request.post(config.baseUrl+'/search.do',{form: parcel.searchFormData(),jar : jar },function(e,res,body){
        if(e) return callback(e);

        if(body.search('There were no result found.') != -1){
          return callback(null,ret);
        }
        ret.foundInSearch = true;

        request.get(config.baseUrl+'/realEstate.do?parcelNo='+parcel.toString()+'&ele=0',{jar : jar},function(e,res,body){
          if(e) return callback(e);

          ret.info = getParcelInformation(body) || {};

          if(config.cityFilter.length > 0){
            var found = false;
            config.cityFilter.forEach(function(x){
              if(ret.info.area == x){
                found = true;
              }
            })

            if(!found) return callback(null,ret);
          }
          //if(ret.info.area)

          request.get(config.baseUrl+'/delqSearch.do',{jar : jar},function(e,res,body){
            if(e) return callback(e);
              if(body){
                ret.bodyEmpty = false;
                config.yearsToCheck.forEach(function(y){
                  var s = body.search('parclno='+parcel.toString()+'&taxYr='+y);
                  if(s != -1){

                    var x = S(body.substr(s,550)).stripTags().s.replace('\t','').split("\n");
                    var re = [];
                    x.forEach(function(test){
                      if(S(test).trim().s != ""){ re.push(S(test).trim().s); }
                    });

                    ret.years.push({
                      year : y,
                      taxValue : re[1],
                      taxMissing : re[6].substr(1,re[6].length)
                    });
                  }
                });
              }
              return callback(null,ret);
          });
        });
      });
  });
}

function getParcelInformation(body){
  var key = "<td >Government Unit:</td>";
  var k = body.search(key);
  var match = body.substr(k+key.length,100);
  var s = match.search("<td >");
  var e = match.search("</td>");
  var area = S(match.substr(s+5,e-s-5)).trim().s;

  var key = '<td  valign="Top"  colspan=1 height="15">Property Address:</td>';
  var k = body.search(key);
  var match = body.substr(k+key.length,200);
  var s = match.search("<td>");
  var e = match.search("</td>");
  var addr = S(match.substr(s+4,e-s-4)).trim().s;

  var key = '<td  valign="Top"  colspan=1 height="15">Property Classification:</td>';
  var k = body.search(key);
  var match = body.substr(k+key.length,200);
  var s = match.search("<td>");
  var e = match.search("</td>");
  var type = S(match.substr(s+4,e-s-4)).trim().s;

  var key = '<td  valign="Top" colspan=1 height="19">Acreage & Lot Dimensions:</td>';
  var k = body.search(key);
  var match = body.substr(k+key.length,200);
  var subkey = '<td  valign="Top"  colspan=1 height="19">';
  var s = match.search(subkey);
  var e = match.search("</td>");
  var size = S(match.substr(s+subkey.length,e-s-subkey.length)).trim().s;

  return {
    area : area,
    addressSteet : addr,
    type : type,
    size : size
  };
}

console.log(process.pid)
