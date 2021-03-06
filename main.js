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
		geoDb 				= new sypex.Geo('/opt/usr/bh/lib/SxGeoCity.dat'),
		logStream			= openLog(__dirname+"/../log/error-main.log");

function openLog(path){
	return fs.createWriteStream(path, {
        flags: "a", encoding: "utf8", mode: 0644
    });
}

function log(msg) {
    logStream.write(msg + "\n");
}

var cPath = __dirname+"/lib/client.js",
	mPath = __dirname+"/lib/manager.js",
	sPath = __dirname+"/lib/signal.js";
	zPath = __dirname+"/lib/command.js";
var		Client				= require(cPath),
		Manager				= require(mPath),
		Signal				= require(sPath),
		Command				= require(zPath);

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
		command: null,
		clients: {},
		sectionClients: {},
		managers: {},
		sectionManagers: {},
		sectionList: {},
		queue: {},
		bot: {},
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
		msgof: {},
		canvas: {},
		sectionClientsOffline: {},
		sectionClientsMsgOffline: {},
		validator: validator,
		time: function(){
			return parseInt((new Date).getTime()/1000);
		},
		getUnique: function(_this){
			var u = {}, a = [];
			for(var i = 0, l = _this.length; i < l; ++i){
				if(u.hasOwnProperty(_this[i])) {
					continue;
				}
				a.push(_this[i]);
				u[_this[i]] = 1;
			}
			return a;
		}
	};
	gData.client = new Client(gData);
	gData.manager = new Manager(gData);
	gData.signal = new Signal(gData);
	gData.command = new Command(gData);

	gData.client.bind();
	gData.manager.bind();
	gData.signal.bind();
	gData.command.bind();

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
fs.watchFile(zPath,function (current, previous) {
	if (current.mtime.toString() !== previous.mtime.toString()) {
      delete require.cache[require.resolve(zPath)];
      var Scommand = require(zPath);
      gData.command.close();
      delete gData.command;
      gData.command = new Scommand(gData);
      gData.command.bind();
	}
});
log("Starting...");
	//gData.client.cs.listen(config.srv.client);
process.on('uncaughtException', (err) => {
	console.log("on uncaughtException",err.stack);
	log(err.stack);
});
process.addListener("uncaughtException",function(e){
	console.log("listen uncaughtException",e.stack);
	log(e.stack);
});

process.once("SIGTERM", function() {
    log("Stopping...");

    logStream.on("close", function() {
        process.exit(0);
    }).end();
});

/*var location = geoDb.find('46.148.53.103');

console.log(JSON.stringify(location, null, '  '));*/
