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
					case 'manager':
							switch(cmd.action){
								case 'reload':
										_this.reloadManager(cmd.uid,"0");
										break;
							}
							break;
					case 'managers':
							switch(cmd.action){
								case 'reload':
										_this.reloadManagers(cmd.uid);
										break;
							}
							break;
				}
			}
		},
		reloadManager: function(mid,sid){
			var subSid = sid;
			var _this = this;
			process.nextTick(function(){
			mid = mid.toString();
			if(typeof _this.gData.managers[mid]!='undefined'){
				if(subSid=="0"){
					var sidA = _this.gData.managers[mid].sid;
					if(typeof sidA=='number' || typeof sidA=='string')
						sidA = [sidA.toString()];
					for(var ss in sidA){
						var sid = sidA[ss];
						_this.gData.manager.fillSection(sid,function(){
							_this.gData.manager.getInfo(sid,mid);
						});
					}
				}
				else{
					_this.gData.manager.fillSection(subSid,function(){
						_this.gData.manager.getInfo(subSid,mid);
					});
				}
			}
			});
		},
		replaceAll: function(find,replace,str){
			return str.replace(new RegExp(find, 'g'), replace);
		},
		reloadManagers: function(sid){
			var _this = this;
			if(typeof sid == 'number')
				sid = sid.toString();
			if(typeof this.gData.sectionManagers[sid]!='undefined'){
				for(var num in this.gData.sectionManagers[sid]){
					_this.reloadManager(this.gData.sectionManagers[sid][num],sid);
				}
			}
		},
		reloadSection: function(uid){
			var _this = this;
			if(typeof uid=='number')
				uid = uid.toString();
			if(typeof this.gData.sections[uid]!='undefined'){
				_this.gData.mysql.getConnection(function(err,connection){
					connection.query("SELECT * from bh_section where uid = ?",[uid],function(err,rows){
						if(typeof rows!='undefined' || typeof rows[0]!='undefined'){
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