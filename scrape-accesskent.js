// Scraping Made Easy with jQuery and SelectorGadget 
// (http://blog.dtrejo.com/scraping-made-easy-with-jquery-and-selectorga)
// by David Trejo
// 
// Install node.js and npm:
//    http://joyeur.com/2010/12/10/installing-node-and-npm/
// Then run
//    npm install jsdom jquery http-agent
//    node numresults.js
// 
var util = require('util')
  , request = require('request')


function paddy(n, p, c) {
    var pad_char = typeof c !== 'undefined' ? c : '0';
    var pad = new Array(1 + p).join(pad_char);
    return (pad + n).slice(-pad.length);
}


var ParcelPin = function(id){
  var self = this;
  this.id = {
    county : 0
    ,township: 0
    ,section: 0
    ,chunk: 0
    ,id: 0
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
  })
}
ParcelPin.prototype.toString = function() {
  return this.id.county + "-" + this.id.township + "-" + this.id.section + "-" + this.id.chunk + "-" + paddy(this.id.id,3);
};
ParcelPin.prototype.searchFormData = function() {
  var self = this;
  return {
    parcelNo2 : ""+self.id.township,
    parcelNo3 : ""+self.id.section,
    parcelNo4 : ""+self.id.chunk,
    parcelNo5 : paddy(self.id.id,3),
  }
};

var parcel = new ParcelPin("41-14-29-181-007");

var yearsToCheck = [2010,2011,2012];

for(var i=0;i<50;i++){
  checkProp(new ParcelPin([41,14,29,181,i]));
}

function checkProp(parcel,callback){

var jar = request.jar();
request.get('https://www.accesskent.com/Property/search.do',{jar : jar},function(e,res,body){
  if(e) return console.error(e)
  request.post('https://www.accesskent.com/Property/search.do',{form: parcel.searchFormData(),jar : jar },function(e,res,body){
      if(e) return console.error(e)

      if(body.search('There were no result found.') != -1){
        console.log(parcel.toString() + " not in search");      
        return;
      }
       
      request.get('https://www.accesskent.com/Property/realEstate.do?parcelNo='+parcel.toString()+'&ele=0',{jar : jar},function(e,res,body){
        if(e) return console.error(e)
        request.get('https://www.accesskent.com/Property/delqSearch.do',{jar : jar},function(e,res,body){
          if(e) return console.error(e)
            if(body){
              yearsToCheck.forEach(function(y){
                if(body.search('parclno='+parcel.toString()+'&taxYr='+y) != -1){
                  console.log(parcel.toString() + " has back taxes for year " + y);      
                }else{
                  console.log(parcel.toString() + " has no back taxes for year " + y);      
                }
              })
            }else{
              console.log(parcel.toString() + " missing body");      
            }
        })
      })
    })
});
}
