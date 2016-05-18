var 	http 					= require('http'),
		fs 						= require('fs'),
		qs						= require('querystring'),
		path					= require('path'),
		url						= require('url');

var blank = {
	 offCntAdviceAll: 0
	,offPerActivAdvice: 0
	,offCntAdviceThisManager: 0
	,offCntAdviceRead:0
	,offCntAdviceClose:0
	,offCntAdviceReadNoClose:0			//не обработки. Только при выводе
	,offCntClose:0
	,offdTimeReactionMinClose:0
	,offdTimeReactionMaxClose:0
	,offdTimeReactionMeanClose:0
	,offdTimeReactionMinRead:0
	,offdTimeReactionMaxRead:0
	,offdTimeReactionMeanRead:0
};
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
					}else if(info.pathname=='/rehour'){
						_this.gData.reHtime();
						_this.cleanData();
						response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
						response.write("\n");
						response.end();
					}
					else
					 {
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
									_this.response(info,function(resp){
										response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
										response.write(resp+"\n");
										response.end();
										//console.log("end :"+resp);
									});
								});
							}
							else{
								info.type = "get";
								_this.response(info,function(resp){
									response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
									response.write(resp+"\n");
									response.end();
									//console.log("end :"+resp);
								});
							}
						});
					}
					request.on('error', function() {});
					request.on('clientError', function() {});
					request.on('close', function() {});

			});
			_this.cs.timeout = 0;
			_this.cs.listen(_this.gData.config.srv.stat);
		},
		response: function(info,callback){
			var _this = this;
			var path = info.path.split("/");
			if(typeof path[1]=='undefined'){
				callback("{}");
				return;
			}
			switch (path[1]){
				case 'set':
							callback("{}");
							if(typeof path[2]=="undefined")
								return;
							switch(path[2]){
								case "user":
											if(typeof path[3]!="undefined" && typeof path[4]!="undefined")
												_this.user(path[3],path[4],info.query);
											break;
								case "manager":
											if(typeof path[3]!="undefined" && typeof path[4]!="undefined" && typeof path[5]!="undefined")
												_this.manager(path[3],path[4],path[5]);
											break;
								case "online":
											if(typeof path[3]!="undefined")
												_this.online(path[3],info.query);
											break;
								case "offline":
											if(typeof path[3]!="undefined")
												_this.offline(path[3],info.query);
											break;
							}

							break;
				case 'get':
							if(typeof path[2]=="undefined"){
								callback("{}");
								return;
							}
							else {
								var section = parseInt(path[2]);
								if(section > 0){
									_this.get(section,callback);
									return;
								}
								callback("{}");
								return;
							}
							break;
				default:
							callback("{}");
			}
		},
		cleanData: function(){
			var self = this;
			var _this = this;
			var timeLast = self.gData.lastH;
			var nowH = self.gData.hTime;
			var sortFunc = function(a,b){
				if(a.data > b.data) return 1;
				if(a.data < b.data) return -1;
				return 0;
			};
			for (var section in self.gData.log.managers) {
				for(var manager in self.gData.log.managers[section]){
					var appIn = 0;
					var appOut = 0;
					var appInNow = 0;
					var appOutNow = 0;
					var appMng = [];
					var appMngNow = [];
					var lastIn = 0;
					var lastOut = 0;
					var lastInNow = 0;
					var lastOutNow = 0;
					for( var num in self.gData.log.managers[section][manager]["in"]){
						if(self.gData.log.managers[section][manager]["in"][num] >= timeLast && self.gData.log.managers[section][manager]["in"][num] <= nowH){
							appMng.push({data:self.gData.log.managers[section][manager]["in"][num],type:"in"})
							appIn++;
							lastInNow = self.gData.log.managers[section][manager]["in"][num];
						}
						else if(self.gData.log.managers[section][manager]["in"][num] < timeLast){
							var s = self.gData.log.managers[section][manager]["in"][num];
							delete self.gData.log.managers[section][manager]["in"][num];
							if(s > lastIn)
								lastIn = s;
						}
						else if(self.gData.log.managers[section][manager]["in"][num] > nowH){
							appMngNow.push({data:self.gData.log.managers[section][manager]["in"][num],type:"in"})
							appInNow++;
						}
					}
					if(lastIn > 0)
						self.gData.log.managers[section][manager]["in"].push(lastIn);
					if(lastInNow == 0 && lastIn > 0)
						lastInNow = lastIn;
					for( var num in self.gData.log.managers[section][manager]["out"]){
						if(self.gData.log.managers[section][manager]["out"][num] >= timeLast && self.gData.log.managers[section][manager]["in"][num] <= nowH){
							//appOut.push(self.gData.log.managers[section][manager]["out"][num]);
							appMng.push({data:self.gData.log.managers[section][manager]["out"][num],type:"out"})
							appOut++;
							lastOutNow = self.gData.log.managers[section][manager]["out"][num];
						}
						else if(self.gData.log.managers[section][manager]["out"][num] < timeLast){
							var s = self.gData.log.managers[section][manager]["out"][num];
							delete self.gData.log.managers[section][manager]["out"][num];
							if(s > lastOut)
								lastOut = s;
						}
						else if(self.gData.log.managers[section][manager]["out"][num] > nowH){
							appMngNow.push({data:self.gData.log.managers[section][manager]["out"][num],type:"out"})
							appOutNow++;
						}
					}
					if(lastOut > 0)
						self.gData.log.managers[section][manager]["out"].push(lastOut);
					if(lastOutNow == 0 && lastOut > 0)
						lastOutNow = lastOut;

					if(appIn == 0 && appOut == 0){
						if(lastOut == 0 && lastIn == 0){
							self.add({'section':section,'muid':manager,'attr':"hour",'hTime':timeLast,'value':0,"rewrite":true});
						}
						else {
							if(lastOut > lastIn){
								self.add({'section':section,'muid':manager,'attr':"hour",'hTime':timeLast,'value':0,"rewrite":true});
							}
							else{
								self.add({'section':section,'muid':manager,'attr':"hour",'hTime':timeLast,'value':3600,"rewrite":true});
							}
						}
					}else {
						var summ = 0;
						var start = timeLast;
						var lt = "";
						appMng.sort(function(a,b){
							return a.data - b.data;
						});
						for( var ob in appMng){
							if(appMng[ob].type=="out"){
								summ += appMng[ob].data - start;
							}
							start = appMng[ob].data;
							lt = appMng[ob].type;
						}
						if(lt=="in"){
							summ += nowH - start;
						}
						self.add({'section':section,'muid':manager,'attr':"hour",'hTime':timeLast,'value':summ,"rewrite":true});
					}

					if(appInNow == 0 && appOutNow == 0){
						if(lastOutNow == 0 && lastInNow == 0){
							self.add({'section':section,'muid':manager,'attr':"hour",'hTime':nowH,'value':0,"rewrite":true});
						}
						else {
							if(lastOutNow > lastInNow){
								self.add({'section':section,'muid':manager,'attr':"hour",'hTime':nowH,'value':0,"rewrite":true});
							}
							else{
								self.add({'section':section,'muid':manager,'attr':"hour",'hTime':nowH,'value': (self.gData.time() - nowH),"rewrite":true});
							}
						}
					}else {
						var summ = 0;
						var start = nowH;
						var lt = "";
						appMngNow.sort(function(a,b){
							return a.data - b.data;
						});
						for( var ob in appMngNow){
							if(appMngNow[ob].type=="out"){
								summ += appMngNow[ob].data - start;
							}
							start = appMngNow[ob].data;
							lt = appMngNow[ob].type;
						}
						if(lt=="in"){
							summ += self.gData.time() - start;
						}
						self.add({'section':section,'muid':manager,'attr':"hour",'hTime':nowH,'value':summ,"rewrite":true});
						//self.gData.log.managers[section][manager]["hour"][nowH] = summ;
					}

				}
				//_this.add({'section':section,'muid':manager,'attr':"offdTimeC.maxd",'hTime':hTime,'value':0});
			}
		},
		get: function(section,callback){
			var _this = this;
			var self = this;
			section = section.toString();
			if(typeof _this.gData.log[section]=="undefined"){
				callback("{}");
			}
			else{
				if(self.gData.log.managers[section]!='undefined'){
					var timeLast = self.gData.lastH;
					var nowH = self.gData.hTime;
					var sortFunc = function(a,b){
						if(a.data > b.data) return 1;
						if(a.data < b.data) return -1;
						return 0;
					};
					for(var manager in self.gData.log.managers[section]){
						var appIn = 0;
						var appOut = 0;
						var appInNow = 0;
						var appOutNow = 0;
						var appMng = [];
						var appMngNow = [];
						var lastIn = 0;
						var lastOut = 0;
						var lastInNow = 0;
						var lastOutNow = 0;
						for( var num in self.gData.log.managers[section][manager]["in"]){
							if(self.gData.log.managers[section][manager]["in"][num] >= timeLast && self.gData.log.managers[section][manager]["in"][num] <= nowH){
								appIn++;
								lastInNow = self.gData.log.managers[section][manager]["in"][num];
							}
							else if(self.gData.log.managers[section][manager]["in"][num] < timeLast){
								var s = self.gData.log.managers[section][manager]["in"][num];
								if(s > lastIn)
									lastIn = s;
							}
							else if(self.gData.log.managers[section][manager]["in"][num] > nowH){
								appMngNow.push({data:self.gData.log.managers[section][manager]["in"][num],type:"in"})
								appInNow++;
							}
						}
						if(lastInNow == 0 && lastIn > 0)
							lastInNow = lastIn;
						for( var num in self.gData.log.managers[section][manager]["out"]){
							if(self.gData.log.managers[section][manager]["out"][num] >= timeLast && self.gData.log.managers[section][manager]["in"][num] <= nowH){
								appOut++;
								lastOutNow = self.gData.log.managers[section][manager]["out"][num];
							}
							else if(self.gData.log.managers[section][manager]["out"][num] < timeLast){
								var s = self.gData.log.managers[section][manager]["out"][num];
								if(s > lastOut)
									lastOut = s;
							}
							else if(self.gData.log.managers[section][manager]["out"][num] > nowH){
								appMngNow.push({data:self.gData.log.managers[section][manager]["out"][num],type:"out"})
								appOutNow++;
							}
						}
						if(lastOutNow == 0 && lastOut > 0)
							lastOutNow = lastOut;

						if(appInNow == 0 && appOutNow == 0){
							if(lastOutNow == 0 && lastInNow == 0){
								self.add({'section':section,'muid':manager,'attr':"hour",'hTime':nowH,'value':0,"rewrite":true});
							}
							else {
								if(lastOutNow > lastInNow){
									self.add({'section':section,'muid':manager,'attr':"hour",'hTime':nowH,'value':0,"rewrite":true});
								}
								else{
									self.add({'section':section,'muid':manager,'attr':"hour",'hTime':nowH,'value': (self.gData.time() - nowH),"rewrite":true});
								}
							}
						}else {
							var summ = 0;
							var start = nowH;
							var lt = "";
							appMngNow.sort(function(a,b){
								return a.data - b.data;
							});
							for( var ob in appMngNow){
								if(appMngNow[ob].type=="out"){
									summ += appMngNow[ob].data - start;
								}
								start = appMngNow[ob].data;
								lt = appMngNow[ob].type;
							}
							if(lt=="in"){
								summ += self.gData.time() - start;
							}
							self.add({'section':section,'muid':manager,'attr':"hour",'hTime':nowH,'value':summ,"rewrite":true});
						}
					}
				}
				callback(JSON.stringify(_this.gData.log[section]));
			}
		},
		cmanager: function(section,manager){
			if(typeof this.gData.log.managers =='undefined')
				this.gData.log.managers = {};
			if(typeof this.gData.log.managers[section]=='undefined')
				this.gData.log.managers[section] = {};
			if(typeof this.gData.log.managers[section][manager]=='undefined')
				this.gData.log.managers[section][manager] = {"in":[],"out":[]};
		},
		manager: function(sc,section,manager){
			this.cmanager(section,manager);
			switch(sc){
				case "in":
							this.gData.log.managers[section][manager]["in"].push(this.gData.time());
				case "out":
							this.gData.log.managers[section][manager]["out"].push(this.gData.time());
			}
		},
		user: function(sc,section,query){
			var self = this;
			var hTime = self.gData.hTime;
			self.csection(section, hTime);
			switch(sc){
				case "add":
							var info = JSON.parse(query.info);
							self.gData.log.sections[section][hTime].visitor++;
							if(info.online==1)
								self.gData.log.sections[section][hTime].online++;
							break;
				case "uniq":
							self.gData.log.sections[section][hTime].uniq++;
							break;
				case "info":
							var info = JSON.parse(query.info);
							var hour = self.gData.toHour(info.data);
							self.csection(section, hour);
							self.gData.log.sections[section][hour].pages+=info.pages;
							self.gData.log.sections[section][hour].dtime+=info.dtime;
							break;
			}
//			console.log(self.gData.log.sections);
		},
		csection: function(section, hTime){
			var self = this;
			if( typeof self.gData.log.sections == 'undefined')
				self.gData.log.sections = {};
			if( typeof self.gData.log.sections[section]=='undefined'){
				self.gData.log.sections[section] = {};
			}
			if( typeof self.gData.log.sections[section][hTime]=='undefined'){
				self.gData.log.sections[section][hTime] = {
					visitor: 0,
					uniq: 0,
					pages:0,
					dtime:0,
					online:0
				};
			}
		},
		loadManagerList: function(section,callback){
			callback();
		},
		/*
		offline action:
						add
						read
						close
		offline info:
						add:
								{
									activator (true|false)
								}
						read:
								{
									time (addDate)
								}
						close:
								{
									time (addDate)
								}
		*/
		offline: function(section, info){//manager, action, 
			var _this = this;
			if(typeof _this.gData.log[section]=='undefined'){
				_this.gData.log[section] = {};
				_this.loadManagerList(section,function(){
					_this.offline(section, info);
				});
				return;
			}
			if(typeof _this.gData.log[section][info.manager]=='undefined')
				_this.gData.log[section][info.manager] = {};
			var hTime = _this.gData.hTime;
			switch(info.action){
				case "add":
							for(var managerUid in _this.gData.log[section]){
								_this.add({'section':section,'muid':managerUid,'attr':"offCntAdviceAll",'hTime':hTime,'value':1});
								if(info.activator)
									_this.add({'section':section,'muid':managerUid,'attr':"offPerActivAdvice",'hTime':hTime,'value':1});
							}
							_this.add({'section':section,'muid':info.manager,'attr':"offCntAdviceThisManager",'hTime':hTime,'value':1});
							if(info.activator)
								_this.add({'section':section,'muid':info.manager,'attr':"offPerActivAdviceThisManager",'hTime':hTime,'value':1});
							break;
				case "read":
							_this.add({'section':section,'muid':info.manager,'attr':"offCntAdviceRead",'hTime':hTime,'value':1});
							_this.add({'section':section,'muid':info.manager,'attr':"offdTimeR.cntd",'hTime':hTime,'value':1});
							_this.add({'section':section,'muid':info.manager,'attr':"offdTimeR.mind",'hTime':hTime,'value':0});
							_this.add({'section':section,'muid':info.manager,'attr':"offdTimeR.maxd",'hTime':hTime,'value':0});
							var dtime = _this.gData.time() - info.time;
							if(_this.gData.log[section][info.manager]['offdTimeR.mind'][hTime]==0)
								_this.gData.log[section][info.manager]['offdTimeR.mind'][hTime] = dtime;
							else if(_this.gData.log[section][info.manager]['offdTimeR.mind'][hTime] > dtime)
								_this.gData.log[section][info.manager]['offdTimeR.mind'][hTime] = dtime;
							if(_this.gData.log[section][info.manager]['offdTimeR.maxd'][hTime] < dtime)
								_this.gData.log[section][info.manager]['offdTimeR.maxd'][hTime] = dtime;
							_this.add({'section':section,'muid':info.manager,'attr':"offdTimeR.sumd",'hTime':hTime,'value':dtime});
							break;
				case "close":
							_this.add({'section':section,'muid':info.manager,'attr':"offCntAdviceClose",'hTime':hTime,'value':1});
							_this.add({'section':section,'muid':info.manager,'attr':"offdTimeC.cntd",'hTime':hTime,'value':1});
							_this.add({'section':section,'muid':info.manager,'attr':"offdTimeC.mind",'hTime':hTime,'value':0});
							_this.add({'section':section,'muid':info.manager,'attr':"offdTimeC.maxd",'hTime':hTime,'value':0});
							var dtime = _this.gData.time() - info.time;
							if(_this.gData.log[section][info.manager]['offdTimeC.mind'][hTime]==0)
								_this.gData.log[section][info.manager]['offdTimeC.mind'][hTime] = dtime;
							else if(_this.gData.log[section][info.manager]['offdTimeC.mind'][hTime] > dtime)
								_this.gData.log[section][info.manager]['offdTimeC.mind'][hTime] = dtime;
							if(_this.gData.log[section][info.manager]['offdTimeC.maxd'][hTime] < dtime)
								_this.gData.log[section][info.manager]['offdTimeC.maxd'][hTime] = dtime;
							_this.add({'section':section,'muid':info.manager,'attr':"offdTimeC.sumd",'hTime':hTime,'value':dtime});
							break;
			}
		},
		/*
		online action:
						add
						read
						close
		online info:
						add:
								{
									activator (true|false)
								}
						reaction:
								{
									time (addDate)
								}
		*/
		msg: {},
		updateMsg: function(msg){
			var _this = this;
			if(typeof _this.msg[msg.uid]=='undefined'){
				_this.msg[msg.uid] = msg;
			}
		},
		online:  function(section,info){/*manager,action,*/
			var _this = this;
			if(typeof _this.gData.log[section]=='undefined'){
				_this.gData.log[section] = {};
				_this.loadManagerList(section,function(){
					_this.online(section, info);
				});
				return;
			}
			if(typeof _this.gData.log[section][info.manager]=='undefined')
				_this.gData.log[section][info.manager] = {};
			var hTime = _this.gData.hTime;
			for(var managerUid in _this.gData.log[section]){
				_this.add({'section':section,'muid':managerUid,'attr':"onCntAdviceAll",'hTime':hTime,'value':1});
				_this.add({'section':section,'muid':managerUid,'attr':"onCntUnClose",'hTime':hTime,'value':0});
				_this.add({'section':section,'muid':managerUid,'attr':"onCntAdviceClose",'hTime':hTime,'value':1});
				if(info.activator)
					_this.add({'section':section,'muid':managerUid,'attr':"onPerActivAdvice",'hTime':hTime,'value':1});
				if(!info.reaction)
					_this.add({'section':section,'muid':managerUid,'attr':"onCntAdviceNoadvice",'hTime':hTime,'value':1});
			}
			_this.add({'section':section,'muid':info.manager,'attr':"onCntAdviceThisManager",'hTime':hTime,'value':1});
			if(info.activator)
				_this.add({'section':section,'muid':info.manager,'attr':"onPerActivAdviceThisManager",'hTime':hTime,'value':1});
			_this.add({'section':section,'muid':info.manager,'attr':"ondTime.cntd",'hTime':hTime,'value':1});
			_this.add({'section':section,'muid':info.manager,'attr':"ondTime.mind",'hTime':hTime,'value':0});
			_this.add({'section':section,'muid':info.manager,'attr':"ondTime.maxd",'hTime':hTime,'value':0});
			if(info.reaction){
				if(_this.gData.log[section][info.manager]['ondTime.mind'][hTime]==0)
					_this.gData.log[section][info.manager]['ondTime.mind'][hTime] = info.sReaction;
				else if(_this.gData.log[section][info.manager]['ondTime.mind'][hTime] > dtime)
					_this.gData.log[section][info.manager]['ondTime.mind'][hTime] = info.sReaction;
				if(_this.gData.log[section][info.manager]['ondTime.maxd'][hTime] < dtime)
					_this.gData.log[section][info.manager]['ondTime.maxd'][hTime] = info.sReaction;
				_this.add({'section':section,'muid':info.manager,'attr':"ondTime.sumd",'hTime':hTime,'value':info.sReaction});
			}
			/*
req.write("info="+JSON.stringify({
								"activator": client.active,
								"manager": manager,
								"reaction": reaction, true или false
								"time": sReaction
							}));
			*/


/*
onCntAdviceAll				//всего консультаций			
onPerActivAdvice			//кол-во от активатора
onCntAdviceNoadvice			//без ответа
onCntAdviceClose			//закрытые
onCntUnClose				//не закрытые
ondTimeReactionMin			//реакция
ondTimeReactionMax
ondTimeReactionMean




'ondTime.mind'=>0
'ondTime.maxd'=>0
'ondTime.sumd'=>0
'ondTime.cntd'=>0



*/
		},
		add: function(info){
			var _this = this;
			if(typeof _this.gData.log[info.section]=='undefined')
				_this.gData.log[info.section] = {};
			if(typeof _this.gData.log[info.section][info.muid]=='undefined')
				_this.gData.log[info.section][info.muid] = {};
			if(typeof _this.gData.log[info.section][info.muid][info.attr]=='undefined')
				_this.gData.log[info.section][info.muid][info.attr] = {};
			if(typeof _this.gData.log[info.section][info.muid][info.attr][info.hTime]=='undefined')
				_this.gData.log[info.section][info.muid][info.attr][info.hTime] = 0;
			if(typeof info.rewrite!='undefined'){
				_this.gData.log[info.section][info.muid][info.attr][info.hTime] = info.value;
			}
			else{
				if(info.value > 0)
					_this.gData.log[info.section][info.muid][info.attr][info.hTime]+=info.value;
			}
		},
		load: function(){
			self = this;
			var savePath = path.normalize(__dirname+"/../history");
			fs.readFile(savePath+"/stat.save",(err,data)=>{
				if(err || data=="")
					console.log("No data");
				else
					self.gData.log = JSON.parse(data);
			});
		},
		save: function(){
			var savePath = path.normalize(__dirname+"/../history");
			//console.log(savePath);
			fs.writeFile(savePath+"/stat.save",JSON.stringify(this.gData.log),(err)=>{ if(err) console.log("Error save"); });
		}
	}
};

