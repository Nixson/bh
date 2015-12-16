var sypex = require('sypexgeo-vyvid');
var geoDb = new sypex.Geo('/opt/usr/bh/lib/SxGeoCity.dat');
var location = geoDb.find('46.148.53.103');

console.log(JSON.stringify(location, null, '  '));
