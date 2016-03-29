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
										_this.reloadManager(cmd.uid);
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
		reloadManager: function(mid){
			console.log("reloadManager",mid);
			//managers
			var _this = this;
			process.nextTick(function(){
				console.log(mid);
			if(typeof _this.gData.managers[mid]!='undefined'){
				var sid = _this.gData.managers[mid].sid;
				_this.gData.manager.fillSection(sid,function(){
				_this.gData.mysql.getConnection(function(err,connection){
					connection.query("select m.uid id, m.img, m.info, m.jinfo, m.jimg, sm.jinfo sminfo, sm.block_img, m.version version_img, sm.version version_block from bh_section_manager sm inner join bh_manager m on m.uid = sm.mid where sm.mid = ?",[mid],function(err,rows){
						connection.release();
						if(typeof rows !='undefined' && typeof rows[0]!='undefined'){
							var manager = {
								sid: 0,
								mList: []
							};
							manager.mList = _this.gData.managers[mid].mList;
							manager.sid = sid;
							manager.id = rows[0].id;
							manager.img = rows[0].img;
							manager.version_img = rows[0].version_img;
							manager.version_block = rows[0].version_block;
							if(manager.img=="0" || manager.img=="")
								manager.img = "101";
							var sminfo = rows[0].sminfo;
							if( sminfo == ""){
								sminfo = {};
							}else
								sminfo = JSON.parse(sminfo);
							var img = {};
							if(rows[0].jimg!='')
								img = JSON.parse(rows[0].jimg);
							manager.img = rows[0].jinfo;
							if(typeof img.normal!='undefined')
								manager.img = img.normal;
							manager.sminfo = sminfo;
							var psNum = "";
							switch(_this.gData.sections[sid].ps){
								case 1:case 2: psNum = "12"; break;
								case 3: psNum = "3"; break;
								case 4:case 5: psNum = "45"; break;
								case 6: psNum = "6"; break;
							}
							manager.block_img = sminfo[psNum];
							manager.text = _this.replaceAll("\n","",rows[0].info);
							manager.text = _this.replaceAll("\r","",manager.text);
							manager.text = _this.replaceAll("'","&prime;",manager.text);
							manager.text = _this.replaceAll('"',"&quot;",manager.text);
							manager.info = manager.text;
							_this.gData.managers[mid] = manager;
						}
					});
				});
				});
			}
			});
		},
		replaceAll: function(find,replace,str){
			return str.replace(new RegExp(find, 'g'), replace);
		},
		reloadManagers: function(sid){
			var _this = this;
			if(typeof this.gData.sectionManagers[sid]!='undefined'){
				for(var num in this.gData.sectionManagers[sid]){
					_this.reloadManager(this.gData.sectionManagers[sid][num]);
				}
			}
		},
		reloadSection: function(uid){
			console.log(reloadSection);
			var _this = this;
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