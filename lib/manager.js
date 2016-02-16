var 	http 					= require('http'),
		fs 						= require('fs'),
		qs						= require('querystring'),
		url						= require('url');

require ("console-trace");

var managerBlank = {
	 sid: 0
};
module.exports = function(gData){
	return {
		gData: gData,
		cs: null,
		ws: {},
		wss: null,
		globalTimeout: {},
		isWs: {},
		bind: function(){
			var _this = this;
			_this.cs = http.Server(function(request, response) {
					request.setEncoding("utf8");
					var uuid = _this.getUUID();
					_this.gData.mList[uuid] = 1;
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
									_this.response({session:uuid,path:info},function(resp,headerCode){
										if(resp.substr(0,1)=='{')
											response.writeHead(headerCode, {"Content-Type": "application/json; charset=utf8"});
										else
											response.writeHead(headerCode, {"Content-Type": "application/javascript; charset=utf8"});
										response.write(resp+"\n");
										response.end();
										delete _this.gData.mList[uuid];
									});
								});
							}
							else{
								info.type = "get";
								_this.response({session:uuid,path:info},function(resp,headerCode){
									if(!response.finished){
										if(resp.substr(0,1)=='{')
											response.writeHead(headerCode, {"Content-Type": "application/json; charset=utf8"});
										else
											response.writeHead(headerCode, {"Content-Type": "application/javascript; charset=utf8"});
										response.write(resp+"\n");
										response.end();
										delete _this.gData.mList[uuid];
									}
								});
							}
						});
					}
					request.on('error', function() {
						_this.gData.Emitter.emit('isResponseManager'+_this.gData.mList[uuid]);
					});
					request.on('clientError', function() {
						_this.gData.Emitter.emit('isResponseManager'+_this.gData.mList[uuid]);
					});
					request.on('close', function() {
						_this.gData.Emitter.emit('isResponseManager'+_this.gData.mList[uuid]);
					});

			});
			_this.cs.timeout = 0;
			_this.cs.listen(_this.gData.config.srv.manager);
			var WebSocketServer = require('ws').Server;
			_this.wss = new WebSocketServer({port: _this.gData.config.srv.websocketmanager});
			_this.wss.on('connection', function(ws) {
				var uuid = _this.getUUID();
				_this.gData.mList[uuid] = 1;
				var info = url.parse(ws.upgradeReq.url,true);
				info.headers = ws.upgradeReq.headers;
				if(info.pathname=='/' || info.pathname=='/favicon.ico'){
					ws.close();
				}else {
					_this.responseWs({session:uuid,ws:ws,path:info});
				}
			ws.on('close', function close() {
				_this.gData.managers[_this.gData.mList[uuid]].connection--;
				_this.gData.mtimerOut[_this.gData.mList[uuid]] = setTimeout(function(){
					_this.clean(_this.gData.mList[uuid]);
					},_this.gData.config.timeout);
			});
		});

		},
		responseText: {},
		header: {},
		responseTextBlank: '{"request":"Ok"}',
		headerBlank: 200,
		replaceAll: function(find,replace,str){
			return str.replace(new RegExp(find, 'g'), replace);
		},
		random: function(min,max){
			return Math.floor(Math.random() * (max - min)) + min;
		},
		responseWs: function(info){
			var _this = this;
			var st = info.path.pathname.split('/');
			var uid = st[2];
			if(uid==0){
				info.ws.close();
				return true;
			}
			clearTimeout(_this.gData.mtimerOut[uid]);
			_this.ws[uid] = info.ws;
			_this.isWs[uid] = true;
			_this.gData.mList[info.session] = uid;
			if(typeof _this.gData.managers[uid]=='undefined'){
				_this.gData.managers[uid] = managerBlank;
				_this.fill(uid,info);
			}
			if(typeof _this.queue[uid] != 'undefined'){
				for(qNum in _this.queue[uid]){
					_this.ws[uid].send(_this.queue[uid][qNum]);
					delete _this.queue[uid][qNum];
				}
			}
			_this.gData.managers[uid].connection++;
			_this.gData.Emitter.on('isResponseManagerWs'+uid,function(){
				if(typeof _this.responseText[uid]!='undefined'){
					if(_this.ws[uid].upgradeReq.connection.destroyed){
						if(typeof _this.queue[uid] == 'undefined')
							_this.queue[uid] = [];
						_this.queue[uid].push(_this.responseText[uid]);
						console.log("wait reload");
					}
					else {
						_this.ws[uid].send(_this.responseText[uid]);
					}

				}
			});
		},
		queue: {},
		send: function(uid, msg){
			var _this = this;
			_this.responseText[uid] = JSON.stringify(msg);
			_this.header[uid] = 200;
			console.log("send",_this.responseText[uid]);
			if(_this.gData.managers[uid].connection==0){
				if(typeof _this.queue[uid] == 'undefined')
					_this.queue[uid] = [];
				_this.queue[uid].push(_this.responseText[uid]);
			}
			else {
				if(_this.isWs[uid]){
					_this.gData.Emitter.emit('isResponseManagerWs'+uid);
				}
				else
					_this.gData.Emitter.emit('isResponseManager'+uid);
			}
		},
		response: function(info, callback){
			var _this = this;
			var st = info.path.pathname.split('/');
			var uid = st[2];
			if(typeof st[2]=='undefined' || uid==0){
				callback("{error: 'not uid'}",402);
				return true;
			}

			_this.gData.mList[info.session] = uid;
			if(typeof _this.gData.managers[uid]=='undefined'){
				_this.gData.managers[uid] = managerBlank;
				_this.fill(uid,info);
			}
			if( info.path.type=='post' ){
				return true;
			}else {
				_this.isWs[uid] = false;
			}
			if(typeof _this.queue[uid] != 'undefined'){
				for(qNum in _this.queue[uid]){
					callback(_this.queue[uid][qNum],200);
					delete _this.queue[uid][qNum];
				}
			}
			_this.gData.managers[uid].connection++;
			_this.gData.Emitter.once('isResponseManager'+uid,function(){
				_this.gData.managers[uid].connection--;
				clearTimeout(_this.globalTimeout[uid]);
				clearTimeout(_this.gData.mtimerOut[uid]);
				if(typeof _this.responseText[uid]=='undefined')
					callback(_this.responseTextBlank,_this.headerBlank);
				else
					callback(_this.responseText[uid],_this.header[uid]);
				_this.gData.mtimerOut[uid] = setTimeout(function(){
					_this.clean(uid);
					},_this.gData.config.timeout);
			});
			_this.globalTimeout[uid] = setTimeout(function(){
				_this.gData.Emitter.emit('isResponseManager'+uid);
			},_this.gData.config.lpTimeout);
		},
		getUUID: function(){
			var _this = this;
			var uuid = _this.createUUID();
			if( typeof _this.gData.mList[uuid] != 'undefined')
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
		fillSection: function(sid, callback){
			var _this = this;
			if( typeof _this.gData.sections[sid]=='undefined'){
				var section = sid;
				_this.gData.mysql.getConnection(function(err,connection){
									connection.query("SELECT * from bh_section where uid = ?",[section],function(err,rows){
										if(typeof rows=='undefined' || typeof rows[0]=='undefined')
											callback('{"error":true}',404);
										else {
											_this.gData.sections[section] = rows[0];
											var info = _this.gData.sections[section].info;
											_this.gData.sections[section].info = {};
											if(info!="")
												_this.gData.sections[section].info = JSON.parse(info);
											_this.loadInfo(section);
											callback();
										}
										connection.release();
									});
								});
			}
			else {
				callback();
			}
		},
		fill: function(uid,info){
			var _this = this;
			var st = info.path.pathname.split('/');
			var query = info.path.query;
			var sid = parseInt(st[1]);
			if(typeof _this.gData.sectionManagers[sid]=='undefined')
				_this.gData.sectionManagers[sid] = [];
			if(_this.gData.sectionManagers[sid].indexOf(uid) == -1){
				_this.gData.sectionManagers[sid].push(uid);
			}
			var manager = _this.gData.managers[uid];
			manager.sid = sid;
			console.log(uid,sid,manager);
			_this.fillSection(sid,function(){
				_this.gData.mysql.getConnection(function(err,connection){
					connection.query("select m.uid id, m.img, m.info, m.jinfo, sm.jinfo sminfo, sm.block_img, m.version version_img, sm.version version_block from bh_section_manager sm inner join bh_manager m on m.uid = sm.mid where sm.mid = ?",[uid],function(err,rows){
						if(typeof rows !='undefined' && typeof rows[0]!='undefined'){
							manager.id = rows[0].id;
							manager.img = rows[0].img;
							manager.version_img = rows[0].version_img;
							manager.version_block = rows[0].version_block;
							if(manager.img=="0" || manager.img=="")
								manager.img = "101";
							if(rows[0].jinfo ==""){
								rows[0].jinfo = new Buffer(fs.readFileSync(_this.gData.config.dir.client+'/img/manager/'+manager.img+".png")).toString('base64');
								connection.query("UPDATE bh_manager SET jinfo = '"+rows[0].jinfo+"' where uid = ?",[manager.id],function(err,rel){
									connection.release();
								});
							}
							else
								connection.release();
							var psNum = "";
							switch(_this.gData.sections[sid].ps){
								case 1:case 2: psNum = "12"; break;
								case 3: psNum = "3"; break;
								case 4:case 5: psNum = "45"; break;
								case 6: psNum = "6"; break;
							}
							var sminfo = rows[0].sminfo;
							var insertSM = false;
							if( sminfo == ""){
								sminfo = {};
								insertSM = true;
								sminfo[psNum] = new Buffer(fs.readFileSync(_this.gData.config.dir.client+'/img/block/'+sid+"-"+psNum+"."+rows[0].block_img+".png")).toString('base64');
							}else {
								sminfo = JSON.parse(sminfo);
								if(typeof sminfo[psNum] =="undefined"){
									insertSM = true;
									sminfo[psNum] = new Buffer(fs.readFileSync(_this.gData.config.dir.client+'/img/block/'+sid+"-"+psNum+"."+rows[0].block_img+".png")).toString('base64');
								}
							}
							if(insertSM){
								_this.gData.mysql.getConnection(function(err,connection){
									connection.query("UPDATE bh_section_manager SET jinfo = '"+JSON.stringify(sminfo)+"' where uid = ?",[manager.id],function(err,rel){
										connection.release();
									});
								});
							}
							manager.img = rows[0].jinfo;
							manager.sminfo = sminfo;
							manager.block_img = sminfo[psNum];
							manager.text = _this.replaceAll("\n","",rows[0].info);
							manager.text = _this.replaceAll("\r","",manager.text);
							manager.text = _this.replaceAll("'","&prime;",manager.text);
							manager.text = _this.replaceAll('"',"&quot;",manager.text);
							manager.info = manager.text;
							if(typeof _this.gData.managers[manager.id] !='undefined' && _this.gData.managers[manager.id].img==manager.version_img)
								delete manager.img;
							if(typeof _this.gData.managers[manager.id] !='undefined' && _this.gData.managers[manager.id].block==manager.version_block)
								delete manager.block_img;
						}
						else {
							connection.release();
						}
					});
				});
			});

		},
		clean: function(uid){
			var _this = this;
			var sid = _this.gData.managers[uid].sid;
			if(_this.gData.sectionManagers[sid].indexOf(uid) >=0 )
				 _this.gData.sectionManagers[sid].splice(_this.gData.sectionManagers[sid].indexOf(uid),1);
			if(_this.gData.sectionManagers[sid].length() == 0)
				delete _this.gData.sectionManagers[sid];
			delete _this.gData.managers[uid];
		},
		sendMsg: function(uid,msg){
			console.log("sendMsg",msg);
		},

		loadInfo: function(section,callback){
			var _this = this;
			var infoLocal = _this.gData.sections[section].info;
			if(typeof _this.gData.sections[section].info.bg =='undefined'){
				_this.gData.sections[section].info.bg = new Buffer(fs.readFileSync(_this.gData.config.dir.client+'/img/bg/'+section+'-'+_this.gData.sections[section].imgon+".png")).toString('base64');
				_this.gData.mysql.getConnection(function(err,connection){
									connection.query("UPDATE bh_section SET info = '"+JSON.stringify(_this.gData.sections[section].info)+"' where uid = ?",[section],function(err,result){
										connection.release();
									});
								});
			}
			var psNum = "";
			switch(_this.gData.sections[section].ps){
				case 1:case 2: psNum = "12"; break;
				case 3: psNum = "3"; break;
				case 4:case 5: psNum = "45"; break;
				case 6: psNum = "6"; break;
			}
			if(typeof _this.gData.sections[section].info["off"+psNum] =='undefined'){
				_this.gData.sections[section].info["off"+psNum] = new Buffer(fs.readFileSync(_this.gData.config.dir.client+'/img/block/'+section+'-'+psNum+"."+_this.gData.sections[section].imgoff+".png")).toString('base64');
				_this.gData.mysql.getConnection(function(err,connection){
									connection.query("UPDATE bh_section SET info = '"+JSON.stringify(_this.gData.sections[section].info)+"' where uid = ?",[section],function(err,result){
										connection.release();
									});
								});
			}
			var ret = {};
			ret.bg = _this.gData.sections[section].info.bg;
			ret.off_info = _this.gData.sections[section].def_info;
			ret.off_info = _this.replaceAll("'",'&rsquo;',ret.off_info);
			ret.off_info = _this.replaceAll("\n",'',ret.off_info);
			ret.off_info = _this.replaceAll("\r",'',ret.off_info);
			ret.activinfo = _this.gData.sections[section].activinfo;
			ret.activeoff = _this.gData.sections[section].activeoff;
			ret.active_time_t1 = _this.gData.sections[section].active_time_t1;
			ret.active_time_off = _this.gData.sections[section].active_time_off;
			ret.activ_type = _this.gData.sections[section].activ_type;
			ret.activ_type_off = _this.gData.sections[section].activ_type_off;
			ret.ps = _this.gData.sections[section].ps;
			ret.url = _this.gData.sections[section].url;
			ret.lineImg = _this.gData.sections[section].info["off"+psNum];
			ret.lineStyle = '#cMil_Line {display: none;position: fixed; z-index: 3000000; cursor: pointer;';
			switch(ret.ps){
				case 1: ret.lineStyle +='bottom: 0; right: 10px; width: 264px; height: 43px;'; break;
				case 2: ret.lineStyle +='bottom: 0; left: 10px; width: 264px; height: 43px;';  break;
				case 3: ret.lineStyle +='top: 50%; left: 0; width: 43px; height: 264px; margin-top: -132px; margin-left: 0;'; break;
				case 4: ret.lineStyle +='top: 0; left: 10px; width: 264px; height: 43px;'; break;
				case 5: ret.lineStyle +='top: 0; right: 10px; width: 264px; height: 43px;'; break;
				case 6: ret.lineStyle +='top: 50%; right: 0; width: 43px; height: 264px; margin-top: -132px; margin-left: 0;'; break;
			}
			ret.lineStyle += '}';
			if( typeof callback == 'function')
				callback(JSON.stringify(ret),200);

		}
	}
}


/*




    public function get_var_button($manager,$ps){
	if(is_array($manager)) $RmanagerBg = $manager['block_img'];

*/