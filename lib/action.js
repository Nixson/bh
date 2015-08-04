var Action = function(globalData){
	return {
		globalData: globalData,
		clean: function(info,type){
			
		},
		cmd: function(uid, cid,type){
			var _this = this;
			_this.globalData.redis.get('bh:cmd:'+cid,function(err, reply){
				if(reply==null) return;
				var jp = JSON.parse(reply);
				console.log(jp);
				switch (jp.action){
					case 'list':
						_this.globalData.redis.keys('bh:c:i:'+jp.cid+':*',function(_, keys){
							if(typeof keys!='undefined' && keys.length > 0){
/*								_this.Emitter.once('tmp:'+jp.cid+":"+_this.globalData.cluster.worker.id,function(){
									_this.globalData
								};*/
								var result = [];
								for(var nm in keys){
									_this.rGet(keys,nm,function(resp,nm){
										result[nm] = resp;
										if(nm == keys.length-1){
											var mLst = _this.globalData.manager[uid];
												console.log(uid);
											for(var numLst in mLst){
												mLst[numLst].responseText = '{"list":'+JSON.stringify(result)+'}';
												mLst[numLst].header = 200;
												_this.globalData.Emitter.emit('isResponse'+mLst[numLst].session);
											}
										}
									});
									
								}
							}
						});
						break;
				}
			});
		},
		rGet: function(keys,num,callback){
			var _this = this;
			_this.globalData.redis.get(keys[num],function(err,resp){
				callback(resp,num);
			});
		}
	}
}

module.exports = Action;