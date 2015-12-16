var 	http 				= require('http'),
		fs 					= require('fs'),
		url					= require('url'),
		EventEmitter 		= require('events').EventEmitter,
		redis 				= require('redis'),
		mysql 				= require('mysql'),
		sypex 				= require('sypexgeo-vyvid'),
		Client				= require(__dirname+'/lib/client.js'),
		geoDb 				= new sypex.Geo('/opt/usr/bh/lib/SxGeoCity.dat');


var config = JSON.parse(fs.readFileSync(__dirname+"/config.json", "utf8").toString()),
	pool  = mysql.createPool({
		connectionLimit : 20,
		host			: config.mysql.host,
		user			: config.mysql.user,
		database		: config.mysql.database,
		charset			: config.mysql.charset,
		password		: config.mysql.password
	}),
	gData = {
		clients: {},
		domClients: {},
		managers: {},
		domManagers: {},
		queue: {},
		config: config,
		Emitter: new EventEmitter(),
		redis: redis.createClient(config.redis.port, config.redis.host),
		mysql: pool,
		geo: geoDb,
		client: null,
		manager: null,
		cList: {},
		timerOut: {},
		time: function(){
			return parseInt((new Date).getTime()/1000);
		}
	};

	gData.client = new Client(gData);
	gData.manager = new Client(gData);

	gData.client.bind();


	//gData.client.cs.listen(config.srv.client);




/*var location = geoDb.find('46.148.53.103');

console.log(JSON.stringify(location, null, '  '));*/
