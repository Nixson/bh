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
	last: {
		/* url: ""
		,title: ""
		,timeIn: 0
		,timeOut: 0*/
	}
};
module.exports = function(gData){
	return {
		gData: gData,
		cs: null,
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
							response.writeHead(headerCode, {"Content-Type": "application/json; charset=utf8"});
							response.write(resp+"\n");
							response.end();
							delete _this.gData.cList[uuid];
						});
					}
					request.on('error', function() {
						console.log('error');
						Emitter.emit('isResponse'+_this.gData.cList[uuid]);
					});
					request.on('clientError', function() {
						console.log('clientError');
						Emitter.emit('isResponse'+_this.gData.cList[uuid]);
					});
					request.on('close', function() {
						console.log('close');
						Emitter.emit('isResponse'+_this.gData.cList[uuid]);
					});

			});
			_this.cs.timeout = 0;
			_this.cs.listen(_this.gData.config.srv.client);
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

		},
		response: function(info, callback){
			var _this = this;
			var st = info.path.pathname.split('/');
			var uid = st[2];
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
				_this.Emitter.emit('isResponse'+uid);
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
			if(typeof _this.gData.domClients[sid]=='undefined')
				_this.gData.domClients[sid] = [];
			if(!_this.gData.domClients[sid].indexOf(uid)){
				_this.gData.domClients[sid].append(uid);
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
			client.ip = info.headers.ip;
			client.domain = st[3];
			if(typeof info.headers.geoip_region != 'undefined')
				client.region = info.headers.geoip_region;
			if(typeof info.headers.geoip_city != 'undefined')
				client.city = info.headers.geoip_city;
			client.maps = info.headers.geoip_latitude+','+info.headers.geoip_longitude;
			client.country_name = info.headers.country_name;
			client.country_code = info.headers.country_code;


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
		}
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

		}
	}
}