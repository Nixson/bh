var 	http 				= require('http'),
		fs 					= require('fs'),
		url					= require('url'),
		EventEmitter 		= require('events').EventEmitter,
		redis 				= require('redis'),
		mysql 				= require('mysql'),
		sypex 				= require('sypexgeo-vyvid'),
		validator			= require('validator'),
		mailer				= require('nodemailer'),
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
	transporter = mailer.createTransport(config.mail);
var gData = {
		config: config,
		mysql: pool,
		mailer: transporter,
		mail: null,
		stat: null,
		sections: {},
		managers: {},
		Emitter: new EventEmitter(),
		log: {},
		time: function(){
			return parseInt((new Date).getTime()/1000);
		},
		toHour: function(utime){
			var nowTime = new Date(utime*1000);
			return parseInt((new Date(nowTime.getFullYear(),nowTime.getMonth(),nowTime.getDate(),nowTime.getHours())).getTime()/1000);
		},
		hTime: 0,
		lastH: 0,
		reHtime: function(){
			var nowTime = new Date();
			var hDate = parseInt((new Date(nowTime.getFullYear(),nowTime.getMonth(),nowTime.getDate(),nowTime.getHours())).getTime()/1000);
			if(hDate > this.hTime){
				this.lastH = hDate - 3600;
				this.hTime = hDate;
				return true;
			}
			return false;
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
gData.reHtime();
setInterval(function(){
	if(gData.reHtime()){
		gData.stat.clean();
	}
	gData.stat.save();
},60000);

var mPath = __dirname+"/lib/mailer.js",
	sPath = __dirname+"/lib/stat.js";
var		Mail				= require(mPath),
		Stat				= require(sPath);
gData.mail = new Mail(gData);
gData.mail.bind();
gData.stat = new Stat(gData);
gData.stat.bind();
gData.stat.load();





fs.watchFile(__dirname+"/config.json",function (current, previous) {
	if (current.mtime.toString() !== previous.mtime.toString()) {
		var config = JSON.parse(fs.readFileSync(__dirname+"/config.json", "utf8").toString());
		gData.config = config;
	}
});
fs.watchFile(mPath,function (current, previous) {
	if (current.mtime.toString() !== previous.mtime.toString()) {
      delete require.cache[require.resolve(mPath)];
      var Mail = require(mPath);
      gData.mail.close();
      delete gData.mail;
      gData.mail = new Mail(gData);
      gData.mail.bind();
	}
});

fs.watchFile(sPath,function (current, previous) {
	if (current.mtime.toString() !== previous.mtime.toString()) {
      delete require.cache[require.resolve(sPath)];
      var Stat = require(sPath);
      gData.stat.close();
      delete gData.stat;
      gData.stat = new Stat(gData);
      gData.stat.bind();
	}
});


process.on('uncaughtException', (err) => {
	console.log("on uncaughtException",err.stack);
});
process.addListener("uncaughtException",function(e){
	console.log("listen uncaughtException",e.stack);
});
