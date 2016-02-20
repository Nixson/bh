var 	http 					= require('http'),
		fs 						= require('fs'),
		qs						= require('querystring'),
		url						= require('url'),
		WebSocketServer 		= require('ws').Server;

require ("console-trace");

var clientBlank = {
	 uid: 0
	,sid: 0
	,connection: 0
	,triggers:[]
	,cname: ""
	,name: ""
	,cphone: ""
	,phone: ""
	,cemail: ""
	,email: ""
	,ccomment: ""
	,mcomment: ""
	,chat: 0
	,visits: 0
	,chash: ""
	,region: ""
	,domain: ""
	,ip: ""
	,protocol: ""
	,country_name: ""
	,country_code: ""
	,region: ""
	,city: ""
	,maps: ""
	,agent: ""
	,browser: ""
	,url: ""
	,title: ""
	,os: ""
	,ref: ""
	,refSearch: ""
	,mid: 0
	,time: 0
	,timeIn: 0
	,numPage: 0
	,find: false
	,last: []
	,tags: []
};
module.exports = function(gData){
	return {
		gData: gData,
		cs: null,
		ws: {},
		wss: null,
		globalTimeout: {},
		isWs: {},
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
					_this.gData.cList[uuid] = 1;
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
										_this.gData.signal.trigger(_this.gData.cList[uuid],'Load');
										delete _this.gData.cList[uuid];
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
										delete _this.gData.cList[uuid];
									}
								});
							}
						});
					}
					request.on('error', function() {
						_this.gData.Emitter.emit('isResponseClient'+_this.gData.cList[uuid]);
					});
					request.on('clientError', function() {
						_this.gData.Emitter.emit('isResponseClient'+_this.gData.cList[uuid]);
					});
					request.on('close', function() {
						_this.gData.Emitter.emit('isResponseClient'+_this.gData.cList[uuid]);
					});

			});
			_this.cs.timeout = 0;
			_this.cs.listen(_this.gData.config.srv.client);
			_this.wss = new WebSocketServer({port: _this.gData.config.srv.websocket});
			_this.wss.on('connection', function(ws) {
				var uuid = _this.getUUID();
				_this.gData.cList[uuid] = 1;
				var info = url.parse(ws.upgradeReq.url,true);
				info.headers = ws.upgradeReq.headers;
				if(info.pathname=='/' || info.pathname=='/favicon.ico'){
					ws.close();
				}else {
					_this.responseWs({session:uuid,ws:ws,path:info});
				}
			ws.on('close', function close() {
				_this.gData.clients[_this.gData.cList[uuid]].connection--;
				_this.gData.timerOut[_this.gData.cList[uuid]] = setTimeout(function(){
					_this.clean(_this.gData.cList[uuid]);
					},_this.gData.config.timeout);
			});
		});

		},
		generateUser: function(info, callback){
			var _this = this;
			_this.genUUID(function(uid){
				_this.gData.cList[info.session] = uid;
				_this.gData.clients[uid] = clientBlank;
				_this.fill(uid,info,0);
				_this.getManager(uid,_this.gData.clients[uid].sid,info,callback);
			});
		},
		genUUID: function (callback){
			var _this = this;
			_this.gData.redis.incr('bh:uUID',function(err,resp){
				callback(resp);
			});
		},
		responseText: {},
		header: {},
		responseTextBlank: '{"request":"Ok"}',
		headerBlank: 200,
		getManager: function(uid,sid,info,callback){
			var _this = this;
			var managers = {};
			if(typeof info.path.query.managers!='undefined'){
				managers = JSON.parse(info.path.query.managers);
			}
			var Call = {};
			Call.uid = uid;
			var mList = [];
			if(typeof _this.gData.sectionManagers[sid]!='undefined')
				mList = _this.gData.sectionManagers[sid];
			var onLine = false;
			if(mList.length > 0)
				onLine = true;
			Call.online = onLine;
			var mid = 0;
			var Manager = {};
			if(onLine && _this.gData.clients[uid].mid!=0){
				for(num in mList){
					if(mList[num]==_this.gData.clients[uid].mid){
						mid = mList[num];
						Manager = _this.gData.managers[mid];
					}
				}
				if(mid==0){
					mid = mList[_this.random(0,mList.length)];
					Manager = _this.gData.managers[mid];
				}
			}
			else if(onLine && _this.gData.clients[uid].mid==0){
				mid = mList[_this.random(0,mList.length)];
				Manager = _this.gData.managers[mid];
			}

			if(mid == 0){
				var w = 'sm.sid = '+sid+' limit 1';
				if(_this.gData.clients[uid].mid!=0)
					w = 'sm.mid = '+_this.gData.clients[uid].mid;
				_this.gData.mysql.getConnection(function(err,connection){
					connection.query("select m.uid id, m.img, m.info, m.jinfo, sm.jinfo sminfo, sm.block_img, m.version version_img, sm.version version_block from bh_section_manager sm inner join bh_manager m on m.uid = sm.mid where "+w,function(err,rows){
						if(typeof rows !='undefined' && typeof rows[0]!='undefined'){
							var jMan = {};
							jMan.id = rows[0].id;
							jMan.img = rows[0].img;
							jMan.version_img = rows[0].version_img;
							jMan.version_block = rows[0].version_block;
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
							jMan.block_img = sminfo[psNum];
							jMan.text = _this.replaceAll("\n","",rows[0].info);
							jMan.text = _this.replaceAll("\r","",jMan.text);
							jMan.text = _this.replaceAll("'","&prime;",jMan.text);
							jMan.text = _this.replaceAll('"',"&quot;",jMan.text);
							if(typeof _this.gData.managers[jMan.id] !='undefined' && _this.gData.managers[jMan.id].img==jMan.version_img)
								delete jMan.img;
							if(typeof _this.gData.managers[jMan.id] !='undefined' && _this.gData.managers[jMan.id].block==jMan.version_block)
								delete jMan.block_img;
							Call.manager = jMan;
							callback(JSON.stringify(Call),200);
						}
						else {
							callback(_this.responseTextBlank,200);
							connection.release();
						}
					});
				});

			}
			else {
				var psNum = "";
				switch(_this.gData.sections[sid].ps){
					case 1:case 2: psNum = "12"; break;
					case 3: psNum = "3"; break;
					case 4:case 5: psNum = "45"; break;
					case 6: psNum = "6"; break;
				}
				var jMan = {};
				jMan.id = Manager.id;
				jMan.img = Manager.img;
				jMan.block_img = Manager.sminfo[psNum];
				jMan.version_img = Manager.version_img;
				jMan.version_block = Manager.version_block;
				if(typeof managers[jMan.id] !='undefined' && managers[jMan.id].img==jMan.version_img)
					delete jMan.img;
				if(typeof managers[jMan.id] !='undefined' && managers[jMan.id].block==jMan.version_block)
					delete jMan.block_img;

				jMan.text = _this.replaceAll("\n","",Manager.info);
				jMan.text = _this.replaceAll("\r","",jMan.text);
				jMan.text = _this.replaceAll("'","&prime;",jMan.text);
				jMan.text = _this.replaceAll('"',"&quot;",jMan.text);
				Call.manager = jMan;
				callback(JSON.stringify(Call),200);
			}
		},
		replaceAll: function(find,replace,str){
			return str.replace(new RegExp(find, 'g'), replace);
		},
		random: function(min,max){
			return Math.floor(Math.random() * (max - min)) + min;
		},
		responseWs: function(info){
			var callback = function(resp,headerCode){
				info.ws.send(resp);
			};
			var _this = this;
			var st = info.path.pathname.split('/');
			var uid = st[2];
			if(uid==0){
				_this.generateUser(info,callback);
				return true;
			}
			clearTimeout(_this.gData.timerOut[uid]);
			_this.ws[uid] = info.ws;
			_this.isWs[uid] = true;
			_this.gData.cList[info.session] = uid;
			if(typeof _this.gData.clients[uid]=='undefined'){
				_this.gData.clients[uid] = clientBlank;
				_this.fill(uid,info,1);
			}

			if(typeof _this.queue[uid] != 'undefined'){
				var pull = [];
				for(qNum in _this.queue[uid]){
					pull.push(_this.queue[uid][qNum]);
					_this.queue[uid].splice(qNum,1);
				}
				_this.ws[uid].send(JSON.stringify({pull:pull}));
			}
			_this.gData.clients[uid].connection++;
			_this.gData.Emitter.on('isResponseClientWs'+uid,function(){
				if(typeof _this.responseText[uid]!='undefined'){
					if(!_this.ws[uid].upgradeReq.connection.destroyed){
						if(typeof _this.queue[uid] != 'undefined'){
							var pull = [];
							for(qNum in _this.queue[uid]){
								pull.push(_this.queue[uid][qNum]);
								_this.queue[uid].splice(qNum,1);
							}
							_this.ws[uid].send(JSON.stringify({pull:pull}));
						}
					}
				}
			});
		},
		queue: {},
		send: function(uid,msg){
			var _this = this;
			if(typeof _this.queue[uid] == 'undefined')
				_this.queue[uid] = [];
			_this.queue[uid].push(msg);
			if(_this.gData.clients[uid].connection > 0) {
				if(_this.isWs[uid]){
					_this.gData.Emitter.emit('isResponseClientWs'+uid);
				}
				else
					_this.gData.Emitter.emit('isResponseClient'+uid);
			}
		},
		response: function(info, callback){
			var _this = this;
			var st = info.path.pathname.split('/');
			var uid = st[2];
			if(typeof st[2]=='undefined'){
				_this.code(st[1],info,callback);
				return true;
			}
			if(uid==0){
				_this.generateUser(info,callback);
				return true;
			}

			_this.gData.cList[info.session] = uid;
			var isFill = false;
			if(typeof _this.gData.clients[uid]=='undefined'){
				_this.gData.clients[uid] = clientBlank;
				_this.fill(uid,info,1);
				isFill = true;
			}
			if( info.path.type=='post' ){
				if(!isFill)
					_this.fill(uid,info,2);
				_this.getManager(uid,_this.gData.clients[uid].sid,info,callback);
				return true;
			}else {
				_this.isWs[uid] = false;
			}
			if(typeof _this.queue[uid] != 'undefined' && _this.queue[uid].length > 0){
				var pull = [];
				for(qNum in _this.queue[uid]){
					pull.push(_this.queue[uid][qNum]);
					_this.queue[uid].splice(qNum,1);
				}
				callback(JSON.stringify({pull:pull}),200);
				return;
			}
			clearTimeout(_this.gData.timerOut[uid]);
			_this.gData.clients[uid].connection++;
			_this.gData.Emitter.once('isResponseClient'+uid,function(){
				_this.gData.clients[uid].connection--;
				clearTimeout(_this.globalTimeout[uid]);
				clearTimeout(_this.gData.timerOut[uid]);

			if(typeof _this.queue[uid] != 'undefined' && _this.queue[uid].length > 0){
				var pull = [];
				for(qNum in _this.queue[uid]){
					pull.push(_this.queue[uid][qNum]);
					_this.queue[uid].splice(qNum,1);
				}
				callback(JSON.stringify({pull:pull}),200);
			}
			else
				callback(_this.responseTextBlank,_this.headerBlank);
				_this.gData.timerOut[uid] = setTimeout(function(){
					_this.clean(uid);
					},_this.gData.config.timeout);
			});
			_this.globalTimeout[uid] = setTimeout(function(){
				_this.gData.Emitter.emit('isResponseClient'+uid);
			},_this.gData.config.lpTimeout);
		},
		getUUID: function(){
			var _this = this;
			var uuid = _this.createUUID();
			if( typeof _this.gData.cList[uuid] != 'undefined')
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
		fill: function(uid,info,firts){
			var _this = this;
			var st = info.path.pathname.split('/');
			var query = info.path.query;
			var sid = parseInt(st[1]);
			if(typeof _this.gData.sectionClients[sid]=='undefined')
				_this.gData.sectionClients[sid] = [];
			if(_this.gData.sectionClients[sid].indexOf(uid) == -1){
				_this.gData.sectionClients[sid].push(uid);
			}
			var client = _this.gData.clients[uid];
			client.uid = uid;
			client.sid = sid;
			console.log("fill",firts);
			if(firts < 2) {
				_this.gData.mysql.getConnection(function(err,connection){
					connection.query( 'select uid, sid, ctime, info from bh_customer where uid = ?',[uid], function(err, rows) {
						connection.release();
						if(typeof rows!='undefined' && typeof rows[0]!='undefined'){
							var inRows = rows[0];
							var inInfo = JSON.parse(inRows['info']);
							if(typeof inInfo.cname!='undefined')
								client.cname = inInfo.cname;
							if(typeof inInfo.name!='undefined')
								client.name = inInfo.name;
							if(typeof inInfo.cphone!='undefined')
								client.cphone = inInfo.cphone;
							if(typeof inInfo.phone!='undefined')
								client.phone = inInfo.phone;
							if(typeof inInfo.cemail!='undefined')
								client.cemail = inInfo.cemail;
							if(typeof inInfo.email!='undefined')
								client.email = inInfo.email;
							if(typeof inInfo.ccomment!='undefined')
								client.ccomment = inInfo.ccomment;
							if(typeof inInfo.mcomment!='undefined')
								client.mcomment = inInfo.mcomment;

							if(typeof inInfo.chats!='undefined')
								client.chats = inInfo.chats;
							if(typeof inInfo.visits!='undefined')
								client.visits += inInfo.visits;
							else
								client.visits = firts+1;
							client.find = true;
						}else {
							client.visits = firts+1;
						}
						_this.gData.signal.userIn(client.uid,client.sid);
					});
				});
			}
			client.ip = info.path.headers.ip;
			client.domain = st[3];
			client.protocol = query.protocol;
			client.locale = query.locale;
			if(typeof info.path.headers.geoip_region != 'undefined')
				client.region = info.path.headers.geoip_region;
			if(typeof info.path.headers.geoip_city != 'undefined')
				client.city = info.path.headers.geoip_city;
			client.maps = info.path.headers.geoip_latitude+','+info.path.headers.geoip_longitude;
			client.country_name = info.path.headers.geoip_country_name;
			client.country_code = info.path.headers.geoip_country_code;
			if( typeof query.triggers!='undefined')
				client.triggers = JSON.parse(query.triggers);


			if(client.region=='' || client.city=='' || info.path.headers.geoip_latitude.substr(-4)=='0000'){
				var location = _this.gData.geo.find(client.ip);
				client.region = location.region.name.en;
				client.city = location.city.name.en;
				client.maps = location.latitude+','+location.longitude;
				client.country_name = location.country.name.en;
				client.country_code = location.country.iso;
			}
			if(typeof query.agent!='undefined'){
				client.agent = query.agent;
				if(typeof query.os!='undefined'){
					client.os = _this.getOs(query.os,query.agent);
				}
				client.browser = _this.getBrowser(query.agent);
			}
			if(typeof query.time!='undefined' && parseInt(query.time) != 0){
				client.time = parseInt(query.time);
			}
			if(client.time==0)
					client.time = _this.gData.time();
			if(typeof query.url!='undefined' && typeof query.title!='undefined'){
				if(client.timeIn==0){
					client.timeIn = _this.gData.time();
				}
				if(client.url!="" && client.url!=query.url){
					client.last.push({
						url: client.url,
						title: client.title,
						timeIn: client.timeIn,
						timeOut: _this.gData.time()
					});
				}
				client.url = query.url;
				client.title = query.title;
				client.timeIn = _this.gData.time();
				client.numPage = client.last.length+1;
			}
			if(typeof query.mid!='undefined'){
				client.mid = parseInt(query.mid);
			}
			if(typeof query.ref!='undefined'){
				client.ref = query.ref;
				var refFrase = "";
				if(client.ref!=''){
					if(client.ref.indexOf('://yandex')){
						var parseInfo = url.parse(client.ref,true);
						if(typeof parseInfo.query.text!='undefined')
							refFrase = "yandex:"+parseInfo.query.text;
					}
					if(client.ref.indexOf('google')){
						var parseInfo = url.parse(client.ref,true);
						if(typeof parseInfo.query.q!='undefined')
							refFrase = "google:"+parseInfo.query.q;
					}
					if(client.ref.indexOf('search.ukr.net')){
						var parseInfo = url.parse(client.ref,true);
						if(typeof parseInfo.query.q!='undefined')
							refFrase = "search.ukr.net:"+parseInfo.query.q;
					}
				}
				client.refSearch = refFrase;
			}
			if(firts == 2) {
				_this.gData.signal.userIn(client.uid,client.sid);
			}

		},
		loadMsg: function(uid,callback){
			var _this = this;
			if(typeof _this.gData.clients[uid] == 'undefined' || !_this.gData.clients[uid].find) {
				if( typeof callback == 'function') callback();
				return;
			}
			if(typeof _this.gData.msg[uid] == 'undefined') {
				_this.gData.msg[uid] = {};
				_this.gData.mysql.getConnection(function(err,connection){
					connection.query( 'select msg from bh_customer where uid = ?',[uid], function(err, rows) {
						connection.release();
						if(typeof rows!='undefined' && typeof rows[0]!='undefined'){
							if(rows[0].msg!=''){
								_this.gData.msg[uid] = JSON.parse(rows[0].msg);
							}
						}
						if( typeof callback == 'function') callback();
					});
				});
				return;
			}
			if( typeof callback == 'function') callback();
			return;
		},
		getBrowser: function(agent){
			if(agent.indexOf('Opera') >= 0) return 'Opera';
			if(agent.indexOf('MSIE') >= 0) return 'MSIE';
			if(agent.indexOf('Chrome') >= 0) return 'Chrome';
			if(agent.indexOf('Firefox') >= 0) return 'Firefox';
			if(agent.indexOf('iPad') >= 0) return 'iPad';
			if(agent.indexOf('iPhone') >= 0) return 'iPhone';
			if(agent.indexOf('iPod') >= 0) return 'iPod';
			if(agent.indexOf('android') >= 0) return 'Android';
			if(agent.indexOf('webOS') >= 0) return 'webOS';
			if(agent.indexOf('Safari') >= 0) return 'Safari';
			if(agent.indexOf('rv:11.0') >= 0) return 'MSIE11';
			return '';
		},
		getOs: function(os,agent){
			switch (os) {
				case 'Win32':
				case 'Win64':
					if(agent.indexOf('Windows NT 5.1') >= 0) return 'Windows XP';
					if(agent.indexOf('Windows NT 6.1') >= 0) return 'Windows 7';
					if(agent.indexOf('Windows NT 6.2') >= 0) return 'Windows 8';
					if(agent.indexOf('Windows NT 6.3') >= 0) return 'Windows 8.1';
					return 'Windows';
					break;
				case 'Linux armv7l':
					if(agent.indexOf('Android') >= 0) return 'Android';
				case 'Linux x86_64':
				case 'Linux i365':
				return 'Linux';
				default:
				return os;
					break;
			}
		},
		clean: function(uid){
			var _this = this;
			var sid = _this.gData.clients[uid].sid;
			if( typeof _this.gData.sectionClients[sid]!='undefined'){
				if(_this.gData.sectionClients[sid].indexOf(uid) >=0 )
					 _this.gData.sectionClients[sid].splice(_this.gData.sectionClients[sid].indexOf(uid),1);
				if(_this.gData.sectionClients[sid].length == 0)
					delete _this.gData.sectionClients[sid];
			}
			if( typeof _this.gData.msg[uid] !='undefined'){
				_this.gData.signal.save(uid,function(){
					delete _this.gData.clients[uid];
					delete _this.gData.canvas[uid];
					delete _this.gData.msg[uid];
				});
			} else {
				delete _this.gData.clients[uid];
				delete _this.gData.canvas[uid];
				delete _this.gData.msg[uid];
			}
			_this.gData.signal.userOut(uid,sid);
		},
		code: function(section,info,callback){
			var _this = this;
			section = section.replace(".js","");
			switch(section){
				case "info":
							if( typeof info.path.query.get=='undefined'){
								callback('{"error":true}',404);
								return true;
							}
							var uid = parseInt(info.path.query.get);
							if(typeof _this.gData.sections[uid]=='undefined'){
								_this.gData.mysql.getConnection(function(err,connection){
									connection.query("SELECT * from bh_section where uid = ?",[uid],function(err,rows){
										if(typeof rows=='undefined' || typeof rows[0]=='undefined')
											callback('{"error":true}',404);
										else {
											_this.gData.sections[uid] = rows[0];
											_this.loadInfo(uid,callback);
										}
										connection.release();
									});
								});
							}else
								_this.loadInfo(uid,callback);
							var bg = "";
							break;
				case "usr":
							_this.generateUser(info,callback);
							break;
				default:
							section = parseInt(section);
							if(typeof _this.gData.sections[section]=='undefined'){
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
											_this.loadStatic(section,callback);
										}
										connection.release();
									});
								});
							}else
								_this.loadStatic(section,callback);
							break;
			}
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
			callback(JSON.stringify(ret),200);

		},
		loadStatic: function(section,callback){
			var _this = this;
			var inText = "var";
			if(typeof _this.gData.sectionManagers[section]!='undefined')
				inText +=" bhelpOnline=true,";
			else
				inText +=" bhelpOnline=false,";
			inText += ' bhelpSrvAddress="https://static.bhelp.com",bhelpInfoAddress="https://gb.bhelp.com",bhelpWsAddress="wss://ws.bhelp.com",bhelpSignalAddress="https://it.bhelp.com", bhelpSrvVersion='+_this.gData.sections[section].version+',bhelpSrvId='+section+',bhelpVer='+_this.gData.config.version+';\n';//+_this.gData.sections[section].version+";\n";
			inText +='(function(){function msieversion() {var ua = window.navigator.userAgent;var msie = ua.indexOf("MSIE ");if (msie > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./)) return parseInt(ua.substring(msie + 5, ua.indexOf(".", msie)));else return false;}function bhelpLoad(url,name){xmlhttp=new XMLHttpRequest(); xmlhttp.onreadystatechange=function(){if (xmlhttp.readyState==4 && xmlhttp.status==200){localStorage.setItem(name,xmlhttp.responseText);localStorage.setItem("bhelp_versioni",bhelpVer); eval(xmlhttp.responseText);}};xmlhttp.open("GET", url); xmlhttp.send();}var mv = msieversion(); if(!mv || mv > 8) {var bl="bhelp_latesti",ba=bhelpSrvAddress+"/mini.js?"+bhelpVer; var bhelpVersion = localStorage.getItem("bhelp_versioni"); if(bhelpVersion==null || bhelpVersion != bhelpVer) bhelpLoad(ba,bl); else eval(localStorage.getItem(bl));}})();';
			callback(inText,200);
		}
	}
}
