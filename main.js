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

function reloadable(modulename) {
  var mymodule = require(modulename);
  fs.watchFile(modulename, function (current, previous) {
    if (current.mtime.toString() !== previous.mtime.toString()) {
      console.log('reloading module:' + modulename);
      delete require.cache[require.resolve(modulename)];
      mymodule = require(modulename);
      console.log('version changed:' + newmodule.version);
    }
  });
  return mymodule;
}
var		Client				= reloadable(__dirname+'/lib/client.js'),
		Manager				= reloadable(__dirname+'/lib/manager.js'),
		Signal				= reloadable(__dirname+'/lib/signal.js');

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


	//gData.client.cs.listen(config.srv.client);




/*var location = geoDb.find('46.148.53.103');

console.log(JSON.stringify(location, null, '  '));*/
