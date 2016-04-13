var 	http 					= require('http'),
		fs 						= require('fs'),
		qs						= require('querystring'),
		url						= require('url');

var blank = {
	 offCntAdviceAll: 0
	,offPerActivAdvice: 0
	,offCntAdviceThisManager: 0
	,offCntAdviceRead:0
	,offCntAdviceClose:0
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
			_this.cs.listen(_this.gData.config.srv.stat);
		},
		response: function(info){
			var _this = this;
			console.log(info);
		},
		get: function(section){
			var _this = this;
		},
		/*
		offline action:
						add
						read
						close
		offline info:
						addMsg:
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
		offline: function(section, manager, action, info){
			var _this = this;
			if(typeof _this.gData.log[section]=='undefined'){
				_this.gData.log[section] = {};
				_this.loadManagerList(section,function(){
					_this.offline(section, manager, action, info);
				});
				return;
			}
			if(typeof _this.gData.log[section][manager]=='undefined'}
				_this.gData.log[section][manager] = {};
			var hTime = _this.gData.hTime;
			switch(action){
				case "add":
							for(var managerUid in _this.gData.log[section]){
								_this.add({'section':section,'muid':managerUid,'attr':"offCntAdviceAll",'hTime':hTime,'value':1});
								if(info.activator)
									_this.add({'section':section,'muid':managerUid,'attr':"offPerActivAdvice",'hTime':hTime,'value':1});
							}
							_this.add({'section':section,'muid':manager,'attr':"offCntAdviceThisManager",'hTime':hTime,'value':1});
							break;
				case "read":
							_this.add({'section':section,'muid':manager,'attr':"offCntAdviceRead",'hTime':hTime,'value':1});
							_this.add({'section':section,'muid':manager,'attr':"offdTimeR.cntd",'hTime':hTime,'value':1});
							_this.add({'section':section,'muid':manager,'attr':"offdTimeR.mind",'hTime':hTime,'value':0});
							_this.add({'section':section,'muid':manager,'attr':"offdTimeR.maxd",'hTime':hTime,'value':0});
							var dtime = _this.gData.time() - info.time;
							if(_this.gData.log[section][manager]['offdTimeR.mind'][hTime]==0)
								_this.gData.log[section][manager]['offdTimeR.mind'][hTime] = dtime;
							else if(_this.gData.log[section][manager]['offdTimeR.mind'][hTime] > dtime)
								_this.gData.log[section][manager]['offdTimeR.mind'][hTime] = dtime;
							if(_this.gData.log[section][manager]['offdTimeR.maxd'][hTime] < dtime)
								_this.gData.log[section][manager]['offdTimeR.maxd'][hTime] = dtime;
							_this.add({'section':section,'muid':manager,'attr':"offdTimeR.sumd",'hTime':hTime,'value':dtime});
							break;
				case "close":
							_this.add({'section':section,'muid':manager,'attr':"offCntAdviceClose",'hTime':hTime,'value':1});
							_this.add({'section':section,'muid':manager,'attr':"offdTimeC.cntd",'hTime':hTime,'value':1});
							_this.add({'section':section,'muid':manager,'attr':"offdTimeC.mind",'hTime':hTime,'value':0});
							_this.add({'section':section,'muid':manager,'attr':"offdTimeC.maxd",'hTime':hTime,'value':0});
							var dtime = _this.gData.time() - info.time;
							if(_this.gData.log[section][manager]['offdTimeC.mind'][hTime]==0)
								_this.gData.log[section][manager]['offdTimeC.mind'][hTime] = dtime;
							else if(_this.gData.log[section][manager]['offdTimeC.mind'][hTime] > dtime)
								_this.gData.log[section][manager]['offdTimeC.mind'][hTime] = dtime;
							if(_this.gData.log[section][manager]['offdTimeC.maxd'][hTime] < dtime)
								_this.gData.log[section][manager]['offdTimeC.maxd'][hTime] = dtime;
							_this.add({'section':section,'muid':manager,'attr':"offdTimeC.sumd",'hTime':hTime,'value':dtime});
							break;
			}
		}
		online:  function(){}
		add: function(info){
			var _this = this;
			if(typeof _this.gData.log[info.section][info.muid]=='undefined')
				_this.gData.log[info.section][info.muid] = {};
			if(typeof _this.gData.log[info.section][info.muid][info.attr]=='undefined')
				_this.gData.log[info.section][info.muid][info.attr] = {};
			if(typeof _this.gData.log[info.section][info.muid][info.attr][info.hTime]=='undefined')
				_this.gData.log[info.section][info.muid][info.attr][info.hTime] = 0;
			if(info.value > 0)
				_this.gData.log[info.section][info.muid][info.attr][info.hTime]+=info.value;
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


onCntAdviceAll			
onCntAdviceNoadvice
onCntAdviceClose
onCntUnClose
onPerActivAdvice
ondTimeReactionMin
ondTimeReactionMax
ondTimeReactionMean




'offCntAdviceReadNoClose 		// не закрыто
'offCntAdviceClose'=>0			закрыто

'ondTime.mind'=>0
'ondTime.maxd'=>0
'ondTime.sumd'=>0
'ondTime.cntd'=>0



*/