/*
offCntAdviceAll					//всего оффлайн
offCntAdviceThisManager		//всего оффлайн у менеджера
offPerActivAdvice			от активатора
'offdTimeR.mind'=>0			read min время
'offdTimeR.maxd'=>0			read max время
'offdTimeR.sumd'=>0			read сумма время
'offdTimeR.cntd'=>0			read кол-во
'offCntAdviceRead 				//прочитано

'offdTimeC.mind'=>0			close min время
'offdTimeC.maxd'=>0			close max время
'offdTimeC.sumd'=>0			close сумма время
'offdTimeC.cntd'=>0			close кол-во

offCntClose 					offdTimeC.cntd
,'offdTimeReactionMinClose'=>0	'offdTimeC.mind
'offdTimeReactionMaxClose'=>0	'offdTimeC.maxd'
'offdTimeReactionMeanClose'=>0	среднее время до закрытия
'offdTimeReactionMinRead'=>0	'offdTimeR.mind'
'offdTimeReactionMaxRead'=>0	'offdTimeR.maxd'
'offdTimeReactionMeanRead'=>0 	среднее время отклика 

'offCntAdviceReadNoClose 		// не закрыто
'offCntAdviceClose'=>0			закрыто


onCntAdviceAll			
onCntAdviceNoadvice
onCntAdviceClose
onCntUnClose
onPerActivAdvice
ondTimeReactionMin
ondTimeReactionMax
ondTimeReactionMean




'ondTime.mind'=>0
'ondTime.maxd'=>0
'ondTime.sumd'=>0
'ondTime.cntd'=>0



*/