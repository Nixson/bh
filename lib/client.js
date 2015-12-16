var 	http 					= require('http'),
		fs 						= require('fs'),
		url						= require('url');

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
			_this.cs.timeout = 0;
			_this.cs.listen(_this.gData.config.srv.client);
		},
		response: function(info, callback){
			var _this = this;
			var st = info.path.pathname.split('/');
			console.log(st,info.path);

			_this.gData.Emitter.once('isResponse'+info.uuid,function(){
				clearTimeout(_this.globalTimeout[info.uuid]);
				/*callback(_this.responseText,_this.header);
				if(_this.uid > 0){
					_this.gData.timerOut[_this.uid] = setTimeout(function(){
					},_this.gData.config.timeout);
				}*/
			});
			_this.globalTimeout[info.uuid] = setTimeout(function(){
				_this.Emitter.emit('isResponse'+info.uuid);
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
		}
	}
}