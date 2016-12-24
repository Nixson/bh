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
		reloadManager: function(mid,cid){
			console.log("command.reloadManager",mid,cid);
			var subSid = cid;
			var _this = this;
			process.nextTick(function(){
			mid = mid.toString();
			if(typeof _this.gData.managers[mid]!='undefined'){
				if(subSid=="0"){
					var sidA = _this.gData.managers[mid].sid;
					if(typeof sidA=='number' || typeof sidA=='string')
						sidA = [sidA.toString()];
					console.log("command.reloadManager sidA",sidA);
					for(var ss in sidA){
						var sid = sidA[ss];
						_this.gData.manager.fillAllSections(cid,mid,function(){
							_this.gData.manager.getInfo(sid,cid,mid,null,true);
						});
					}
				}
				else{
					_this.gData.manager.fillAllSections(cid,mid,function(){
						_this.gData.manager.getInfo(subSid,cid,mid,null,true);
					});
				}
			}
			});
		},
		replaceAll: function(find,replace,str){
			console.log("command.replaceAll");
			return str.replace(new RegExp(find, 'g'), replace);
		},
		reloadManagers: function(cid){
			console.log("command.reloadManagers",cid);
			var _this = this;
			if(typeof cid == 'number')
				cid = cid.toString();
			if(typeof this.gData.sectionManagers[cid]!='undefined'){
				for(var num in this.gData.sectionManagers[cid]){
					_this.reloadManager(this.gData.sectionManagers[cid][num],cid);
				}
			}
		},
		reloadSection: function(uid){
			console.log("command.reloadSection",uid);
			var _this = this;
			if(typeof uid=='number')
				uid = uid.toString();
			_this.gData.bot[uid] = {};
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