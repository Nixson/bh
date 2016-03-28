var 	http 					= require('http'),
		fs 						= require('fs'),
		qs						= require('querystring'),
		url						= require('url');
module.exports = function(gData){
	return {
		gData: gData,
		cs: null,
		close: function(){
			var _this = this;
			_this.cs.close();
		},
		bind: function(){
			var _this = this;
			_this.cs = http.Server(function(request, response) {
					request.setEncoding("utf8");
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
									response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
									response.write("{}\n");
									response.end();

									_this.response(info);
								});
							}
							else{
								info.type = "get";
								response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
								response.write("{}\n");
								response.end();
								_this.response(info);
							}
						});
					}
					request.on('error', function() {});
					request.on('clientError', function() {});
					request.on('close', function() {});

			});
			_this.cs.timeout = 0;
			_this.cs.listen(_this.gData.config.srv.mail);
		},
		response: function(info){
			var _this = this;
		}
	}
};