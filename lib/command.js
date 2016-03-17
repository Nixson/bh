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
			if(typeof info.query.cmd!='undefined'){
				var cmd = JSON.parse(info.query.cmd);
				switch(cmd.type){
					case 'section':
							switch(cmd.action){
								case 'reload':
										_this.reloadSection(cmd.uid);
										break;
							}
							break;
				}
			}
		},
		reloadSection: function(uid){
			var _this = this;
			if(typeof this.gData.sections[uid]!='undefined'){
				_this.gData.mysql.getConnection(function(err,connection){
					connection.query("SELECT * from bh_section where uid = ?",[uid],function(err,rows){
						if(typeof rows=='undefined' || typeof rows[0]=='undefined')
							//
						else {
							_this.gData.sections[uid] = rows[0];
							var info = _this.gData.sections[uid].info;
							_this.gData.sections[uid].info = {};
							if(info!="")
								_this.gData.sections[uid].info = JSON.parse(info);
						}
						connection.release();
					});
				});
			}
		},
	};
};