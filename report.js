var fs = require('fs');
var data = require('./allparcels.json');

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

  if(a == undefined) return;

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

var stream = fs.createWriteStream("test_report.csv");

data.matched.forEach(function(d){
	var id =  new ParcelPin();
	id.id = d.parcel.id;
	var out = [];
	out.push(id.toString())
	out.push(d.info.addressSteet + " " + d.info.area.substr(5,d.info.area.length))
	out.push(d.info.type)
	out.push(d.info.size)
	out.push(d.years[0].taxValue)
	out.push(d.years[0].taxMissing)
	out.push(d.years[1].taxValue)
	out.push(d.years[1].taxMissing)
	out.forEach(function(x){
		stream.write(x.replace(",","") + ",");
	});
	stream.write("\n");
})