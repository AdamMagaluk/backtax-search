var fs = require('fs');

fs = require('fs')
fs.readFile('./address_with_lat.csv', 'utf8', function (err,data) {
  if (err) {
    return console.log(err);
  }
  var stream = fs.createWriteStream("full.kml");
  stream.write('<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.google.com/earth/kml/2"><Document><name>kml_sample1.kml</name>');
  var lines = data.split("\n");
  delete data;
  lines.forEach(function(line){
	var data = line.split(',');
	stream.write('<Placemark><name>'+data[2]+'</name><description>'+data[2]+'</description><Point><coordinates>'+data[1]+','+data[0]+', 0</coordinates></Point></Placemark>');
  });
  stream.write('</Document></kml>');
});