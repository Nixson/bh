var Action = function(globalData){
	return {
		globalData: globalData,
		clean: function(info,type){
			
		},
		cmd: function(uid, cid,type){
			var _this = this;
			var reload = false;
			_this.globalData.redis.get('bh:cmd:'+cid,function(err, reply){
				if(reply==null) return;
				var jp = JSON.parse(reply);
				console.log(uid,cid,jp);
				switch (jp.action){
					case 'list':
						_this.globalData.redis.keys('bh:c:u:'+jp.cid+':*',function(_, keys){
							if(typeof keys!='undefined' && keys.length > 0){
								var result = [];
								for(var nm in keys){
									_this.rGet(keys,nm,function(resp,nm){
										result[nm] = resp;
										if(nm == keys.length-1){
											_this.sendManager(uid,JSON.stringify(result),'list',{uid:uid,cid:cid,type:type});
										}
									});
								}
							}
						});
						break;
					case 'msg':
						_this.globalData.redis.llen('bh:c:msg:'+jp.info,function(err,resp){
							var ps = 0;
							if(resp > 5) ps = resp-5;
							_this.globalData.redis.lrange('bh:c:msg:'+jp.info,ps,-1,function(err,resp){
								var result = {};
								for(var nm in resp){
									result[parseInt(nm)+ps] = resp[nm];
								}
								_this.sendManager(uid,JSON.stringify(result),'msg',{uid:uid,cid:cid,type:type});
								_this.sendClient(uid,JSON.stringify(result),'msg',{uid:uid,cid:cid,type:type});
							});
						});
						break;
					default:
						if(type=='manager')
							_this.sendManager(uid,reply,'action',{uid:uid,cid:cid,type:type});
						else
							_this.sendClient(uid,reply,'action',{uid:uid,cid:cid,type:type});
						break;
				}
			});
		},
		rGet: function(keys,num,callback){
			var _this = this;
			_this.globalData.redis.get(keys[num],function(err,resp){
				callback(resp,num);
			});
		},
		sendManager: function(uid,msg,type,call){
			var _this = this;
			if(typeof _this.globalData.manager[uid]!='undefined'){
				var mLst = _this.globalData.manager[uid];
				for(var numLst in mLst){
					mLst[numLst].responseText = '{"'+type+'":'+msg+'}';
					mLst[numLst].header = 200;
					_this.globalData.Emitter.emit('isResponse'+mLst[numLst].session);
				}
				_this.globalData.redis.del("bh:cmd:"+call.cid);
				return true;
			}
			process.send({ manager: {type: "cmd", cid: call.cid, uid: call.uid}});
		},
		sendClient: function(uid,msg,type,call){
			var _this = this;
			if(typeof _this.globalData.client[uid]!='undefined'){
				var mLst = _this.globalData.client[uid];
				for(var numLst in mLst){
					mLst[numLst].responseText = '{"'+type+'":'+msg+'}';
					mLst[numLst].header = 200;
					_this.globalData.Emitter.emit('isResponse'+mLst[numLst].session);
				}
				_this.globalData.redis.del("bh:cmd:"+call.cid);
				return true;
			}
			process.send({ client: {type: "cmd", cid: call.cid, uid: call.uid}});
		}
	}
}

module.exports = Action;