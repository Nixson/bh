var 	http 					= require('http'),
		fs 						= require('fs'),
		url						= require('url');

var clientBlank = {
	 sid: ""
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
	,last: {}
};
module.exports = function(gData){
	return {
		gData: gData,
		cs: null,
		ws: {},
		wss: null,
		globalTimeout: {},
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
						_this.response({session:uuid,path:info},function(resp,headerCode){
							if(resp.substr(0,1)=='{')
								response.writeHead(headerCode, {"Content-Type": "application/json; charset=utf8"});
							else
								response.writeHead(headerCode, {"Content-Type": "application/javascript; charset=utf8"});
							response.write(resp+"\n");
							response.end();
							delete _this.gData.cList[uuid];
						});
					}
					request.on('error', function() {
						console.log('error');
						_this.gData.Emitter.emit('isResponse'+_this.gData.cList[uuid]);
					});
					request.on('clientError', function() {
						console.log('clientError');
						_this.gData.Emitter.emit('isResponse'+_this.gData.cList[uuid]);
					});
					request.on('close', function() {
						console.log('close');
						_this.gData.Emitter.emit('isResponse'+_this.gData.cList[uuid]);
					});

			});
			_this.cs.timeout = 0;
			_this.cs.listen(_this.gData.config.srv.client);
			var WebSocketServer = require('ws').Server;
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
				_this.gData.Emitter.emit('isResponse'+_this.gData.cList[uuid]);
				_this.gData.timerOut[_this.gData.cList[uuid]] = setTimeout(function(){
					_this.clean(_this.gData.cList[uuid]);
					},_this.gData.config.timeout);
			});
	    	/*var path = ws.upgradeReq.url;

	    	if( path.substr(0,1)=='/') path = path.substr(1);
	    	pathList = path.split('/');
	    	console.log(pathList);
	        ws.on('message', function(message) {
	        console.log('Received from client: %s', message);
	        _this.ws.send('Server received from client: ' + message);
	    });*/
		});

		},
		generateUser: function(info, callback){
			_this.genUUID(function(uid){
				_this.gData.clients[uid] = clientBlank;
				_this.fill(uid,info);
				_this.getManager(uid,_this.gData.clients[uid].sid,callback);
			});
		},
		genUUID: function (callback){
			_this.gData.redis.incr('bh:uUID',function(err,resp){
				callback(resp);
			});
		},
		responseText: {},
		header: {},
		responseTextBlank: '{"request":"Ok"}',
		headerBlank: 200,
		getManager: function(uid,sid,callback){
			var _this = this;
			var mList = [];
			if(typeof _this.gData.sectionManagers[sid]!='undefined')
				mList = _this.gData.sectionManagers[sid];
			var onLine = false;
			if(mList.length > 0)
				onLine = true;
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
				var w = 'm.sid = '+sid+' limit 1';
				if(_this.gData.clients[uid].mid==0)
					w = 'm.uid = '+_this.gData.clients[uid].mid;
				_this.gData.mysql.getConnection(function(err,connection){
					connection.query("select m.id, m.img, m.info from bh_manager m where "+w,function(err,rows){
						if(typeof rows[0]!='undefined'){
							var jMan = {};
							jMan.id = rows[0].id;
							jMan.img = rows[0].img;
							if(jMan.img=="0" || jMan.img=="")
								jMan.img = "101";
							jMan.img = 'https://'+_this.gData.config.url.manager+"/get/manager/"+jMan.img+'.png';
							jMan.text = _this.replaceAll("\n","",rows[0].info);
							jMan.text = _this.replaceAll("\r","",jMan.text);
							jMan.text = _this.replaceAll("'","&prime;",jMan.text);
							jMan.text = _this.replaceAll('"',"&quot;",jMan.text);
							callback(JSON.stringify(jMan),200);
							connection.release();
						}
						else {
							connection.query("select m.id, m.img, m.info from bh_manager m where m.sid = "+sid+" limit 1",function(err,rows){
								if(typeof rows[0]!='undefined'){
									var jMan = {};
									jMan.id = rows[0].id;
									jMan.img = rows[0].img;
									if(jMan.img=="0" || jMan.img=="")
										jMan.img = "101";
									jMan.img = 'https://'+_this.gData.config.url.manager+"/get/manager/"+jMan.img+'.png';
									jMan.text = _this.replaceAll("\n","",rows[0].info);
									jMan.text = _this.replaceAll("\r","",jMan.text);
									jMan.text = _this.replaceAll("'","&prime;",jMan.text);
									jMan.text = _this.replaceAll('"',"&quot;",jMan.text);
									callback(JSON.stringify(jMan),200);
								}else {
									callback(_this.responseTextBlank,200);
								}

								connection.release();
							});
						}
					});
				});

			}
			else {
				var jMan = {};
				jMan.id = Manager.id;
				jMan.img = Manager.img;
				if(jMan.img=="0" || jMan.img=="")
					jMan.img = "101";
				jMan.img = 'https://'+_this.gData.config.url.manager+"/get/manager/"+jMan.img+'.png';
				jMan.text = _this.replaceAll("\n","",Manager.info);
				jMan.text = _this.replaceAll("\r","",jMan.text);
				jMan.text = _this.replaceAll("'","&prime;",jMan.text);
				jMan.text = _this.replaceAll('"',"&quot;",jMan.text);
				callback(JSON.stringify(jMan),200);
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
			_this.gData.cList[info.session] = uid;
			if(typeof _this.gData.clients[uid]=='undefined'){
				_this.gData.clients[uid] = clientBlank;
				_this.fill(uid,info);
			}
			if( typeof info.path.query.url!='undefined'){
				_this.fill(uid,info);
				_this.getManager(uid,_this.gData.clients[uid].sid,callback);
				return true;
			}
			_this.gData.Emitter.on('isResponse'+uid,function(){
				if(typeof _this.responseText[uid]!='undefined')
					_this.ws[uid].send(_this.responseText[uid]);
			});
		},
		response: function(info, callback){
			var _this = this;
			var st = info.path.pathname.split('/');
			var uid = st[2];
			if(typeof st[2]=='undefined'){
				_this.code(st[1],info,callback);
				return true;
			}
			console.log(st,uid);
			if(uid==0){
				_this.generateUser(info,callback);
				return true;
			}
			_this.gData.cList[info.session] = uid;
			if(typeof _this.gData.clients[uid]=='undefined'){
				_this.gData.clients[uid] = clientBlank;
				_this.fill(uid,info);
			}
			if( typeof info.path.query.url!='undefined'){
				_this.fill(uid,info);
				_this.getManager(uid,_this.gData.clients[uid].sid,callback);
				return true;
			}
			_this.gData.Emitter.once('isResponse'+uid,function(){
				clearTimeout(_this.globalTimeout[uid]);
				if(typeof _this.responseText[uid]=='undefined')
					callback(_this.responseTextBlank,_this.headerBlank);
				else
					callback(_this.responseText[uid],_this.header[uid]);
				_this.gData.timerOut[uid] = setTimeout(function(){
					_this.clean(uid);
					},_this.gData.config.timeout);
			});
			_this.globalTimeout[uid] = setTimeout(function(){
				_this.gData.Emitter.emit('isResponse'+uid);
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
		fill: function(uid,info){
			var _this = this;
			var st = info.path.pathname.split('/');
			var query = info.path.query;
			var sid = parseInt(st[1]);
			if(typeof _this.gData.sectionClients[sid]=='undefined')
				_this.gData.sectionClients[sid] = [];
			if(!_this.gData.sectionClients[sid].indexOf(uid)){
				_this.gData.sectionClients[sid].append(uid);
			}
			var client = _this.gData.clients[uid];
			client.sid = sid;
			_this.gData.mysql.getConnection(function(err,connection){
				connection.query( 'select uid, sid, ctime, info from bh_customer where uid = ?',[uid], function(err, rows) {
					if(typeof rows[0]!='undefined'){
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
					}
					connection.release();
				});
			});
			client.ip = info.path.headers.ip;
			client.domain = st[3];
			if(typeof info.path.headers.geoip_region != 'undefined')
				client.region = info.path.headers.geoip_region;
			if(typeof info.path.headers.geoip_city != 'undefined')
				client.city = info.path.headers.geoip_city;
			client.maps = info.path.headers.geoip_latitude+','+info.path.headers.geoip_longitude;
			client.country_name = info.path.headers.country_name;
			client.country_code = info.path.headers.country_code;


			if(client.region=='' || client.city==''){
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
			if(typeof query.time!='undefined'){
				client.time = parseInt(query.time);
			}
			if(client.time==0)
					client.time = _this.gData.time();
			if(typeof query.url!='undefined' && typeof query.title!='undefined'){
				if(client.timeIn==0){
					client.timeIn = _this.gData.time();
				}
				if(client.url!="" && client.url!=query.url){
					client.last.append({
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
		},
		getBrowser: function(agent){
			if(agent.indexOf('Opera')) return 'Opera';
			if(agent.indexOf('MSIE')) return 'MSIE';
			if(agent.indexOf('Chrome')) return 'Chrome';
			if(agent.indexOf('Firefox')) return 'Firefox';
			if(agent.indexOf('iPad')) return 'iPad';
			if(agent.indexOf('iPhone')) return 'iPhone';
			if(agent.indexOf('iPod')) return 'iPod';
			if(agent.indexOf('android')) return 'Android';
			if(agent.indexOf('webOS')) return 'webOS';
			if(agent.indexOf('Safari')) return 'Safari';
			if(agent.indexOf('rv:11.0')) return 'MSIE11';
			return '';
		},
		getOs: function(os,agent){
			switch (os) {
				case 'Win32':
				case 'Win64':
					if(agent.indexOf('Windows NT 5.1')) return 'Windows XP';
					if(agent.indexOf('Windows NT 6.1')) return 'Windows 7';
					if(agent.indexOf('Windows NT 6.2')) return 'Windows 8';
					if(agent.indexOf('Windows NT 6.3')) return 'Windows 8.1';
					return 'Windows';
					break;
				case 'Linux armv7l':
					if(agent.indexOf('Android')) return 'Android';
				case 'Linux x86_64':
				case 'Linux i365':
				return 'Linux';
				default:
				return os;
					break;
			}
		},
		clean: function(uid){

		},
		code: function(section,info,callback){
			var _this = this;
			console.log(section);
			section = parseInt(section);
			if(typeof _this.gData.sections[section]=='undefined'){
				_this.gData.mysql.getConnection(function(err,connection){
					connection.query("SELECT * from bh_section where uid = ?",[section],function(err,rows){
						if(typeof rows[0]=='undefined')
							callback('{"error":true}',404);
						else {
							_this.gData.sections[section] = rows[0];
							_this.loadInfo(section,callback);
						}
					});
				});
			}else
				_this.loadInfo(section,callback);
		},
		loadInfo: function(section,callback){
			var _this = this;
			var inText = 'var bhelpSrvAddress="https://static.bhelp.com",bhelpInfoAddress="https://gb.bhelp.com", bhelpSrvVersion=1,bhelpSrvId='+section+';\n';//+_this.gData.sections[section].version+";\n";
			inText+='(function(){function bhelpLoad(url,name){console.log(url);if (window.XMLHttpRequest) xmlhttp=new XMLHttpRequest(); else xmlhttp=new ActiveXObject("Microsoft.XMLHTTP"); xmlhttp.onreadystatechange=function(){if (xmlhttp.readyState==4 && xmlhttp.status==200){if(window["localStorage"] === null) {localStorage.setItem(name,xmlhttp.responseText);} eval(xmlhttp.responseText);}}; xmlhttp.open("GET", url, true ); xmlhttp.send();}if(window["localStorage"] === null){var bhelpVersion = localStorage.getItem("bhelp_versioni"), bl="bhelp_latesti",ba=bhelpSrvAddress+"/mini.js";\nconsole.log(ba,bhelpSrvAddress); \nif(bhelpVersion==null || bhelpVersion != bhelpSrvVersion) bhelpLoad(ba,bl); else eval(localStorage.getItem(bl));} else bhelpLoad(ba,bl);})();';
			callback(inText,200);
		}
	}
}