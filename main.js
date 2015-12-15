var sypex = require('sypexgeo-vyvid');
var geoDb = new sypex.Geo('/a/full/path/to/the/SypexGeoCity.dat');
var location = geoDb.find('46.148.53.103');

console.log(JSON.stringify(location, null, '  '));