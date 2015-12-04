#!/usr/bin/node
var 	http 					= require('http'),
		fs 						= require('fs'),
		url						= require('url'),
		EventEmitter 	= require('events').EventEmitter,
		redis 				= require('redis'),
		mysql 				= require('mysql'),
		client 				= require(__dirname+'/lib/client.js'),
		manager 			= require(__dirname+'/lib/manager.js'),
		numCPUs 			= require('os').cpus().length;

var config = JSON.parse(fs.readFileSync(__dirname+"/config.json", "utf8").toString());

	var globalData = { cList:{},clients:{},client:{},manager:{},sess:{},queue:{},timerOut:{}};
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
	var action = Action(globalData);
	globalData.send = function(msg){
		if(typeof msg.client != 'undefined' && msg.client.uid > 0){
				switch(msg.client.type){
					case "in":
						var newCl = false;
						if(typeof this.clients[msg.client.uid] == 'undefined') {
							newCl = true;
							this.clients[msg.client.uid] = 1;
						}
						this.clients[msg.client.uid]++;
						if(newCl)
							this.send({action:"userIn",type:"client",uid:msg.client.uid});
						break;
					case "exit":
						if(typeof this.clients[msg.client.uid] !='undefined') {
							this.clients[msg.client.uid]--;
							if(this.clients[msg.client.uid]==0){
								delete this.clients[msg.client.uid];
							}
						}
						break;
					case "clear":
						if(typeof this.clients[msg.client.uid] !='undefined' && this.clients[msg.client.uid]==0){
							delete this.clients[msg.client.uid];
							this.send({action:"clear",type:"client",uid:msg.client.uid,cid:msg.client.cid});
						}
						break;
					case "cmd":
						this.cmd({type: "client",uid: msg.client.uid, cid: msg.client.cid});
						break;
				}
		}
		if(typeof msg.manager != 'undefined' && msg.manager.uid > 0){
				switch(msg.manager.type){
					case "in":
						if(typeof globalData.managers[msg.manager.uid] == 'undefined') globalData.managers[msg.manager.uid] = 1;
						globalData.managers[msg.manager.uid][msg.manager.cluster]++;
						break;
					case "exit":
						if(typeof globalData.managers[msg.manager.uid] !="undefined") {
							globalData.managers[msg.manager.uid]--;
							if(globalData.managers[msg.manager.uid]==0){
								delete globalData.managers[msg.manager.uid];
							}
						}
						break;
					case "clear":
						if(typeof globalData.managers[msg.manager.uid] !='undefined' && globalData.managers[msg.manager.uid]==0){
							delete globalData.managers[msg.manager.uid];
						}
						globalData.send({action:"clear",type:"manager",uid:msg.manager.uid,cid:msg.manager.cid});
						break;
					case "cmd":
						globalData.cmd({type: "manager",uid: msg.manager.uid, cid: msg.manager.cid});
						break;
				}
		}
		if(typeof msg.action != 'undefined'){
			switch(msg.action){
				case "clear": action.clear(msg.uid, msg.cid, msg.type);
					break;
				case "userIn": action.userIn(msg.uid, msg.type);
					break;
				case "userOut": action.allManagersSendOut(msg.uid, msg.cid);
					break;
				case "cmd": action.cmd(msg.uid, msg.cid, msg.type);
					break;
			}
		}
	};
	globalData.cmd = function(info, num){
			if( typeof num =='undefined') num = 0;
			if(num > 100) return;
			var _this = this;
			switch(info.type){
				case "client": 
					if(typeof globalData.clients[info.uid]=='undefined' || globalData.clients[info.uid]==0) setTimeout(function(){globalData.cmd(info,num+1);},10);
					else {
							globalData.send({"action":"cmd","type":"client","cid": info.cid, "uid": info.uid});
					}
					break;
				case "manager": 
					if(typeof globalData.managers[info.uid]=='undefined' || globalData.managers[info.uid]==0) setTimeout(function(){globalData.cmd(info,num+1);},10);
					else {
							globalData.send({"action":"cmd","type":"manager","cid": info.cid, "uid": info.uid});
					}
					break;
			}
		};


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
