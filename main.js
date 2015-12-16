var 	http 				= require('http'),
		fs 					= require('fs'),
		url					= require('url'),
		EventEmitter 		= require('events').EventEmitter,
		redis 				= require('redis'),
		mysql 				= require('mysql'),
		sypex 				= require('sypexgeo-vyvid'),
		client				= require(__dirname+'/lib/client.js'),
		geoDb = new sypex.Geo('/opt/usr/bh/lib/SxGeoCity.dat');


var config = JSON.parse(fs.readFileSync(__dirname+"/config.json", "utf8").toString()),
	gData = {
		clients: {},
		managers: {},
		queue: {},
		config: config,
		Emitter: new EventEmitter(),
		client: new client(this)
	};

	console.log(gData);

	gData.client.cs.listen(config.srv.client);




/*var location = geoDb.find('46.148.53.103');

console.log(JSON.stringify(location, null, '  '));*/
