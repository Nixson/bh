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

								console.log(_this.globalData.manager[uid]);
							}
							console.log(keys);
						});
						break;
				}
			});
		}
	}
}

module.exports = Action;