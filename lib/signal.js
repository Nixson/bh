var 	http 					= require('http'),
		fs 						= require('fs'),
		qs						= require('querystring'),
		url						= require('url');

http.globalAgent.keepAlive = true;
var agent = new http.Agent({keepAlive: true});

module.exports = function(gData){
	var info = {
		gData: gData,
		cList: {},
		cs: null,
		globalTimeout: {},
		responseText: {},
		header: {},
		responseTextBlank: '{"request":"Ok"}',
		headerBlank: 200,
		close: function(){
			this.cs.close();
		},
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
						_this.gData.Emitter.emit('isResponseSignal'+_this.cList[uuid]);
					});
					request.on('clientError', function() {
						_this.gData.Emitter.emit('isResponseSignal'+_this.cList[uuid]);
					});
					request.on('close', function() {
						_this.gData.Emitter.emit('isResponseSignal'+_this.cList[uuid]);
					});

			});
			_this.cs.timeout = 0;
			_this.cs.listen(_this.gData.config.srv.signal);


		},
		timerOut: {},
		response: function(info, callback){
			var _this = this;
			var st = qs.unescape(info.path.pathname).split('/');
			if(st.length < 4){
				callback('{"error","no data"}',400);
				return;
			}
			var uid = st[2];
			_this.cList[info.session] = uid;
			_this.gData.Emitter.once('isResponseSignal'+uid,function(){
				clearTimeout(_this.globalTimeout[uid]);
				clearTimeout(_this.timerOut[uid])
				if(typeof _this.responseText[uid]=='undefined'){
					callback(_this.responseTextBlank,_this.headerBlank);
				}
				else{
					callback(_this.responseText[uid],_this.header[uid]);
					delete _this.responseText[uid];
					delete _this.header[uid];
				}

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
			if( typeof info.path.query["canvas"] !='undefined') _this.canvasClient(uid,info.path.query.canvas);
			if( typeof info.path.query["manager"] !='undefined') _this.signalManager(uid,info);

		},
		canvasClient: function(uid,info){
			var _this = this;
			_this.gData.canvas[uid] = info;
			_this.gData.Emitter.emit('isResponseSignal'+uid);
		},
		signalManager: function(uid,info){
			var st = qs.unescape(info.path.pathname).split('/');
			var _this = this;
			var cid = parseInt(st[1]).toString();
			if(cid=="0" || cid==""){
				_this.responseText[uid] = JSON.stringify({error:"Not correct cid"});
				_this.header[uid] = 404;
				_this.gData.Emitter.emit('isResponseSignal'+uid);
			}
			process.nextTick(function(){
				switch(info.path.query.manager){
					case "List": _this.getUsers(uid,cid); break;
					case "Msg": _this.getMsg(uid,cid,info.path.query.info); break;
					case "MsgOffline": _this.getMsgOffline(uid,cid,info.path.query.info); break;
					case "SendMsg": 
							_this.sendMsg(info.path.query.to,cid,info.path.query.info);
							_this.gData.Emitter.emit('isResponseSignal'+uid);
					break;
					case "usrInfo": _this.usrInfo(info.path.query.to,cid,info.path.query.info); _this.gData.Emitter.emit('isResponseSignal'+uid); break;
				}
			});
		},
		usrInfo: function(cid,sid,info){
			var _this = this;
			if(typeof _this.gData.clients[cid]=='undefined')
				return;
			info = JSON.parse(info);
			_this.gData.clients[cid][info.attr] = info.value;
			_this.sendManagers(sid,{action: "clientInfo", info: _this.gData.clients[cid]});
			if(typeof _this.saveUsr[cid]!='undefined'){
				clearTimeout(_this.saveUsr[cid]);
			}
			_this.saveUsr[cid] = setTimeout(function(){
				_this.save(cid);
				delete _this.saveUsr[cid];
			},10000);
			
		},
		saveUsr: {},
		getMsg: function(mid,sid,cid){
			var _this = this;
			if(typeof _this.gData.msg[cid] == "undefined" && typeof _this.gData.clients[cid]!='undefined' && !_this.gData.clients[cid].find ){
				_this.responseText[mid] = JSON.stringify({msg:[]});
				_this.header[mid] = 200;
				_this.gData.Emitter.emit('isResponseSignal'+mid);
				return;
			}
			if(typeof _this.gData.msg[cid] == "undefined") {
				_this.gData.client.loadMsg(cid,function(){
					if(typeof _this.gData.msg[cid] == "undefined") _this.gData.msg[cid] = [];
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
		getMsgOffline: function(mid,sid,cid){
			var _this = this;
			if(typeof _this.gData.msgof[cid] == "undefined" && typeof _this.gData.clients[cid]!='undefined' && !_this.gData.clients[cid].find ){
				_this.responseText[mid] = JSON.stringify({msg:[]});
				_this.header[mid] = 200;
				_this.gData.Emitter.emit('isResponseSignal'+mid);
				return;
			}
			if(typeof _this.gData.msgof[cid] == "undefined") {
				_this.gData.client.loadMsgOffline(cid,function(){
					if(typeof _this.gData.msgof[cid] == "undefined") _this.gData.msgof[cid] = [];
					_this.responseText[mid] = JSON.stringify({msg:_this.gData.msgof[cid]});
					_this.header[mid] = 200;
					_this.gData.Emitter.emit('isResponseSignal'+mid);
				});
				return;
			}
			_this.responseText[mid] = JSON.stringify({msg:_this.gData.msgof[cid]});
			_this.header[mid] = 200;
			_this.gData.Emitter.emit('isResponseSignal'+mid);
		},
		loadClientsOffline: function(muid,cid){
			var _this = this;
			_this.gData.sectionClientsOffline[cid] = [];
			var limit  = 50;
			_this.gData.mysql.getConnection(function(err,connection){
					connection.query( 'select uid, sid, info, msg from bh_customer where cid = ? and msg != "" order by uid desc limit ?',[cid,limit], function(err, rows) {
						connection.release();
						if(typeof rows!='undefined' && typeof rows[0]!='undefined'){
							for(var num in rows){
								var client = JSON.parse(rows[num]['info']);
								client.uid = parseInt(rows[num].uid);
								client.sid = rows[num].sid;
								client.cid = cid;
								client.online = false;
								if( typeof _this.gData.clients[client.uid]=='undefined'){
									_this.gData.sectionClientsOffline[cid].push(client.uid);
									_this.gData.clients[client.uid] = client;
									var msg = JSON.parse(rows[num]['msg']);
									if( typeof _this.gData.msg[client.uid]=='undefined')
										_this.gData.msg[client.uid] = [];
									if( typeof msg[0]=='undefined'){
										var chat = [];
										chat.push({"list":msg,"status":1});
										_this.gData.msg[client.uid] = chat;
									}
									else {
										_this.gData.msg[client.uid] = msg;
									}
								}else {
									if(typeof _this.gData.msg[client.uid]=='undefined'){
										_this.gData.sectionClientsOffline[cid].push(client.uid);
										var msg = JSON.parse(rows[num]['msg']);
										if( typeof msg[0]=='undefined'){
											var chat = [];
											chat.push({"list":msg,"status":1});
											_this.gData.msg[client.uid] = chat;
										}
										else {
											_this.gData.msg[client.uid] = msg;
										}
									}
								}
							}
							_this.getClientsOffline(muid,cid);
						}
					});
			});
		},
		loadClientsMsgOffline: function(muid,cid){
			var _this = this;
			_this.gData.sectionClientsMsgOffline[cid] = [];
			var limit  = 50;
			_this.gData.mysql.getConnection(function(err,connection){
					connection.query( 'select uid, sid, info, offmsg from bh_customer where cid = ? and offmsg != "" order by uid desc limit ?',[cid,limit], function(err, rows) {
						connection.release();
						if(typeof rows!='undefined' && typeof rows[0]!='undefined'){
							for(var num in rows){
								var client = JSON.parse(rows[num]['info']);
								client.uid = parseInt(rows[num].uid);
								client.sid = parseInt(rows[num].sid);
								client.cid = cid;
								if( typeof _this.gData.clients[client.uid]=='undefined' ){
									_this.gData.clients[client.uid] = client;
									var msg = JSON.parse(rows[num]['offmsg']);
									if( typeof msg[0]=='undefined'){
										var chat = [];
										chat.push({"list":msg,"status":1});
										_this.gData.msgof[client.uid] = chat;
									}else {
										_this.gData.msgof[client.uid] = msg;
									}
								}
								_this.gData.sectionClientsMsgOffline[cid].push(client.uid);
							}
							_this.getClientsMsgOffline(muid,cid);
						}
					});
			});
		},
		getClientsOffline: function(muid,sid){
			var _this = this;
			var ClientList = _this.gData.sectionClientsOffline[sid];
			var List = [];
			for( Client in ClientList ){
				var cid = ClientList[Client];
				if(typeof _this.gData.clients[cid] !='undefined'){
					List.push(_this.gData.clients[cid]);
				}
			}
			if(List.length > 0)
				_this.gData.manager.send(muid,{listOffline: List});
		},
		getClientsMsgOffline: function(muid,cid){
			var _this = this;
			var ClientList = _this.gData.sectionClientsMsgOffline[cid];
			var List = [];
			for( Client in ClientList ){
				var cid = ClientList[Client];
				if(typeof _this.gData.clients[cid] !='undefined'){
					List.push(_this.gData.clients[cid]);
				}
			}
			if(List.length > 0)
				_this.gData.manager.send(muid,{listMsgOffline: List});
		},
		getUsers: function(muid,cid){
			var _this = this;
			_this.responseText[muid] = JSON.stringify({timestamp:_this.gData.time()});
			_this.header[muid] = 200;
			_this.gData.Emitter.emit('isResponseSignal'+muid);
			if(cid == 0) return;
			if( typeof _this.gData.sectionClientsOffline[cid] == 'undefined'){
				_this.loadClientsOffline(muid,cid);
			}
			else
				_this.getClientsOffline(muid,cid);
			if( typeof _this.gData.sectionClientsMsgOffline[cid] == 'undefined'){
				_this.loadClientsMsgOffline(muid,cid);
			}
			else
				_this.getClientsMsgOffline(muid,cid);

			if( typeof _this.gData.sectionClients[cid] == 'undefined') return;
			var ClientList = _this.gData.sectionClients[cid];
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
		sendManagers: function(cid,msg){
			var _this = this;
			if(typeof cid == 'number')
				cid = cid.toString();
			if( typeof _this.gData.sectionManagers[cid] == 'undefined') return false;
			var isSend = false;
			var ManagerList = _this.gData.sectionManagers[cid];
			for(var Manager in ManagerList ){
				var muid = ManagerList[Manager];
				if(typeof _this.gData.managers[muid] !='undefined'){
					isSend = true;
					_this.gData.manager.send(muid,msg);
				}
			}
			return isSend;
		},
		userIn: function(uid,cid){
			var _this = this;
			_this.sendManagers(cid,{action: "clientInfo", info: _this.gData.clients[uid] });
		},
		userOut: function(uid,cid){
			var _this = this;
			_this.sendManagers(cid,{action: "clientOut", info: { uid: uid } });
		},
		signalClient: function(uid,info){
			var _this = this;
			var query = JSON.parse(info.path.query.client);
			if(typeof query.trigger !='undefined'){
				_this.trigger(uid,query.trigger);
				if(query.trigger=="Open"){
					_this.bot(uid,1);
				}
				_this.gData.Emitter.emit('isResponseSignal'+uid);
				return;
			}
			if(typeof query.offlineText != 'undefined'){
				_this.saveOffline(uid, query);
				_this.gData.Emitter.emit('isResponseSignal'+uid);
				return;
			}
			else if (typeof query.startMessage != 'undefined'){
				process.nextTick(function(){
					_this.sendFromClient(uid,query.startMessage,true);
				});
				_this.gData.Emitter.emit('isResponseSignal'+uid);
				return;
			}
			else if (typeof query.end != 'undefined'){
				process.nextTick(function(){
					_this.sendFromClient(uid,"",false);
				});
				_this.gData.Emitter.emit('isResponseSignal'+uid);
				return;
			}
			else if (typeof query.activator != 'undefined'){
				if(typeof _this.gData.clients[uid]!='undefined')
					_this.gData.clients[uid].active = 1;
				_this.gData.Emitter.emit('isResponseSignal'+uid);
				return;
			}
			else if (typeof query.msg != 'undefined'){
				process.nextTick(function(){
					_this.message(uid,query.msg);
				});
				_this.gData.Emitter.emit('isResponseSignal'+uid);
				return;
			}
			else if (typeof query.bot != 'undefined'){
				process.nextTick(function(){
					_this.bot(uid,2);
				});
				_this.gData.Emitter.emit('isResponseSignal'+uid);
				return;
			}
			else
				console.log("signal",uid, query);
		},
		message: function(cid,query){
			var _this = this;
			if(typeof _this.gData.msg[cid] == 'undefined'){
				_this.gData.msg[cid] = [{"list":{},"status":0}];
				//_this.stat.online.add(cid);
			}
			var last = _this.gData.msg[cid].length-1;
			if(_this.gData.msg[cid][last].status > 0){
				_this.gData.msg[cid].push({"list":{},"status":0});
				//_this.stat.online.add(cid);
				last++;
			}
			query.value.text = query.value.text.replace(/<[^>]+>/gi,'');
			query.value.text = query.value.text.split("\n").join("<br />");
			if( typeof _this.gData.msg[cid][last].list[query.uid] == 'undefined') {
				_this.gData.msg[cid][last].list[query.uid] = query.value;
				_this.gData.msg[cid][last].list[query.uid].uid = query.uid;
			}
			_this.gData.msg[cid][last].list[query.uid].block = last;
			if(typeof _this.gData.clients[cid]=='undefined') return;
			var cidU = _this.gData.clients[cid].cid;
			if(typeof cidU == 'number')
				cidU = cidU.toString();
			if(cidU=='0') return;
			_this.sendManagers(cidU,{action: "msg", info: {uid: cid, msg: _this.gData.msg[cid][last].list[query.uid]} });
		},
		sendMsg: function(cid,cidU,msgNj){
			var _this = this;
			var msg = JSON.parse(msgNj);
			if(typeof cidU == 'number')
				cidU = cidU.toString();
			if(typeof _this.gData.msg[cid] == 'undefined'){
				_this.gData.msg[cid] = [{"list":{},"status":0}];

			}
			var last = _this.gData.msg[cid].length-1;
			if(_this.gData.msg[cid][last].status > 0){
				if(typeof _this.gData.clients[cid]!='undefined' && _this.gData.clients[cid].online){
					_this.gData.msg[cid].push({"list":{},"status":0});
					last++;
					//_this.stat.online.add(cid);
				}
			}
			msg.text = msg.text.replace(/<[^>]+>/gi,'');
			msg.text = msg.text.split("\n").join("<br />");
			_this.gData.msg[cid][last].list[msg.uid] = msg;
			_this.gData.msg[cid][last].list[msg.uid].block = last;
			_this.gData.client.send(cid,{msg:msg});
			_this.sendManagers(cidU,{action: "msg", info: {uid: cid, msg: _this.gData.msg[cid][last].list[msg.uid]} });
		},
		sendFromClient: function(cid, msg, send){
			var _this = this;
			if(typeof _this.gData.clients[cid]=='undefined') return;
			var cidU = _this.gData.clients[cid].cid;
			if(typeof cidU == 'number')
				cidU = cidU.toString();
			if(cidU=='0') return;
			if(send)
				_this.sendManagers(cidU,{action: "startMessage", info: {uid: cid, msg: msg} });
			else
				_this.sendManagers(cidU,{action: "endMessage", info: {uid: cid} });
		},
		trigger: function(uid,type){
			var _this = this;
			if(typeof uid=='number')
				uid = uid.toString();
			if(typeof _this.gData.clients[uid]=='undefined')
				return;
			if(typeof _this.gData.clients[uid].cid=='number')
				_this.gData.clients[uid].cid = _this.gData.clients[uid].cid.toString();
			if(typeof _this.gData.sections[_this.gData.clients[uid].sid] == 'undefined')
				return;
			var cid = _this.gData.sections[_this.gData.clients[uid].sid].cid;
			if(typeof cid=='number')
				cid = cid.toString();
			var typeNum = 0;
			switch(type){
				case "Load": typeNum = 1; break;
				case "Open": typeNum = 2; break;
				case "Send": typeNum = 3; break;
			}
			if(typeNum == 0)
				return;
			if(cid == "0")
				return;
			if(typeof _this.gData.triggers[cid]=='undefined'){
				_this.gData.triggers[cid] = [];
				_this.gData.mysql.getConnection(function(err,connection){
					connection.query( 'select * from bh_triggers where cid = ?',[cid], function(err, rows) {
						if(typeof rows!='undefined' && typeof rows[0]!='undefined'){
							for( var num in rows ){
								var type = parseInt(rows[num].type);
								if(typeof _this.gData.triggers[cid][type]=='undefined')
									_this.gData.triggers[cid][type] = [];
								_this.gData.triggers[cid][type].push({
									uid: rows[num].uid,
									safe: rows[num].safe,
									action: JSON.parse(rows[num].tcontent)
								});
							}
							if(_this.gData.triggers[cid][typeNum]!='undefined')
								_this.triggerAction(uid,_this.gData.triggers[cid][typeNum]);
						}
						connection.release();
					});
				});
			}else {
				if(typeof _this.gData.triggers[cid][typeNum]!='undefined')
					_this.triggerAction(uid,_this.gData.triggers[cid][typeNum]);
			}
			/*
			{"condition":["and",["hour_of_day",">","13"],["visitor_ip","=","213.187.118.106"]],"actions":[{"wait":"30"},{"sendMessageToVisitor":"hello"}]}

			*/
		},
		triggerAction: function(uid,info){
			var _this = this;
			if(typeof uid=='number')
				uid = uid.toString();
			var client = this.gData.clients[uid];
			var isPush = false;
			for( id in info){
				var trigger = info[id];
				if(client.triggers.indexOf(trigger.uid) >= 0 && trigger.safe==1)
					continue;
				_this.triggerConditionProc(uid,client,trigger);
				client.triggers.push(trigger.uid);
				client.triggers = _this.gData.getUnique(client.triggers);
				isPush = true;
			}
			if(isPush){
				_this.gData.client.send(uid,{strigger: _this.gData.clients[uid].triggers});
			}
		},
		triggerConditionProc: function(uid,client,trigger){
			var _this = this;
			process.nextTick(function(){_this.triggerCondition(uid,client,trigger);});
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
					var uidMsg  = 0;
					var activeList = -1;
					if( typeof _this.gData.msg[uid]!='undefined'){
						for( var lidUID in _this.gData.msg[uid]){
							if(_this.gData.msg[uid][lidUID].status==0)
								activeList = lidUID;
							for( var lid in _this.gData.msg[uid][lidUID].list){
								if(lid.substr(0,1)=='m'){
									if(uidMsg < parseInt(lid.substring(1)))
										uidMsg = parseInt(lid.substring(1));
								}
							}
						}
					}
					else
						_this.gData.msg[uid] = [];
					uidMsg++;
					uidMsg = "m"+uidMsg;
					var msg = {
						uid: uidMsg,
						text: actions[st].sendMessageToVisitor,
						data: parseInt(Number(new Date())/1000),
						bot: 1,
						who: 1
					};
					if(activeList==-1) {
						_this.gData.msg[uid].push({"list":{},"status":0});
						activeList = _this.gData.msg[uid].length-1;
						//_this.stat.online.add(client.uid);
					}
					msg.block = activeList;
					_this.gData.msg[uid][activeList].list[uidMsg] = msg;
					
					_this.gData.client.send(uid,{msg: msg});
					_this.sendMsg(client.uid,client.cid,JSON.stringify(msg));
				} else if(typeof actions[st].sendMessageToConsultant !='undefined') {
					var uidMsg  = 0;
					var activeList = -1;
					if( typeof _this.gData.msg[uid]!='undefined'){
						for( var lidUID in _this.gData.msg[uid]){
							if(_this.gData.msg[uid][lidUID].status==0)
								activeList = lidUID;
							for( var lid in _this.gData.msg[uid][lidUID].list){
								if(lid.substr(0,1)=='c'){
									if(uidMsg < parseInt(lid.substring(1)))
										uidMsg = parseInt(lid.substring(1));
								}
							}
						}
					}
					else
						_this.gData.msg[uid] = [];
					uidMsg++;
					uidMsg = "c"+uidMsg;
					var msg = {
						uid: uidMsg,
						text: actions[st].sendMessageToConsultant,
						data: parseInt(Number(new Date())/1000),
						bot: 1,
						who: 0
					};
					if(activeList==-1) {
						_this.gData.msg[uid].push({"list":{},"status":0});
						activeList = _this.gData.msg[uid].length-1;
						//_this.stat.online.add(client.uid);
					}
					msg.block = activeList;
					_this.gData.msg[uid][activeList].list[uidMsg] = msg;
					_this.sendMsg(client.uid,client.cid,JSON.stringify(msg));
					_this.gData.client.send(uid,{msg: msg});
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
		bot: function(uid,num){
			var _this = this;
			var sid = this.gData.clients[uid].sid;
			console.log("bot");
			if(typeof this.gData.bot[sid] =='undefined')
				this.loadBot(sid,function(){_this.activeBot(sid,_this.gData.clients[uid].cid,uid,num);});
			else
				_this.activeBot(sid,_this.gData.clients[uid].cid,uid,num);
		},
		loadBot: function(sid, callback){
			var _this = this;
			console.log("loadBot");
			_this.gData.bot[sid] = {};
			_this.gData.mysql.getConnection(function(err,connection){
				connection.query( 'SELECT * from bh_bot where sid = ? and action = 1',[sid], function(err, rows) {
					connection.release();
					if(typeof rows!='undefined' && typeof rows[0]!='undefined'){
						for(var n in rows){
							var r = {};
							r.type = rows[n].bot_type;
							r.text = rows[n].bot_text;
							_this.gData.bot[sid][r.type] = r;
						}
					}
					callback();
				});
			});
		},
		activeBot: function(sid,cid,uid,num){
			var _this = this;
			process.nextTick(function(){
				// 1. Проверка онлайн
				if(typeof _this.gData.sectionManagers[cid]!='undefined'){
					if(num == 1 && typeof _this.gData.msg[uid] == 'undefined' && typeof _this.gData.bot[sid][1]!='undefined') {
						_this.gData.msg[uid] = [];
						var actionNum = 0;
						_this.gData.msg[uid].push({"list":{},"status":0});
						uidMsg = "m1";
						var msg = {
							uid: uidMsg,
							text: _this.gData.bot[sid][1].text,
							data: _this.gData.time(),
							bot: 1,
							who: 1,
							block: actionNum
						};

						_this.gData.msg[uid][actionNum].list[uidMsg] = msg;
						_this.gData.client.send(uid,{msg: msg});
						_this.sendManagers(cid,{action: "msg", info: {uid: uid, msg: msg} });
					}
					if(num == 2 && typeof _this.gData.msg[uid] != 'undefined' && _this.gData.msg[uid].length==1 &&  _this.gData.bot[sid][2]!='undefined'){
						var cnt = 0;
						var cntU = 0;
						var actionNum = 0;
						for(var nm in _this.gData.msg[uid][actionNum].list){
							if(_this.gData.msg[uid][actionNum].list[nm].who==1){
								cnt++;
							}
							if(_this.gData.msg[uid][actionNum].list[nm].who==0){
								cntU++;
							}
							if(cnt > 1 && cntU > 0)
								break;
						}
						if(cnt==1 && cntU > 0){
							uidMsg = "m2";
							var msg = {
								uid: uidMsg,
								text: _this.gData.bot[sid][2].text,
								data: _this.gData.time(),
								bot: 1,
								who: 1,
								block:actionNum
							};
							_this.gData.msg[uid][actionNum].list[uidMsg] = msg;
							_this.gData.client.send(uid,{msg: msg});
							_this.sendManagers(cid,{action: "msg", info: {uid: uid, msg: msg} });
						}
					}
				}
			});
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
			_this.stat.offline.add(uid,client.mid, client.sid,query.offlineActivator);
			if (typeof client.on!='undefined') delete client.on;
			if(typeof _this.gData.sections[client.sid].off_email != 'undefined' && _this.gData.sections[client.sid].off_email!=''){
				var pData = qs.stringify({
					'data': JSON.stringify({
						'mail': _this.gData.sections[client.sid].off_email,
						'msg': query.offlineText,
						'client': client
					})
				});
				var req = http.request({
					'host': '127.0.0.1',
					'port': _this.gData.config.srv.mail,
					'path': '/index.js',
					'method': 'POST',
					'headers': {
				        'Content-Type': 'application/x-www-form-urlencoded',
				        'Content-Length': Buffer.byteLength(pData)
				    }
				});
				req.write(pData);
				req.end();
			}
			var pushData = {data:_this.gData.time(),text:query.offlineText,status:0,who:3};
			if(query.offlineActivator)
				pushData.active = 1;
			_this.gData.mysql.getConnection(function(err,connection){
				connection.query( 'select uid, offmsg, ctime from bh_customer where uid = ?',[uid], function(err, rows) {
					var post = {sid: client.sid, cid: client.cid, info: JSON.stringify(client)};
					if(typeof rows!='undefined' && typeof rows[0]!='undefined'){
						var offline = [];
						if(rows[0].offmsg!=''){
							offline = JSON.parse(rows[0].offmsg);
						}
						pushData.uid = "f"+(offline.length+1);
						offline.push(pushData);
						post.offmsg = JSON.stringify(offline);
						if(rows[0].ctime=='0')
							post.ctime = _this.gData.time();
						connection.query( "UPDATE bh_customer SET ? WHERE uid = "+uid, post,function(){
							connection.release();
						});
					}
					else {
						post.uid = uid;
						post.ctime = _this.gData.time();
						var offline = [];
						pushData.uid = "f1";
						offline.push(pushData);
						post.offmsg = JSON.stringify(offline);
						connection.query("INSERT INTO bh_customer SET ?", post,function(){
							connection.release();
						});
					}
				});
			});
		},
		save: function(cid,callback){
			var _this = this;
			if (typeof _this.gData.clients[cid].on!='undefined') delete _this.gData.clients[cid].on;
			var post = {info: JSON.stringify(_this.gData.clients[cid])};
			if(typeof _this.gData.msg[cid]!='undefined');
				post.msg = JSON.stringify(_this.gData.msg[cid]);
			var insert = false;
			if(!_this.gData.clients[cid].find){
				post.uid = cid;
				post.sid = _this.gData.clients[cid].sid;
				post.cid = _this.gData.clients[cid].cid;
				post.ctime = _this.gData.clients[cid].time;
				insert = true;
			}
			_this.gData.mysql.getConnection(function(err,connection){
				if(insert)
					connection.query("INSERT INTO bh_customer SET ?", post,function(){
						connection.release();
						if( typeof callback == 'function')
							callback();
					});
				else
					connection.query( "UPDATE bh_customer SET ? WHERE uid = "+cid, post,function(){
						connection.release();
						if( typeof callback == 'function')
							callback();
					});
			});
		},
		_this: null,
		stat: {
			parent: null,
			uniq: function(sid,uid){
				var statOption = {
						host: "127.0.0.1",
						port: gData.config.srv.stat,
						path: "/set/user/uniq/"+sid,
						method: "POST",
						agent: agent
				}
				var req = http.request(statOption);
				req.on('error', function(e) {
					console.log('problem with request: ' + e.message);
				});
				req.write('info={}');
				req.end();
				//console.log('stat uniq',sid,uid);
			},
			save: function(uid){
				var _this = this.parent;
				if(typeof _this.gData.clients[uid]=='undefined')
					return;
				var client = _this.gData.clients[uid];
				var sid = client.sid;
				var ctime = client.timeIn;
				//console.log(client.online);
				if(client.last.length > 0)
					ctime = client.last[0].timeIn;
				var dtime = _this.gData.time() - ctime;
				dtime -= _this.gData.config.timeout/1000;
				var statOption = {
						host: "127.0.0.1",
						port: gData.config.srv.stat,
						path: "/set/user/info/"+sid,
						method: "POST",
						agent: agent
				}
				var req = http.request(statOption);
				req.on('error', function(e) {
					console.log('problem with request: ' + e.message);
				});
				req.write("info="+JSON.stringify({
					"data": ctime,
					"dtime": dtime,
					"pages": client.numPage
				}));
				req.end();
				if(typeof _this.gData.msg[uid]!='undefined'){
					var last = _this.gData.msg[uid].length-1;
					if(_this.gData.msg[uid][last].status==0){
						_this.gData.msg[uid][last].status = 1;
						var reaction = false;
						var mData = 0;
						var fCl = true;
						var cData = 0;
						var sReaction = 0;
						var manager = 0;
						for( var suid in _this.gData.msg[uid][last].list){
							if(!reaction && suid.substr(0,1)=="m"){
								var msg = _this.gData.msg[uid][last].list[suid];
								//console.log("manager",msg);
								if( typeof msg.bot=="undefined" || msg.bot==0){
									reaction = true;
									mData = msg.data;
									if(typeof msg.manager!='undefined') {
										var spl = msg.manager.split("|");
										manager = parseInt(spl[0]);
									}
								}
							}
							if(fCl && suid.substr(0,1)=="c"){
								var msg = _this.gData.msg[uid][last].list[suid];
								//console.log("client",msg);
								if( typeof msg.bot=="undefined" || msg.bot==0){
									fCl = false;
									cData = msg.data;
								}
							}
						}
						if(reaction && mData > cData){
							sReaction = mData-cData;
						}
						if(cData > 0) {
							statOption.path = "/set/online/"+sid;
							var req = http.request(statOption);
							req.on('error', function(e) {
								console.log('problem with request: ' + e.message);
							});
							//console.log("/set/online manager", manager);
							req.write("info="+JSON.stringify({
								"activator": client.active,
								"manager": manager,
								"reaction": reaction,
								"time": sReaction
							}));
							req.end();
						}
					}
				}
				//console.log('stat save',uid);
				//проверить открытые и закрытые чаты (online reaction)
			},
			userIn: function(uid,novisitor){
				var _this = this.parent;
				if(typeof _this.gData.clients[uid]=='undefined' || typeof _this.gData.clients[uid].sid=='undefined')
					return;
				var client = _this.gData.clients[uid];
				var online = 0;
				if(typeof _this.gData.sectionManagers[client.cid]!='undefined')
					online = 1;
				var statOption = {
						host: "127.0.0.1",
						port: gData.config.srv.stat,
						path: "/set/user/add/"+client.sid,
						method: "POST",
						agent: agent
				}
				var req = http.request(statOption);
				req.on('error', function(e) {
					console.log('problem with request: ' + e.message);
				});
				if(typeof client.on=='undefined')
					client.on = [0,0];
				if(client.on[online]==0){
					client.on[online] = 1;
					if(novisitor)
						req.write('info={"online":'+online+',"novisitor":1}');
					else
						req.write('info={"online":'+online+'}');
					req.end();
				}
				//console.log('stat userIn',uid);
			},
			managerIn: function(uid, sid, cid){
				var _this = this.parent;
				var statOption = {
						host: "127.0.0.1",
						port: gData.config.srv.stat,
						path: "/set/manager/in/"+sid+"/"+uid,
						method: "POST",
						agent: agent
				}
				var req = http.request(statOption);
				req.on('error', function(e) {
					console.log('problem with request: ' + e.message);
				});
				req.write('info={}');
				req.end();
				var cnt = 0;
				if(typeof _this.gData.sectionManagers[cid]!='undefined')
					cnt = _this.gData.sectionManagers[cid].length;
				//console.log('stat managerIn',uid,cnt);
				if(typeof _this.gData.sectionClients[cid]!='undefined' && cnt == 1){
					var clients = _this.gData.sectionClients[cid];
					for(var cn in clients){
						_this.stat.userIn(clients[cn],true);
						_this.gData.client.send(clients[cn],{reCheck:true});
					}
				}
			},
			managerOut: function(uid,sid,cid){
				var _this = this.parent;
				var statOption = {
						host: "127.0.0.1",
						port: gData.config.srv.stat,
						path: "/set/manager/out/"+sid+"/"+uid,
						method: "POST",
						agent: agent
				}
				var req = http.request(statOption);
				req.on('error', function(e) {
					console.log('problem with request: ' + e.message);
				});
				req.write('info={}');
				req.end();
				var cnt = 0;
				if(typeof _this.gData.sectionManagers[cid]!='undefined')
					cnt = _this.gData.sectionManagers[cid].length;
				//console.log('stat managerOut',uid,cnt);
				if(typeof _this.gData.sectionClients[cid]!='undefined' && cnt==1){
					var clients = _this.gData.sectionClients[cid];
					for(var cn in clients){
						_this.stat.userIn(clients[cn],true);
						_this.gData.client.send(clients[cn],{reCheck:true});
					}
				}
			},
			online: {
				parent: null,
				add: function(uid){
					var _this = this.parent;
					console.log('stat online add chat',uid);
					//проверить активатор
					//проверить написал когда клиент online
				}
			},
			offline: {
				parent: null,
				add: function(uid,mid,sid,activator){
					var _this = this.parent;
					var statOption = {
						host: "127.0.0.1",
						port: _this.gData.config.srv.stat,
						path: "/set/offline/"+sid,
						method: "POST",
						agent: agent
				}
				var req = http.request(statOption);
				req.on('error', function(e) {
					console.log('problem with request: ' + e.message);
				});
				req.write('info={"action":"add","manager":'+mid+',"activator":'+activator+'}');
				req.end();
				}
			}
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
	info._this = info;
	info.stat.parent = info;
	info.stat.online.parent = info;
	info.stat.offline.parent = info;
	return info;
};