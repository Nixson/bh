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

	var globalData = { cList:{},client:{},manager:{},sess:{},queue:{},timerOut:{}};
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