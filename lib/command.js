var 	http 					= require('http'),
		fs 						= require('fs'),
		qs						= require('querystring'),
		url						= require('url');

module.exports = function(gData){
	return {
		cs: null,
		gData: gData,
		close: function(){
			this.cs.close();
		},
		bind: function(){
			var _this = this;
			_this.cs = http.Server(function(request, response) {
					request.setEncoding("utf8");
					var info = url.parse(request.url,true);
					info.headers = request.headers;
					response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
					response.write('{"request":"Ok"}'+"\n");
					response.end();
					process.nextTick(function(){
						_this.response(info);
					});
			});
			_this.cs.timeout = 0;
			_this.cs.listen(_this.gData.config.srv.command);
		},
		response: function (info){
			var _this = this;
			console.log(info);
		}
	};
};