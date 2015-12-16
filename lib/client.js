var 	http 					= require('http'),
		fs 						= require('fs'),
		url						= require('url');

module.exports = function(gData){
	return {
		gData: gData,
		cs: null,
		bind: function(){
			var _this = this;
			_this.cs = http.Server(function(request, response) {
					request.setEncoding("utf8");
					var uuid = _this.getUUID();
					_this.gData.cList[uuid] = 1;
					var pathname = url.parse(request.url).pathname;
					if(pathname=='/' || pathname=='/favicon.ico'){
						response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
						response.write("\n");
						response.end();
					}else {
						_this.response({session:uuid,path:pathname},function(resp,headerCode){
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
			_this.cs.listen(config.srv.client);
		},
		response: function(info, callback){
			var _this = this;
			var st = info.path.split('/');
			console.log(st);

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
		}
	}
}