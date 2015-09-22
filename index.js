#!/usr/bin/node
var cluster 		= require('cluster'),
		http 					= require('http'),
		fs 						= require('fs'),
		url						= require('url'),
		EventEmitter 	= require('events').EventEmitter,
		redis 				= require('redis'),
		mysql 				= require('mysql'),
		client 				= require(__dirname+'/lib/client.js'),
		manager 			= require(__dirname+'/lib/manager.js'),
		numCPUs 			= require('os').cpus().length;

var config = JSON.parse(fs.readFileSync(__dirname+"/config.json", "utf8").toString());


if (cluster.isMaster) {
	var gData = {clients: {}, managers: {}, queue: {client:{},manager:{}}},
		Master 				= require(__dirname+'/lib/master.js');
	var master = new Master(gData,cluster);

	for (var i = 0; i < numCPUs; i++) {
		cluster.fork();
	}
	Object.keys(cluster.workers).forEach(function(id) {
		cluster.workers[id].on('message', function(msg){master.handler(msg,id);});
	});

	http.Server(function(request, response) {
		request.setEncoding("utf8");
		var pathname = url.parse(request.url).pathname;
		if(request.method=="GET" && pathname!='/' && pathname!='/favicon.ico'){
			master.response(pathname,function(headerCode,resp){
				response.writeHead(headerCode, {"Content-Type": "application/json; charset=utf8"});
				response.write(resp+"\n");
				response.end();
			});
		}else {
				response.writeHead(400, {"Content-Type": "application/json; charset=utf8"});
				response.write('{"error":"Bad Request"}'+"\n");
				response.end();
		}
}).listen(config.srv.master);
var redisClient = redis.createClient(config.redis.port, config.redis.host);
setInterval(function(){
	redisClient.keys("bh:c:u:*",function(_,keys){
		if( typeof keys !="undefined" && keys.length > 0) {
			for( var mk in keys){
				readHash(keys[mk],function(keyName){
					redisClient.get(keyName,function(_,resp){
						if(resp!=''){
							var info = JSON.parse(resp);
							redisClient.exists("bh:c:i:"+info.cid+":"+info.uid,function(_,exi){
								if(!exi)
									redisClient.del("bh:c:u:"+info.cid+":"+info.uid);
							});
						}
					});
				})
			}
		}
	});
	redisClient.keys("bh:c:h:*",function(_,keys){
		if( typeof keys !="undefined" && keys.length > 0) {
			for( var mk in keys){
				readHash(keys[mk],function(hashKey){
					redisClient.get(hashKey,function(_,resp){
						if(resp!=''){
							var userUID = resp;
							redisClient.keys("bh:c:i:*:"+userUID,function(_,keysV){
								if (typeof keysV =="undefined" || keysV.length==0){
									redisClient.del(hashKey);
								}
							});
						}
					});
				});
			}
		}
	});
},config.gc);
function readHash(key,callback){callback(key);}
}


if(cluster.isWorker){
	var globalData = { cList:{},client:{},manager:{},sess:{},queue:{},timerOut:{},cluster:cluster};
	var pool  = mysql.createPool({
		connectionLimit : 20,
		host						: config.mysql.host,
		user						: config.mysql.user,
		database				: config.mysql.database,
		charset					: config.mysql.charset,
		password				: config.mysql.password
	});
	var Emitter = new EventEmitter();
	var Action = require(__dirname+'/lib/action.js');
	globalData.Emitter = Emitter;
	globalData.config = config;
	globalData.mysql = pool;
	globalData.redis = redis.createClient(config.redis.port, config.redis.host);
	globalData.worker = cluster.worker.id;
	var action = Action(globalData);

	var clientServer = http.Server(function(request, response) {
		request.setEncoding("utf8");
		var uuid = getUUID();
		globalData.cList[uuid] = 1;
		var pathname = url.parse(request.url).pathname;
		if(pathname=='/' || pathname=='/favicon.ico'){
			response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
			response.write("\n");
			response.end();
		}else {
			var ctrProc = new client(uuid,pathname,request,globalData);
			ctrProc.response(function(resp,headerCode){
				response.writeHead(headerCode, {"Content-Type": "application/json; charset=utf8"});
				response.write(resp+"\n");
				response.end();
				delete globalData.cList[uuid];
			});
		}
		request.on('error', function() {
			console.log('error');
			Emitter.emit('isResponse'+uuid);
		});
		request.on('clientError', function() {
			console.log('clientError');
			Emitter.emit('isResponse'+uuid);
		});
		request.on('close', function() {
			console.log('close');
			Emitter.emit('isResponse'+uuid);
		});

});
	clientServer.timeout = 0;
	clientServer.listen(config.srv.client);

managerPnum = 0;

	var managerServer = http.Server(function(request, response) {
		managerPnum++;
		request.setEncoding("utf8");
		var uuid = getUUID();
		globalData.cList[uuid] = 1;
		var pathname = url.parse(request.url).pathname;
		if(pathname=='/' || pathname=='/favicon.ico'){
			response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
			response.write("\n");
			response.end();
		}else {
			ctrProc = new manager(uuid,pathname,request,globalData);
			ctrProc.response(function(resp,headerCode){
				response.writeHead(headerCode, {"Content-Type": "application/json; charset=utf8"});
				response.write(resp+"\n");
				response.end();
				delete globalData.cList[uuid];
			});
		}
		request.on('error', function() {
			console.log('error');
			Emitter.emit('isResponse'+uuid);
		});
		request.on('clientError', function() {
			console.log('clientError');
			Emitter.emit('isResponse'+uuid);
		});
		request.on('close', function() {
			console.log('close');
			Emitter.emit('isResponse'+uuid);
		});
	});
	managerServer.timeout = 0;
	managerServer.listen(config.srv.manager);
	process.on('message', function(msg) {
		
		switch(msg.action){
			case "clear": action.clear(msg.uid, msg.cid, msg.type);
				break;
			case "userIn": action.userIn(msg.uid, msg.type);
				break;
			case "cmd": action.cmd(msg.uid, msg.cid, msg.type);
				break;
		}
	});
}


//redis 
//socket.io
function getUUID(){
		var uuid = createUUID();
		if( typeof globalData.cList[uuid] != 'undefined')
			return getUUID();
		else
			return uuid;
}
function createUUID() {
		var s = [];
		var hexDigits = "0123456789abcdef";
		for (var i = 0; i < 36; i++) {
				s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
		}
		s[14] = "4";
		s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);
		s[8] = s[13] = s[18] = s[23] = "-";

		var uuid = s.join("");
		return uuid;
}
