
var Client = function(sess,path,request,globalData){
	return{
		path: path,
		request: request,
		uid: 0,
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
				process.send({ client: {type: "exit", cluster: _this.globalData.cluster.worker.id, uid: _this.uid}});
				callback(_this.responseText,_this.header);
				if(_this.uid > 0){
					_this.globalData.timerOut[_this.uid] = setTimeout(function(){
						process.send({ client: {type: "clear", cluster: _this.globalData.cluster.worker.id, uid: _this.uid}});
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
			var clientUUID = _this.path.trim();
			
			_this.globalData.redis.get("bh:c:h:"+clientUUID,function(err, reply){
				if(reply==null){
					_this.Emitter.emit('isResponse'+_this.session);
				}
				else {
					_this.uid = reply;
					clearTimeout(_this.globalData.timerOut[_this.uid]);
					process.send({ client: {type: "in", cluster: _this.globalData.cluster.worker.id, uid: _this.uid}});
				}
			});
		},
	}}
module.exports = Client;
