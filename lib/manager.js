
var Manager = function(sess,path,request,globalData){
	return{
		path: path,
		request: request,
		uid: 0,
		cid: 0,
		globalData: globalData,
		Emitter: globalData.Emitter,
		session:sess,
		responseText: '{"request":"Ok"}',
		header: 200,
		isResponse: 1,
		hostname: "",
		globalTimeout: null,
		stm: null,
		response: function(callback){
			var _this = this;
			//timerOut
			_this.Emitter.once('isResponse'+_this.session,function(){
				clearTimeout(_this.globalTimeout);
				_this.globalData.send({ manager: {type: "exit", uid: _this.uid}});
				callback(_this.responseText,_this.header);
				if(_this.uid > 0){
					_this.globalData.timerOut[_this.uid] = setTimeout(function(){
						_this.globalData.send({ manager: {type: "clear", uid: _this.uid, cid: _this.cid}});
					},_this.globalData.config.timeout);
				}
			});
			_this.globalTimeout = setTimeout(function(){
				_this.Emitter.emit('isResponse'+_this.session);
			},_this.globalData.config.lpTimeout);

			_this.parse();
		},
		parse: function(){
			var _this = this;
			if( _this.path.substr(0,1)=='/') _this.path = _this.path.substr(1);
			if( _this.path.length == 0 || _this.path.trim()==''){
				_this.Emitter.emit('isResponse'+_this.session);
				return;
			}
			var mUUID = _this.path.trim();
			_this.cid = mUUID.substr(1).split('_')[0];
			
			_this.globalData.redis.get("bh:m:h:"+mUUID,function(err, reply){
				if(reply==null){
					_this.Emitter.emit('isResponse'+_this.session);
				}
				else {
					_this.uid = reply;
					clearTimeout(_this.globalData.timerOut[_this.uid]);
					var numMng = 0;
					if( typeof _this.globalData.manager[_this.uid]=='undefined') {
						_this.globalData.manager[_this.uid] = [];
					}else numMng = _this.globalData.manager[_this.uid].length;
					_this.globalData.manager[_this.uid][numMng] = _this;
					_this.globalData.send({ manager: {type: "in", uid: _this.uid}});
				}
			});
		},
	}}
module.exports = Manager;
