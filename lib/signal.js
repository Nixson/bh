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
			if( typeof info.path.query["canvas"] !='undefined') _this.canvasClient(uid,info);
			if( typeof info.path.query["manager"] !='undefined') _this.signalManager(uid,info);

		},
		canvasClient: function(uid,info){
			var _this = this;
			console.log("canvas",uid,info);
			_this.gData.Emitter.emit('isResponseSignal'+uid);

		},
		signalManager: function(uid,info){
			var st = info.path.pathname.split('/');
			var _this = this;
			process.nextTick(function(){
				switch(info.path.query.manager){
					case "List": _this.getUsers(uid,parseInt(st[1])); break;
					case "Msg": _this.getMsg(uid,parseInt(st[1]),info.path.query.info); break;
				}
			});
		},
		getMsg: function(mid,sid,cid){
			var _this = this;
			if(!_this.gData.clients[cid].find){
				_this.responseText[mid] = JSON.stringify({msg:{}});
				_this.header[mid] = 200;
				_this.gData.Emitter.emit('isResponseSignal'+mid);
				return;
			}
			if(typeof _this.gData.msg[cid] == "undefined") {
				_this.gData.client.loadMsg(cid,function(){
					if(typeof _this.gData.msg[cid] == "undefined") _this.gData.msg[cid] = {};
					_this.responseText[mid] = JSON.stringify({msg:_this.gData.msg[cid]});
					_this.header[mid] = 200;
					_this.gData.Emitter.emit('isResponseSignal'+mid);
				});
				return;
			}
			_this.responseText[mid] = JSON.stringify({msg:_this.gData.msg[cid]});
			_this.header[mid] = 200;
			_this.gData.Emitter.emit('isResponseSignal'+mid);
		},
		getUsers: function(muid,sid){
			var _this = this;
			_this.responseText[muid] = JSON.stringify({timestamp:_this.gData.time()});
			_this.header[muid] = 200;
			_this.gData.Emitter.emit('isResponseSignal'+muid);
			if(sid == 0) return;
			if( typeof _this.gData.sectionClients[sid] == 'undefined') return;
			var ClientList = _this.gData.sectionClients[sid];
			var List = [];
			for( Client in ClientList ){
				var cid = ClientList[Client];
				if(typeof _this.gData.clients[cid] !='undefined'){
					List.push(_this.gData.clients[cid]);
					if(_this.gData.clients[cid].find) {
						process.nextTick(function(){
							_this.gData.client.loadMsg(cid);
						});
					}
				}
			}
			if(List.length > 0)
				_this.gData.manager.send(muid,{list: List});
		},
		userIn: function(uid,sid){
			var _this = this;
			if( typeof _this.gData.sectionManagers[sid] == 'undefined') return;
			var isSend = false;
			var ManagerList = _this.gData.sectionManagers[sid];
			for( Manager in ManagerList ){
				var muid = ManagerList[Manager];
				if(typeof _this.gData.managers[muid] !='undefined'){
					isSend = true;
					_this.gData.manager.send(muid,{action: "clientInfo", info: _this.gData.clients[uid] });
				}
			}
			if(isSend && _this.gData.clients[uid].find){
				process.nextTick(function(){
					_this.gData.client.loadMsg(uid);
				});
			}
		},
		userOut: function(uid,sid){
			var _this = this;
			if( typeof _this.gData.sectionManagers[sid] == 'undefined') return;
			var ManagerList = _this.gData.sectionManagers[sid];
			for( Manager in ManagerList ){
				var muid = ManagerList[Manager];
				if(typeof _this.gData.managers[muid] !='undefined'){
					_this.gData.manager.send(muid,{action: "clientOut", info: { uid: uid } });
				}
			}
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
			else if (typeof query.startMessage != 'undefined'){
				process.nextTick(function(){
					_this.sendFromClient(uid,query.startMessage,true);
				});
				_this.gData.Emitter.emit('isResponseSignal'+uid);
			}
			else if (typeof query.end != 'undefined'){
				process.nextTick(function(){
					_this.sendFromClient(uid,"",false);
				});
				_this.gData.Emitter.emit('isResponseSignal'+uid);
			}
			else if (typeof query.msg != 'undefined'){
				process.nextTick(function(){
					_this.message(uid,query);
				});
				_this.gData.Emitter.emit('isResponseSignal'+uid);
			}
			console.log("signal",uid, query);
		},
		message: function(cid,query){
			var _this = this;
			if( typeof _this.gData.msg[cid][query.uid] == 'undefined') {
				_this.gData.msg[cid][query.uid] = query.value;
				_this.gData.msg[cid][query.uid].uid = query.uid;
			}
			if(typeof _this.gData.clients[cid]=='undefined') return;
			var sid = _this.gData.clients[cid].sid;
			if(sid==0) return;
			if(typeof _this.gData.sectionManagers[sid]=='undefined') return;
			var ManagerList = _this.gData.sectionManagers[sid];
			for( Manager in ManagerList ){
				var muid = ManagerList[Manager];
				if(typeof _this.gData.managers[muid] !='undefined'){
						_this.gData.manager.send(muid,{action: "msg", info: _this.gData.msg[cid][query.uid] });
				}
			}
		},
		sendFromClient: function(cid, msg, send){
			var _this = this;
			if(typeof _this.gData.clients[cid]=='undefined') return;
			var sid = _this.gData.clients[cid].sid;
			if(sid==0) return;
			if(typeof _this.gData.sectionManagers[sid]=='undefined') return;
			var ManagerList = _this.gData.sectionManagers[sid];
			for( Manager in ManagerList ){
				var muid = ManagerList[Manager];
				if(typeof _this.gData.managers[muid] !='undefined'){
					if(send)
						_this.gData.manager.send(muid,{action: "startMessage", info: {uid: cid, msg: msg} });
					else
						_this.gData.manager.send(muid,{action: "endMessage", info: {uid: cid} });
				}
			}
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
			var _this = this;
			var client = this.gData.clients[uid];
			var isPush = false;
			for( id in info){
				var trigger = info[id];
				if(client.triggers.indexOf(trigger.uid) >= 0 && trigger.safe==1)
					continue;
				_this.triggerCondition(uid,client,trigger);
				_this.gData.clients[uid].triggers.push(trigger.uid);
				isPush = true;
			}
			if(isPush){
				_this.gData.client.send(uid,{strigger:JSON.stringify(_this.gData.clients[uid].triggers)});
			}
			//this.gData.client.send(uid,{trigger:info});
		},
		triggerCondition: function(uid,client,trigger){
			var _this = this;
			if(trigger.action.condition.length == 0)
				return;
			var typeCondition = 0;
			if(trigger.action.condition[0]=='and')
				typeCondition = 1;
			var action = true;
			if(trigger.action.condition.length > 1){
				for(cond in trigger.action.condition){
					if(cond > 0){
						var br = false;
						var type = trigger.action.condition[cond][1];
						var val = null;
						switch(trigger.action.condition[cond][0]){
							case 'os':
								val = client.os;
								break;
							case 'browser':
								val = client.browser;
								break;
							case 'ref':
								val = client.ref;
								break;
							case 'email':
								val = client.email;
								if(val=='')
									val = client.cemail;
								break;
							case 'phone':
								val = client.phone;
								if(val=='')
									val = client.cphone;
								break;
							case 'name':
								val = client.name;
								if(val=='')
									val = client.cname;
								break;
							case 'url':
								val = client.url;
								break;
							case 'title':
								val = client.title;
								break;
							case 'cnt_chat':
								val = client.chat;
								break;
							case 'cnt_session':
								val = client.visits;
								break;
							case 'country_code':
								val = client.country_code;
								break;
							case 'country_name':
								val = client.country_name;
								break;
							case 'visitor_city':
								val = client.city;
								break;
							case 'visitor_region':
								val = client.region;
								break;
							case 'visitor_ip':
								val = client.ip;
								break;
							case 'cnt_page':
								val = client.numPage;
								break;
							case 'last_page':
								if(client.last.length == 0)
									val = client.url;
								else {
									val = client.last[client.last.length-1].url;
								}
								break;
							case 'visitor_time_on_site':
								val = client.time;
								break;
							case 'visitor_time_on_page':
								val = client.timeIn;
								break;
						}
						if(val !== null){
							switch(type){
								case "=":
										if(val == trigger.action.condition[cond][2])
											br = true;
										break;
								case "!=":
										if(val != trigger.action.condition[cond][2])
											br = true;
										break;
								case ">":
										if(val > trigger.action.condition[cond][2])
											br = true;
										break;
								case "<":
										if(val < trigger.action.condition[cond][2])
											br = true;
										break;
								case "like":
										if(val.indexOf(trigger.action.condition[cond][2]) > -1)
											br = true;
										break;
								case "not like":
										if(val.indexOf(trigger.action.condition[cond][2]) == -1)
											br = true;
										break;
								}

						}
						if(br==false && typeCondition==1){
							action = false;
							break;
						}
						if(br == true && typeCondition==0){
							action = true;
							break;
						}
					}
				}
			}
			if(action){
				if(trigger.action.actions.length > 0){
					_this.triggerActionStart(uid, client, trigger.action.actions);
				}
			}
		},
		triggerActionStart: function(uid,client,actions){
			var _this = this;
			console.log(uid,"actions",actions);
			for(st in actions){
				var isBreak = false;
				if(typeof actions[st].wait !='undefined'){
					if(_this.gData.validator.isInt(actions[st].wait)){
						var timeout = parseInt(actions[st].wait);
						isBreak = true;
						actions.splice(0, st+1);
						setTimeout(function(){
							_this.triggerActionStart(uid, client, actions);
						},timeout*1000);
					}
				} else if(typeof actions[st].sendMessageToVisitor !='undefined') {
					_this.gData.client.sendMsg(uid,{text:actions[st].sendMessageToVisitor});
				} else if(typeof actions[st].sendMessageToConsultant !='undefined') {
					_this.gData.manager.sendMsg(uid,{text:actions[st].sendMessageToConsultant});
				} else if(typeof actions[st].addTag !='undefined') {
					_this.gData.clients[uid].tags.push(actions[st].addTag);
					_this.gData.manager.reClient(uid);
				} else if(typeof actions[st].rmTag !='undefined') {
					if(_this.gData.clients[uid].tags.indexOf(actions[st].rmTag) != -1){
						var intV = _this.gData.clients[uid].tags.indexOf(actions[st].rmTag);
						delete _this.gData.clients[uid].tags.splice(intV,1);
						_this.gData.manager.reClient(uid);
					}
				} else if(typeof actions[st].editName !='undefined') {
					if(_this.gData.clients[uid].name != actions[st].editName) {
						_this.gData.clients[uid].name = actions[st].editName;
						_this.gData.manager.reClient(uid);
					}
				} else if(typeof actions[st].editComment !='undefined') {
					if(_this.gData.clients[uid].mcomment != actions[st].editComment) {
						_this.gData.clients[uid].mcomment = actions[st].editComment;
						_this.gData.manager.reClient(uid);
					}
				}
				if(isBreak)
					break;
			}
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