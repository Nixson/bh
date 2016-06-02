var 	http 					= require('http'),
		fs 						= require('fs'),
		qs						= require('querystring'),
		url						= require('url'),
		WebSocketServer 		= require('ws').Server;

require ("console-trace");

module.exports = function(gData){
	return {
		gData: gData,
		cs: null,
		ws: {},
		wss: null,
		globalTimeout: {},
		isWs: {},
		timer: {},
		close: function(){
			var _this = this;
			_this.cs.close();
			_this.wss.close();
		},
		bind: function(){
			var _this = this;
			_this.cs = http.Server(function(request, response) {
					request.setEncoding("utf8");
					var uuid = _this.getUUID();
					_this.gData.mList[uuid] = 1;
					var info = url.parse(request.url,true);
					info.headers = request.headers;
					if(info.pathname=='/' || info.pathname=='/favicon.ico'){
						response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
						response.write("\n");
						response.end();
					}else {
						process.nextTick(function(){
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
									info.type = "post";
									_this.response({session:uuid,path:info},function(resp,headerCode){
										if(resp.substr(0,1)=='{')
											response.writeHead(headerCode, {"Content-Type": "application/json; charset=utf8"});
										else
											response.writeHead(headerCode, {"Content-Type": "application/javascript; charset=utf8"});
										response.write(resp+"\n");
										response.end();
										delete _this.gData.mList[uuid];
									});
								});
							}
							else{
								info.type = "get";
								_this.response({session:uuid,path:info},function(resp,headerCode){
									if(!response.finished){
										if(resp.substr(0,1)=='{')
											response.writeHead(headerCode, {"Content-Type": "application/json; charset=utf8"});
										else
											response.writeHead(headerCode, {"Content-Type": "application/javascript; charset=utf8"});
										response.write(resp+"\n");
										response.end();
										delete _this.gData.mList[uuid];
									}
								});
							}
						});
					}
					request.on('error', function() {
						_this.gData.Emitter.emit('isResponseManager'+_this.gData.mList[uuid]);
					});
					request.on('clientError', function() {
						_this.gData.Emitter.emit('isResponseManager'+_this.gData.mList[uuid]);
					});
					request.on('close', function() {
						_this.gData.Emitter.emit('isResponseManager'+_this.gData.mList[uuid]);
					});

			});
			_this.cs.timeout = 0;
			_this.cs.listen(_this.gData.config.srv.manager);
			_this.wss = new WebSocketServer({port: _this.gData.config.srv.websocketmanager});
			_this.wss.on('connection', function(ws) {
				var uuid = _this.getUUID();
				_this.gData.mList[uuid] = 1;
				var info = url.parse(ws.upgradeReq.url,true);
				info.headers = ws.upgradeReq.headers;
				if(info.pathname=='/' || info.pathname=='/favicon.ico'){
					ws.close();
				}else {
					_this.responseWs({session:uuid,ws:ws,path:info});
				}
			ws.on('close', function close() {
				_this.gData.mtimerOut[_this.gData.mList[uuid]] = setTimeout(function(){
					_this.clean(_this.gData.mList[uuid],false);
					},_this.gData.config.timeout);
			});
		});

		},
		responseText: {},
		header: {},
		responseTextBlank: '{"request":"Ok"}',
		headerBlank: 200,
		replaceAll: function(find,replace,str){
			return str.replace(new RegExp(find, 'g'), replace);
		},
		random: function(min,max){
			return Math.floor(Math.random() * (max - min)) + min;
		},
		responseWs: function(info){
			var _this = this;
			var st = qs.unescape(info.path.pathname).split('/');
			var uidHash = st[2];
			var stUid = st[2].split("|");
			var uid = stUid[0];
			if(typeof uid == 'number'){
				uid = uid.toString();
			}
			if(uid=='0' || uid==''){
				info.ws.close();
				return true;
			}
			clearTimeout(_this.gData.mtimerOut[uidHash]);
			_this.ws[uidHash] = info.ws;
			_this.isWs[uidHash] = true;
			_this.gData.mList[info.session] = uidHash;
			if(typeof _this.gData.managers[uid]=='undefined'){
				_this.gData.managers[uid] = {sid: [],mList: []};
				_this.fill(uid,info);
			}
			if(_this.gData.managers[uid].mList.indexOf(uidHash)==-1)
				_this.gData.managers[uid].mList.push(uidHash);

			if(typeof _this.queue[uidHash] != 'undefined'){
				var pull = [];
				for(qNum in _this.queue[uidHash]){
					pull.push(_this.queue[uidHash][qNum]);
					_this.queue[uidHash].splice(qNum,1);
				}
				_this.ws[uidHash].send(JSON.stringify({pull:pull}));
			}
			_this.gData.Emitter.on('isResponseManagerWs'+uidHash,function(){
					if(!_this.ws[uidHash].upgradeReq.connection.destroyed){
						if(typeof _this.queue[uidHash] != 'undefined'){
							var pull = [];
							for(qNum in _this.queue[uidHash]){
								pull.push(_this.queue[uidHash][qNum]);
								_this.queue[uidHash].splice(qNum,1);
							}
							_this.ws[uidHash].send(JSON.stringify({pull:pull}));
						}
					}else {
						console.log('ws destroyed');
						//console.log(_this.queue[uidHash]);
					}
			});
		},
		queue: {},
		sendSession: function(sess,msg){
			var _this = this;
			if(typeof _this.queue[sess] == 'undefined')
				_this.queue[sess] = [];
			_this.queue[sess].push(msg);
			if(_this.isWs[sess]){
				_this.gData.Emitter.emit('isResponseManagerWs'+sess);
			}
			else{
				_this.gData.Emitter.emit('isResponseManager'+sess);
			}
		},
		img: function(sid,mid,callback){
			var _this = this;
			_this.gData.mysql.getConnection(function(err,connection){
				connection.query("select m.uid id, m.img, m.jinfo, m.jimg, sm.jinfo sminfo from bh_section_manager sm inner join bh_manager m on m.uid = sm.mid where sm.sid = ? and sm.mid = ?",[sid,mid],function(err,rows){
					if(typeof rows !='undefined' && typeof rows[0]!='undefined' && typeof rows[0].id !='undefined'){
						var jMan = {};
						jMan.id = rows[0].id;
						jMan.img = rows[0].img;
						if(jMan.img=="0" || jMan.img=="")
							jMan.img = "101";
						if(rows[0].jinfo ==""){
							rows[0].jinfo = new Buffer(fs.readFileSync(_this.gData.config.dir.client+'/img/manager/'+jMan.img+".png")).toString('base64');
							connection.query("UPDATE bh_manager SET jinfo = '"+rows[0].jinfo+"' where uid = ?",[jMan.id],function(err,rel){
								connection.release();
							});
						}
						else
							connection.release();
						var psNum = "";
						switch(_this.gData.sections[sid].ps){
							case 1:case 2: psNum = "12"; break;
							case 3: psNum = "3"; break;
							case 4:case 5: psNum = "45"; break;
							case 6: psNum = "6"; break;
						}
						var sminfo = rows[0].sminfo;
						var insertSM = false;
						if( sminfo == ""){
							sminfo = {};
							insertSM = true;
							sminfo[psNum] = new Buffer(fs.readFileSync(_this.gData.config.dir.client+'/img/block/'+sid+"-"+psNum+"."+rows[0].block_img+".png")).toString('base64');
						}else {
							sminfo = JSON.parse(sminfo);
							if(typeof sminfo[psNum] =="undefined"){
								insertSM = true;
								sminfo[psNum] = new Buffer(fs.readFileSync(_this.gData.config.dir.client+'/img/block/'+sid+"-"+psNum+"."+rows[0].block_img+".png")).toString('base64');
							}
						}
						if(insertSM){
							_this.gData.mysql.getConnection(function(err,connection){
								connection.query("UPDATE bh_section_manager SET jinfo = '"+JSON.stringify(sminfo)+"' where uid = ?",[jMan.id],function(err,rel){
									connection.release();
								});
							});
						}
						jMan.img = rows[0].jinfo;
						var img = {};
						if(rows[0].jimg!='')
							img = JSON.parse(rows[0].jimg);
						if(typeof img.normal!='undefined')
							jMan.img = img.normal;
						jMan.block_img = sminfo[psNum];
						callback(Man.img,sminfo);
						delete jMan;
					}
					else {
						callback(null,null,true);
					}
					return;
				});
			});
			callback(null,null,true);
		},
		get: function(sid,mid,callback){
			var _this = this;
			if(typeof sid=='number')
				sid = sid.toString();
			if(typeof mid=='number')
				mid = mid.toString();
			var W = 'sm.sid = '+sid+' limit 1';
			if(mid=="0"){
				if(typeof _this.gData.sectionManagers[sid]!='undefined'){
					mid = _this.gData.sectionManagers[sid][_this.random(0,_this.gData.sectionManagers[sid].length)];
				}
			}else {
				if(typeof _this.gData.sectionManagers[sid]!='undefined'){
					var find = false;
					for(num in _this.gData.sectionManagers[sid]){
						if(_this.gData.sectionManagers[sid][num]==mid){
							find = true;
							break;
						}
					}
					if(!find){
						mid = _this.gData.sectionManagers[sid][_this.random(0,_this.gData.sectionManagers[sid].length)];
					}
				}
				else
					mid = "0";
			}
			var isFind = true;
			if(mid!="0"){
				if(typeof _this.gData.managers[mid]!='undefined'){
					clearTimeout(_this.gData.mtimerOut[mid]);
					if(typeof _this.gData.managers[mid].section!='undefined' && _this.gData.managers[mid].section[sid]!='undefined'){
						callback(_this.gData.managers[mid],false);
						_this.gData.mtimerOut[mid] = setTimeout(function(){
									_this.clean(mid,true);
						},_this.gData.config.timeout);
						return;
					}
				}
			}
			_this.getInfo(sid,mid,function(manager,error){
				callback(manager,error);
				return;
			});
			callback(null,true);
		},
		send: function(uid, msg){
			var _this = this;
			if(typeof uid == 'number'){
				uid = uid.toString();
			}
			if(uid.indexOf('|') > 0){
				_this.sendSession(uid,msg);
				return;
			}
			if( 	   typeof _this.gData.managers[uid]!='undefined'
			 		&& typeof _this.gData.managers[uid].mList!='undefined'
			 		&& _this.gData.managers[uid].mList.length > 0
			 	){
				var sessions = _this.gData.managers[uid].mList;
				for( var i in sessions){
					_this.sendSession(sessions[i],msg);
				}
			} else {
				console.log("send false");
			}
		},
		response: function(info, callback){
			var _this = this;
			var st = qs.unescape(info.path.pathname).split('/');
			var uidHash = st[2];
			_this.timer[uidHash] = _this.gData.time();
			var stUid = st[2].split("|");
			var uid = stUid[0];
			if(typeof uid == 'number'){
				uid = uid.toString();
			}
			if(typeof st[2]=='undefined' || uid=="0" || uid==""){
				callback("{error: 'not uid'}",402);
				return true;
			}

			_this.gData.mList[info.session] = uidHash;
			if(typeof _this.gData.managers[uid]=='undefined'){
				_this.gData.managers[uid] = { sid: [], mList: []};
				_this.fill(uid,info);
			}
			if(typeof _this.gData.managers[uid].mList == "undefined")
				_this.gData.managers[uid].mList = [];
			if(_this.gData.managers[uid].mList.indexOf(uidHash)==-1)
				_this.gData.managers[uid].mList.push(uidHash);
			if( info.path.type=='post' ){
				return true;
			}else {
				_this.isWs[uidHash] = false;
			}
			if(typeof _this.queue[uidHash] != 'undefined' && _this.queue[uidHash].length > 0){
				var pull = [];
				for(qNum in _this.queue[uidHash]){
					pull.push(_this.queue[uidHash][qNum]);
					_this.queue[uidHash].splice(qNum,1);
				}
				callback(JSON.stringify({pull:pull}),200);
				return;
			}
			clearTimeout(_this.gData.mtimerOut[uidHash]);
			_this.gData.Emitter.once('isResponseManager'+uidHash,function(){
				clearTimeout(_this.globalTimeout[uidHash]);
				clearTimeout(_this.gData.mtimerOut[uidHash]);
				if(typeof _this.queue[uidHash] != 'undefined' && _this.queue[uidHash].length > 0){
					var pull = [];
					for(qNum in _this.queue[uidHash]){
						pull.push(_this.queue[uidHash][qNum]);
						_this.queue[uidHash].splice(qNum,1);
					}
					callback(JSON.stringify({pull:pull}),200);
				}
				else
					callback(_this.responseTextBlank,_this.headerBlank);
				_this.gData.mtimerOut[uidHash] = setTimeout(function(){
					_this.clean(uidHash,false);
					},_this.gData.config.timeout);
			});
			_this.globalTimeout[uidHash] = setTimeout(function(){
				_this.gData.Emitter.emit('isResponseManager'+uidHash);
			},_this.gData.config.lpTimeout);
		},
		getUUID: function(){
			var _this = this;
			var uuid = _this.createUUID();
			if( typeof _this.gData.mList[uuid] != 'undefined')
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
		},
		fillSection: function(sid, callback){
			var _this = this;
			if(typeof sid=='number')
				sid = sid.toString();
			if( typeof _this.gData.sections[sid]=='undefined'){
				var section = sid;
				_this.gData.mysql.getConnection(function(err,connection){
									connection.query("SELECT * from bh_section where uid = ?",[section],function(err,rows){
										if(typeof rows=='undefined' || typeof rows[0]=='undefined')
											callback('{"error":true}',404);
										else {
											_this.gData.sections[section] = rows[0];
											var info = _this.gData.sections[section].info;
											_this.gData.sections[section].info = {};
											if(info!="")
												_this.gData.sections[section].info = JSON.parse(info);
											_this.loadInfo(section);
											callback();
										}
										connection.release();
									});
								});
			}
			else {
				callback();
			}
		},
		fill: function(uid,info){
			var _this = this;
			if(typeof uid == 'number')
				uid = uid.toString();
			var st = info.path.pathname.split('/');
			var query = info.path.query;
			var sid = parseInt(st[1]);
			sid = sid.toString();
			if(typeof _this.gData.sectionManagers[sid]=='undefined')
				_this.gData.sectionManagers[sid] = [];
			if(_this.gData.sectionManagers[sid].indexOf(uid) == -1){
				_this.gData.sectionManagers[sid].push(uid);
				gData.signal.stat.managerIn(uid,sid);
			}
			var manager = _this.gData.managers[uid];
			if(typeof manager.sid =="string")
					manager.sid = [];
			if(manager.sid.indexOf(sid)==-1)
				manager.sid.push(sid);
			_this.fillSection(sid,function(){
				_this.getInfo(sid,uid);
				/*_this.gData.mysql.getConnection(function(err,connection){
					connection.query("select m.uid id, m.img, m.info, m.jinfo, m.jimg, sm.jinfo sminfo, sm.block_img, m.version version_img, sm.version version_block from bh_section_manager sm inner join bh_manager m on m.uid = sm.mid where sm.mid = ? ans sm.sid = ?",[uid,sid],function(err,rows){
						if(typeof rows !='undefined' && typeof rows[0]!='undefined'){
							manager.id = rows[0].id;
							manager.version_img = rows[0].version_img;
							if(typeof manager.section=='undefined')
								manager.section = {};
							manager.section[sid] = rows[0].version_block;
							manager.info = _this.replaceAll("\n","",rows[0].info);
							manager.info = _this.replaceAll("\r","",manager.info);
							manager.info = _this.replaceAll("'","&prime;",manager.info);
							manager.info = _this.replaceAll('"',"&quot;",manager.info);
						}
						connection.release();
					});
				});*/
			});

		},
		getInfo: function(sid,uid,callback){
			var _this = this;
			var W = "sm.mid = "+uid+" and ";
			if(uid=="0")
				W = " ";
			_this.gData.mysql.getConnection(function(err,connection){
				connection.query("select m.uid id, m.info, m.version version_img, sm.version version_block from bh_section_manager sm inner join bh_manager m on m.uid = sm.mid where "+W+"sm.sid = ?",[sid],function(err,rows){
						if(typeof rows !='undefined' && typeof rows[0]!='undefined' && typeof rows[0].id !='undefined'){
							if(typeof _this.gData.managers[rows[0].id]=='undefined')
								_this.gData.managers[rows[0].id] = { sid: [sid], mList: []};
							else{
								if(typeof _this.gData.managers[rows[0].id].sid =="string")
									_this.gData.managers[rows[0].id].sid = [];
								if(_this.gData.managers[rows[0].id].sid.indexOf(sid)==-1)
									_this.gData.managers[rows[0].id].sid.push(sid);
							}
							var manager = _this.gData.managers[rows[0].id];
							manager.id = rows[0].id;
							manager.version_img = rows[0].version_img;
							if(typeof manager.section=='undefined')
								manager.section = {};
							manager.section[sid] = rows[0].version_block;
							manager.info = _this.replaceAll("\n","",rows[0].info);
							manager.info = _this.replaceAll("\r","",manager.info);
							manager.info = _this.replaceAll("'","&prime;",manager.info);
							manager.info = _this.replaceAll('"',"&quot;",manager.info);
							if(typeof callback=='function')
								callback(manager,false);
							_this.gData.mtimerOut[manager.id] = setTimeout(function(){
								_this.clean(manager.id,true);
							},_this.gData.config.timeout);
						}else
							if(typeof callback=='function')
								callback(null,true);
						connection.release();
				});
			});
		},
		infoSection: function(sid,uid,callback){
			var _this = this;
			if(typeof _this.gData.managers[uid]=='undefined'){
				_this.getInfo(sid,uid,callback);
				return;
			}else {
				if(typeof _this.gData.managers[uid].section=='undefined'){
					_this.getInfo(sid,uid,callback);
					return;
				}else {
					if(typeof _this.gData.managers[uid].section[sid]=='undefined'){
						_this.getInfo(sid,uid,callback);
						return;
					}
				}
			}
			callback(_this.gData.managers[uid],false);

		},
		clean: function(uidHash,noOut){
			var _this = this;
			if(typeof uidHash=='number')
				uidHash = uidHash.toString();
			delete _this.queue[uidHash];
			console.log(typeof uidHash);
			var uidS = uidHash.split('|');
			var uid = uidS[0];
			if(typeof uid=='number')
				uid = uid.toString();
			if(typeof _this.gData.managers[uid]=='undefined')
				return;
			if(typeof _this.gData.managers[uid].mList=='undefined')
				_this.gData.managers[uid].mList = [];
			if(_this.gData.managers[uid].mList.length > 0 && _this.gData.managers[uid].mList.indexOf(uidHash)!=-1){
					_this.gData.managers[uid].mList.splice(_this.gData.managers[uid].mList.indexOf(uidHash),1);
			}
			if(typeof _this.gData.managers[uid].mList=='undefined')
				_this.gData.managers[uid].mList = [];
			if(_this.gData.managers[uid].mList.length > 0)
				return;
			var sidArray = _this.gData.managers[uid].sid;
			if(typeof sidArray=='number' || sidArray=="string")
				sidArray = [sidArray.toString()];
			for(var sn in sidArray){
				var sid = sidArray[sn];
				if(typeof noOut=='undefined' || !noOut)
					_this.gData.signal.stat.managerOut(uid,sid);
				if( typeof _this.gData.sectionManagers[sid]!='undefined'){
					console.log(_this.gData.sectionManagers[sid]);
					if(_this.gData.sectionManagers[sid].indexOf(uid) >=0 )
						 _this.gData.sectionManagers[sid].splice(_this.gData.sectionManagers[sid].indexOf(uid),1);
					if(_this.gData.sectionManagers[sid].length == 0)
						delete _this.gData.sectionManagers[sid];
				}
				if( typeof _this.gData.sectionManagers[sid]=='undefined'){
					//delete sections;
					if(typeof _this.gData.sectionClientsOffline[sid] !='undefined'){
						for( var i in _this.gData.sectionClientsOffline[sid])
							_this.cleanClient(_this.gData.sectionClientsOffline[sid][i]);
						delete _this.gData.sectionClientsOffline[sid];
					}
					if(typeof _this.gData.sectionClientsMsgOffline[sid] !='undefined'){
						for( var i in _this.gData.sectionClientsMsgOffline[sid])
							_this.cleanClient(_this.gData.sectionClientsMsgOffline[sid][i]);
						delete _this.gData.sectionClientsMsgOffline[sid];
					}
					if( typeof _this.gData.sectionClients[sid]=='undefined'){
						var cid = _this.gData.sections[sid].cid;
						delete _this.gData.triggers[cid];
						delete _this.gData.sections[sid];
					}
				}
			}
			delete _this.gData.managers[uid];
		},
		cleanClient: function(cid){
			var _this = this;
			if(typeof _this.gData.clients[cid]!='undefined'){
				if(_this.gData.clients[cid].online==false){
					delete _this.gData.clients[cid];
					delete _this.gData.msg[cid];
					delete _this.gData.canvas[cid];
					delete _this.gData.client.queue[cid];
				}
				return;
			}
			delete _this.gData.msg[cid];
			delete _this.gData.canvas[cid];
			delete _this.gData.client.queue[cid];
		},
		loadInfo: function(section,callback){
			var _this = this;
			var infoLocal = _this.gData.sections[section].info;
			if(typeof _this.gData.sections[section].info.bg =='undefined'){
				_this.gData.sections[section].info.bg = new Buffer(fs.readFileSync(_this.gData.config.dir.client+'/img/bg/'+section+'-'+_this.gData.sections[section].imgon+".png")).toString('base64');
				_this.gData.mysql.getConnection(function(err,connection){
									connection.query("UPDATE bh_section SET info = '"+JSON.stringify(_this.gData.sections[section].info)+"' where uid = ?",[section],function(err,result){
										connection.release();
									});
								});
			}
			var psNum = "";
			switch(_this.gData.sections[section].ps){
				case 1:case 2: psNum = "12"; break;
				case 3: psNum = "3"; break;
				case 4:case 5: psNum = "45"; break;
				case 6: psNum = "6"; break;
			}
			if(typeof _this.gData.sections[section].info["off"+psNum] =='undefined'){
				_this.gData.sections[section].info["off"+psNum] = new Buffer(fs.readFileSync(_this.gData.config.dir.client+'/img/block/'+section+'-'+psNum+"."+_this.gData.sections[section].imgoff+".png")).toString('base64');
				_this.gData.mysql.getConnection(function(err,connection){
									connection.query("UPDATE bh_section SET info = '"+JSON.stringify(_this.gData.sections[section].info)+"' where uid = ?",[section],function(err,result){
										connection.release();
									});
								});
			}
			var ret = {};
			ret.bg = _this.gData.sections[section].info.bg;
			ret.off_info = _this.gData.sections[section].def_info;
			ret.off_info = _this.replaceAll("'",'&rsquo;',ret.off_info);
			ret.off_info = _this.replaceAll("\n",'',ret.off_info);
			ret.off_info = _this.replaceAll("\r",'',ret.off_info);
			ret.activinfo = _this.gData.sections[section].activinfo;
			ret.activeoff = _this.gData.sections[section].activeoff;
			ret.active_time_t1 = _this.gData.sections[section].active_time_t1;
			ret.active_time_off = _this.gData.sections[section].active_time_off;
			ret.activ_type = _this.gData.sections[section].activ_type;
			ret.activ_type_off = _this.gData.sections[section].activ_type_off;
			ret.ps = _this.gData.sections[section].ps;
			ret.url = _this.gData.sections[section].url;
			ret.lineImg = _this.gData.sections[section].info["off"+psNum];
			ret.lineStyle = '#cMil_Line {display: none;position: fixed; z-index: 3000000; cursor: pointer;';
			switch(ret.ps){
				case 1: ret.lineStyle +='bottom: 0; right: 10px; width: 264px; height: 43px;'; break;
				case 2: ret.lineStyle +='bottom: 0; left: 10px; width: 264px; height: 43px;';  break;
				case 3: ret.lineStyle +='top: 50%; left: 0; width: 43px; height: 264px; margin-top: -132px; margin-left: 0;'; break;
				case 4: ret.lineStyle +='top: 0; left: 10px; width: 264px; height: 43px;'; break;
				case 5: ret.lineStyle +='top: 0; right: 10px; width: 264px; height: 43px;'; break;
				case 6: ret.lineStyle +='top: 50%; right: 0; width: 43px; height: 264px; margin-top: -132px; margin-left: 0;'; break;
			}
			ret.lineStyle += '}';
			if( typeof callback == 'function')
				callback(JSON.stringify(ret),200);

		}
	}
}


/*




    public function get_var_button($manager,$ps){
	if(is_array($manager)) $RmanagerBg = $manager['block_img'];

*/