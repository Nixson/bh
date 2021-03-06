var https	= require('https');
var spawn 	= require('child_process').spawn;
var Action = function(globalData){
	return {
		globalData: globalData,
		clear: function(uid,cid,type){
			var _this = this;
			if(type=='manager'){
				_this.globalData.redis.get('bh:m:i:'+cid+':'+uid,function(err,resp){
					if(resp!=''){
						var info = JSON.parse(resp);
						var chash = info.chash;
						_this.globalData.redis.del('bh:m:i:'+cid+':'+uid);
						_this.globalData.redis.del('bh:m:h:'+chash);
						_this.globalData.redis.keys('bh:m:i:'+cid+':*',function(_, keys){
							if(typeof keys!='undefined' && keys.length == 0){
								var spi = spawn('/usr/bin/php', ['/opt/usr/bh/html/cron/reconfigure.php',cid]);
								/*var options = {
									"host":_this.globalData.config.url.manager,
									"path":"/?reconfigureCid="+cid,
									"port": 443,
									"localAddress": "89.108.72.250",
									"method": 'GET',
									"agent": false
								};
								https.get(options).on('error', function(e) {console.error(e);});*/
							}
						});
					}
				});
			}
			if(type=='client'){
				_this.globalData.redis.get('bh:c:i:'+cid+':'+uid,function(err,resp){
					if(resp!='' && resp!=null){
						console.log("exit client",uid,cid);
						var info = JSON.parse(resp);
						var chash = info.chash;
						var msgLen = _this.globalData.redis.llen('bh:c:msg:'+uid);
						if(msgLen > 0 || info.visits > 1){
							_this.saveInfoAndMsg(cid,uid,info);
						}else {
							_this.globalData.redis.del('bh:c:msg:'+uid);
							_this.globalData.redis.del('bh:c:i:'+cid+':'+uid);
							_this.globalData.redis.del('bh:c:u:'+cid+':'+uid);
						}
						_this.globalData.redis.del('bh:c:h:'+chash);
						_this.allManagersSendOut(cid,uid);

						//$this->redis->set('bh:cmd:'.$cmdUID,'{"action":"clientInfo","cid":'.$this->domain['cid'].',"info":'.json_encode($user,JSON_UNESCAPED_UNICODE).'}',['nx', 'ex'=>60]);

					}
				});
			}
		},
		allManagersSendOut: function(cid,uid){
			var _this = this;
			_this.globalData.redis.keys("bh:m:i:"+cid+':*',function(_, keys){
				if(typeof keys!='undefined' && keys.length  > 0){
					for(var i in keys){
						_this.managerSendOut(keys[i],cid,uid);
					}
				}
			});
		},
		managerSendOut: function(mkey,cid,uid){
			var _this = this;
			_this.cmdUID(function(cmuid){
				_this.globalData.redis.set("bh:cmd:"+cmuid,'{"action":"clientOut","cid":'+cid+',"info":{"uid":'+uid+'}}');
				_this.globalData.redis.expire("bh:cmd:"+cmuid,60);
				_this.globalData.redis.get(mkey,function(_,resp){
					var info = JSON.parse(resp);
					_this.globalData.send({ manager: {type: "cmd", cid: cmuid, uid: info.uid}});
				});
			});
		},
		managerSendInfo: function(mkey,cid,info,action){
			var _this = this;
			_this.cmdUID(function(cmuid){
				_this.globalData.redis.set("bh:cmd:"+cmuid,'{"action":"'+action+'","cid":'+cid+',"info":'+info+'}');
				_this.globalData.redis.expire("bh:cmd:"+cmuid,60);
				_this.globalData.redis.get(mkey,function(_,resp){
					var info = JSON.parse(resp);
					_this.globalData.send({ manager: {type: "cmd", cid: cmuid, uid: info.uid}});
				});
			});
		},
		cmdUID: function(callback){
			var _this = this;
			_this.globalData.redis.incr("bh:cmdUID",function(err,resp){callback(resp);});
		},

		saveInfo: function(cid,uid,info,msg,hinfo){
			var _this = this;
			_this.globalData.mysql.getConnection(function(_, connection) {
				connection.query('SELECT 1 from bh_customer where uid = ?', [uid],function(_, rows) {
					var post  = {sid: info.sid, info: JSON.stringify(info.info), msg: msg, hinfo: hinfo};
					if( typeof rows == 'undefined' || rows.length == 0){
						post.ctime = parseInt((new Date).getTime()/1000);
						post.uid = uid;
						connection.query("INSERT INTO bh_customer SET ?",post,function(err,rw){
							connection.release();
						});
					}else {
						connection.query("UPDATE bh_customer SET ? WHERE uid = "+uid, post ,function(_,_){
							connection.release();
						});
					}
					_this.globalData.redis.del('bh:c:i:'+cid+':'+uid);
					_this.globalData.redis.del('bh:c:u:'+cid+':'+uid);
					_this.globalData.redis.del('bh:c:msg:'+uid);
				});
			});

		},
		loadHistory: function(cid,uid,info,msg){
			var _this = this;
			_this.globalData.redis.get('bh:c:u:'+cid+':'+uid,function(_, hinfo){
				_this.saveInfo(cid,uid,info,msg,hinfo);
			});
		},
		userIn: function(uid,type){
			var _this = this;
			_this.globalData.redis.keys('bh:c:u:*:'+uid,function(_, keys){
				if(typeof keys!='undefined' && keys.length > 0){
					var result = [];
					for(var nm in keys){
						_this.rGet(keys,nm,function(resp,nm){
							var info = JSON.parse(resp);
							var cid = info.cid;
							_this.globalData.redis.keys("bh:m:i:"+cid+':*',function(_, keysManager){
								if(typeof keysManager!='undefined' && keysManager.length  > 0){
									for(var i in keysManager){
										_this.managerSendInfo(keysManager[i],cid,resp,"userIn");
									}
								}
							});
						});
					}
				}
			});
		},

		saveInfoAndMsg: function(cid,uid,info){
			var _this = this;
				_this.globalData.redis.llen('bh:c:msg:'+uid,function(_,resp){
					if(resp > 0){
						_this.globalData.redis.lrange('bh:c:msg:'+uid,0,resp,function(err,respRange){
							var result = {};
							for(var nm in respRange){
								result[parseInt(nm)] = respRange[nm];
							}
							_this.saveInfo(cid,uid,info,JSON.stringify(result));
						});
					}
					else {
						_this.saveInfo(cid,uid,info,"");
					}
				});
		},
		saveMsg: function(uid){
			var _this = this;
			_this.globalData.redis.del('bh:c:msg:'+uid);
		},
		isActive: function(rList,callback){
			var _this = this;
			var respInfo = [];
			for(var nm in rList){
				var jsonR = JSON.parse(rList[nm]);
				var gName = "bh:c:i:"+jsonR.cid+":"+jsonR.uid;
				console.log(gName);
				_this.rGetName(gName,nm,function(resp,num){
					console.log(resp);
					if(resp!='') respInfo[respInfo.length] = resp;
					if(num == rList.length-1){
						callback(respInfo);
					}
				});
			}
		},
		cmd: function(uid, cid,type){
			var _this = this;
			var reload = false;
			_this.globalData.redis.get('bh:cmd:'+cid,function(err, reply){
				if(reply==null) return;
				var jp = JSON.parse(reply);
				switch (jp.action){
					case 'list':
						_this.globalData.redis.keys('bh:c:u:'+jp.cid+':*',function(_, keys){
							if(typeof keys!='undefined' && keys.length > 0){
								var result = [];
								for(var nm in keys){
									_this.rGet(keys,nm,function(resp,nm){
										result[nm] = resp;
										if(nm == keys.length-1){
											_this.isActive(result,function(list){
												_this.sendManager(uid,JSON.stringify(result),'list',{uid:uid,cid:cid,type:type});
											});
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
		rGetName: function(name,num,callback){
			var _this = this;
			_this.globalData.redis.get(name,function(err,resp){
				callback(resp,num);
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
			_this.globalData.send({ manager: {type: "cmd", cid: call.cid, uid: call.uid}});
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
			_this.globalData.send({ client: {type: "cmd", cid: call.cid, uid: call.uid}});
		}
	}
}

module.exports = Action;