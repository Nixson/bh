var 	http 				= require('http'),
		fs 					= require('fs'),
		url					= require('url'),
		EventEmitter 		= require('events').EventEmitter,
		redis 				= require('redis'),
		mysql 				= require('mysql'),
		sypex 				= require('sypexgeo-vyvid'),
		validator			= require('validator'),
		/*Client				= require(__dirname+'/lib/client.js'),
		Manager				= require(__dirname+'/lib/manager.js'),
		Signal				= require(__dirname+'/lib/signal.js'),*/
		geoDb 				= new sypex.Geo('/opt/usr/bh/lib/SxGeoCity.dat');

var cPath = __dirname+"/lib/client.js",
	mPath = __dirname+"/lib/manager.js",
	sPath = __dirname+"/lib/signal.js";
var		Client				= require(cPath),
		Manager				= require(mPath),
		Signal				= require(sPath);

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
		sectionClients: {},
		managers: {},
		sectionManagers: {},
		queue: {},
		config: config,
		Emitter: new EventEmitter(),
		redis: redis.createClient(config.redis.port, config.redis.host),
		mysql: pool,
		geo: geoDb,
		client: null,
		manager: null,
		signal: null,
		triggers: {},
		cList: {},
		mList: {},
		timerOut: {},
		mtimerOut: {},
		sections: {},
		msg: {},
		canvas: {},
		sectionClientsOffline: {},
		sectionClientsMsgOffline: {},
		validator: validator,
		time: function(){
			return parseInt((new Date).getTime()/1000);
		}
	};
	gData.client = new Client(gData);
	gData.manager = new Manager(gData);
	gData.signal = new Signal(gData);

	gData.client.bind();
	gData.manager.bind();
	gData.signal.bind();

fs.watchFile(__dirname+"/config.json",function (current, previous) {
	if (current.mtime.toString() !== previous.mtime.toString()) {
		var config = JSON.parse(fs.readFileSync(__dirname+"/config.json", "utf8").toString());
		gData.config = config;
	}
});
fs.watchFile(cPath,function (current, previous) {
	if (current.mtime.toString() !== previous.mtime.toString()) {
      delete require.cache[require.resolve(cPath)];
      var Sclient = require(cPath);
      gData.client.close();
      delete gData.client;
      gData.client = new Sclient(gData);
      gData.client.bind();
	}
});

fs.watchFile(mPath,function (current, previous) {
	if (current.mtime.toString() !== previous.mtime.toString()) {
      delete require.cache[require.resolve(mPath)];
      var Smanager = require(mPath);
      gData.manager.close();
      delete gData.manager;
      gData.manager = new Smanager(gData);
      gData.manager.bind();
	}
});

fs.watchFile(sPath,function (current, previous) {
	if (current.mtime.toString() !== previous.mtime.toString()) {
      delete require.cache[require.resolve(sPath)];
      var Ssignal = require(sPath);
      gData.signal.close();
      delete gData.signal;
      gData.signal = new Ssignal(gData);
      gData.signal.bind();
	}
});


	//gData.client.cs.listen(config.srv.client);

process.on('uncaughtException', (err) => {
	console.log("on uncaughtException",err);
});
process.addListener("uncaughtException",function(e){
	console.log("listen uncaughtException",e);
})

/*var location = geoDb.find('46.148.53.103');

console.log(JSON.stringify(location, null, '  '));*/
