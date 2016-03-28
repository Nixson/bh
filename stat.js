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
		mail: transporter,
		Emitter: new EventEmitter(),
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
fs.watchFile(__dirname+"/config.json",function (current, previous) {
	if (current.mtime.toString() !== previous.mtime.toString()) {
		var config = JSON.parse(fs.readFileSync(__dirname+"/config.json", "utf8").toString());
		gData.config = config;
	}
});
