var util = require('util')
  , request = require('request')
  , async = require('async')
  , jsdom = require('jsdom').jsdom
  , S = require('string')
  , fs = require('fs');

var config = require('./config/config.json');

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
var endTime;
var last = 0;
function printPercentage(){
  var per = Math.round(100.0*(output.totalFinished / output.totalChecked));
  
  if(per % 1 == 0 && per != last){
   console.log(per + "% complete " + output.totalFinished + "/"+output.totalChecked);
   last = per;
  }
}

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
      }
      output.totalFinished++;
      printPercentage();
      callback();
    });
},config.workers);


function writeToFile(){
  var stream = fs.createWriteStream(config.outFile);
  stream.once('open', function(fd) {
      output.matched.forEach(function(item){
        stream.write(item.parcel.toString()+","+item.info.addressSteet+" "+item.info.area+"\n");
      })
  });

  fs.writeFile(config.outFile+".json",JSON.stringify(output), function(err) {
      if(err) {
          console.log(err);
      } else {
          console.log("The file was saved!");
      }
  }); 

}

q.drain = function() {
  endTime = new Date().getTime();
  output.totalMatched = output.matched.length; 
  consoleShow();
  writeToFile();
};

for(var iCounty=config.range.county[0];iCounty<=config.range.county[1];iCounty++){
  for(var iTownship=config.range.township[0];iTownship<=config.range.township[1];iTownship++){
    for(var iSection=config.range.section[0];iSection<=config.range.section[1];iSection++){
      for(var iChunk=config.range.chunk[0];iChunk<=config.range.chunk[1];iChunk++){
        for(var iId=config.range.id[0];iId<=config.range.id[1];iId++){
          output.totalChecked++;
          q.push({parcel: new ParcelPin([iCounty,iTownship,iSection,iChunk,iId])});
        }
      }
    }
  }
}

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
  var window = jsdom(body).createWindow()
    , $ = require('jquery').create(window);
    var ret = {};
    var find = [
      {id : 4,name : "area"},
      {id : 6,name : "status"},
      {id : 7,name : "addressSteet"},
    ];
    var form = $("form");
    find.forEach(function(f){
      ret[f.name] = S($('.avtable-inner tr:nth-child('+f.id+') td:nth-child(2)',form).text()).trim().s;
    });
    return ret;
}