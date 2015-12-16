var 	http 					= require('http'),
		fs 						= require('fs'),
		url						= require('url');

var clientBlank = {
	 cuid: ""
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
	,url: ""
	,title: ""
	,os: ""
	,ref: ""
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
					console.log(request.headers);
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
				_this.getManager(_this.gData.clients[uid].cuid,callback);
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
		getManager: function(cuid,callback){},
		response: function(info, callback){
			var _this = this;
			var st = info.path.pathname.split('/');
			var uid = st[1];
			if(uid==0){
				_this.generateUser(info,callback);
				return true;
			}
			_this.gData.cList[info.session] = uid;
			if( typeof info.path.query.url!='undefined'){
				_this.fill(uid,info);
			}
			console.log(st,info.path);

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

		}
	}
}