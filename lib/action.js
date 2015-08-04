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
								var result = [];
								for(var nm in keys){
									console.log(keys[nm],_this.globalData.redis.get(keys[nm]));
									result[nm] = _this.globalData.redis.get(keys[nm]);
								}

								console.log(result);
							}
						});
						break;
				}
			});
		}
	}
}

module.exports = Action;