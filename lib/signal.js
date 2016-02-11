var 	http 					= require('http'),
		fs 						= require('fs'),
		qs						= require('querystring'),
		url						= require('url');

module.exports = function(gData){
	return {
		gData: gData,
		cList: {},
		cs: null,
		globalTimeout: {},
		responseText: {},
		header: {},
		responseTextBlank: '{"request":"Ok"}',
		headerBlank: 200,
		bind: function(){
			var _this = this;
			_this.cs = http.Server(function(request, response) {
					request.setEncoding("utf8");
					var uuid = _this.getUUID();
					_this.cList[uuid] = 1;
					var info = url.parse(request.url,true);
					info.headers = request.headers;
					if(info.pathname=='/' || info.pathname=='/favicon.ico'){
						response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
						response.write("\n");
						response.end();
					}else {
						if (request.method == 'POST') {
							var body = '';
							request.on('data', function (data) {
								body += data;
								if (body.length > 1e7)
								request.connection.destroy();
							});
							request.on('end', function () {
								var post = qs.parse(body);
								info.query = post;
								_this.response({session:uuid,path:info},function(resp,headerCode){
									if(resp.substr(0,1)=='{')
										response.writeHead(headerCode, {"Content-Type": "application/json; charset=utf8"});
									else
										response.writeHead(headerCode, {"Content-Type": "application/javascript; charset=utf8"});
									response.write(resp+"\n");
									response.end();
									delete _this.cList[uuid];
								});
							});
						}
						else{
							process.nextTick(function(){
								_this.response({session:uuid,path:info},function(resp,headerCode){
									if(resp.substr(0,1)=='{')
										response.writeHead(headerCode, {"Content-Type": "application/json; charset=utf8"});
									else
										response.writeHead(headerCode, {"Content-Type": "application/javascript; charset=utf8"});
									response.write(resp+"\n");
									response.end();
									delete _this.cList[uuid];
								});
							});
						}
					}
					request.on('error', function() {
						console.log('error');
						_this.gData.Emitter.emit('isResponseSignal'+_this.cList[uuid]);
					});
					request.on('clientError', function() {
						console.log('clientError');
						_this.gData.Emitter.emit('isResponseSignal'+_this.cList[uuid]);
					});
					request.on('close', function() {
						console.log('close');
						_this.gData.Emitter.emit('isResponseSignal'+_this.cList[uuid]);
					});

			});
			_this.cs.timeout = 0;
			_this.cs.listen(_this.gData.config.srv.signal);


		},
		timerOut: {},
		response: function(info, callback){
			var _this = this;
			var st = info.path.pathname.split('/');
			if(st.length < 4){
				callback('{"error","no data"}',400);
				return;
			}
			var uid = st[2];
			_this.cList[info.session] = uid;
			_this.gData.Emitter.once('isResponseSignal'+uid,function(){
				clearTimeout(_this.globalTimeout[uid]);
				clearTimeout(_this.timerOut[uid])
				if(typeof _this.responseText[uid]=='undefined')
					callback(_this.responseTextBlank,_this.headerBlank);
				else
					callback(_this.responseText[uid],_this.header[uid]);
				_this.timerOut[uid] = setTimeout(function(){
					_this.clean(uid,info);
					},_this.gData.config.timeout);
			});
			_this.globalTimeout[uid] = setTimeout(function(){
				_this.gData.Emitter.emit('isResponseSignal'+uid);
			},_this.gData.config.lpTimeout);
			process.nextTick(function(){
				_this.signal(uid,info);
			});
		},
		clean: function(uid,info){
			var _this = this;
			delete _this.timerOut[uid];
			delete _this.globalTimeout[uid];
			delete _this.cList[info.session];
		},
		signal: function(uid,info){
			var _this = this;
			if( typeof info.path.query["client"] !='undefined') _this.signalClient(uid,info);
		},
		signalClient: function(uid,info){
			var _this = this;
			var query = JSON.parse(info.path.query.client);
			if(typeof query.trigger !='undefined'){
				_this.trigger(uid,query.trigger);
				if(query.trigger=="Open"){
					_this.bot(uid,info.path);
				}
				_this.gData.Emitter.emit('isResponseSignal'+uid);
			}
			if(typeof query.offlineText != 'undefined'){
				_this.saveOffline(uid, query);
				_this.gData.Emitter.emit('isResponseSignal'+uid);
			}
			console.log(uid, query);
		},
		trigger: function(uid,type){
			var _this = this;
			if(typeof _this.gData.sections[_this.gData.clients[uid].sid] == 'undefined')
				return;
			var cid = _this.gData.sections[_this.gData.clients[uid].sid].cid;
			console.log(cid);
			var typeNum = 0;
			switch(type){
				case "Load": typeNum = 1; break;
				case "Open": typeNum = 2; break;
				case "Send": typeNum = 3; break;
			}
			if(typeNum == 0)
				return;
			if(cid == 0)
				return;
			if(typeof _this.gData.triggers[cid]=='undefined'){
				_this.gData.mysql.getConnection(function(err,connection){
					connection.query( 'select * from bh_triggers where cid = ?',[cid], function(err, rows) {
						_this.gData.triggers[cid] = {};
						if(typeof rows!='undefined' && typeof rows[0]!='undefined'){
							for( var num in rows ){
								if(typeof _this.gData.triggers[cid][rows[num].type]=='undefined')
									_this.gData.triggers[cid][rows[num].type] = [];
								_this.gData.triggers[cid][rows[num].type].push({
									uid: rows[num].uid,
									safe: rows[num].safe,
									action: JSON.parse(rows[num].tcontent)
								});
							}
							if(_this.gData.triggers[cid][typeNum]!='undefined')
								_this.triggerAction(uid,_this.gData.triggers[cid][typeNum]);
						}else {
							console.log("no trigger");
						}
						connection.release();
					});
				});
			}else {
				if(typeof _this.gData.triggers[cid][typeNum]!='undefined')
					_this.triggerAction(uid,_this.gData.triggers[cid][typeNum]);
				else
					console.log("no trigger");
			}
			/*
			{"condition":["and",["hour_of_day",">","13"],["visitor_ip","=","213.187.118.106"]],"actions":[{"wait":"30"},{"sendMessageToVisitor":"hello"}]}

			*/
		},
		triggerAction: function(uid,info){
			console.log("trigger",uid,info);
		},
		bot: function(uid,info){
			
		},
		saveOffline: function(uid, query){
			var _this = this;
			var client = _this.gData.clients[uid];
			client.cname = query.offlineName;
			if(_this.gData.validator.isEmail(query.offlinePhone)){
				client.cemail = query.offlinePhone;
			}
			else if(_this.gData.validator.isMobilePhone(query.offlinePhone,_this.gData.clients[uid].locale)) {
				client.cphone = query.offlinePhone;
			}
			else {
				client.ccomment = query.offlinePhone;
			}
			_this.gData.mysql.getConnection(function(err,connection){
				connection.query( 'select uid, offmsg from bh_customer where uid = ?',[uid], function(err, rows) {
					var post = {sid: client.sid, info: JSON.stringify(client)};
					if(typeof rows!='undefined' && typeof rows[0]!='undefined'){
						var offline = [];
						if(rows[0].offmsg!=''){
							offline = JSON.parse(rows[0].offmsg);
						}
						offline.push({time:_this.gData.time(),text:query.offlineText,status:0});
						connection.query( "UPDATE bh_customer SET ? WHERE uid = "+uid, post,function(){
							connection.release();
						});
					}
					else {
						post.uid = uid;
						var offline = [];
						offline.push({time:_this.gData.time(),text:query.offlineText,status:0});
						connection.query("INSERT INTO bh_customer SET ?", post,function(){
							connection.release();
						});
					}
				});
			});
		},
		getUUID: function(){
			var _this = this;
			var uuid = _this.createUUID();
			if( typeof _this.cList[uuid] != 'undefined')
				return _this.getUUID();
			else
				return uuid;
		},
		createUUID: function() {
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
	};
};