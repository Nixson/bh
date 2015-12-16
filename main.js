var 	http 					= require('http'),
		fs 						= require('fs'),
		url						= require('url'),
		EventEmitter 	= require('events').EventEmitter,
		redis 				= require('redis'),
		mysql 				= require('mysql'),
		sypex = require('sypexgeo-vyvid'),
		geoDb = new sypex.Geo('/a/full/path/to/the/SypexGeoCity.dat');


var config = JSON.parse(fs.readFileSync(__dirname+"/config.json", "utf8").toString()),
	gData = {
		clients: {},
		managers: {},
		queue: {},
		config: config
	};

	console.log(gData);





/*var location = geoDb.find('46.148.53.103');

console.log(JSON.stringify(location, null, '  '));*/
