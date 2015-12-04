module.exports = function(gData){
	return {
		gData: gData,
		IsJsonString: function (str) {
			try {
				JSON.parse(str);
			} catch (e) {
				return false;
			}
			return true;
		},
		response: function(pathname,callback){
			var _this = this;
			var spl = pathname.substr(1).split('/');
			if(spl.length < 3){
				callback(400,'{"error":"Bad Request"}');
				return;
			}
			var cmd = {};
			switch(spl[0]){
				case "client": cmd.type = "client"; break;
				case "manager": cmd.type = "manager"; break;
				default: callback(400,'{"error":"Bad Request"}'); return;
			}
			cmd.uid = parseInt(spl[1]);
			cmd.cid = parseInt(spl[2]);
			if(cmd.uid > 0 && cmd.cid > 0){
				process.nextTick(function() {
					_this.gData.cmd(cmd);
				});
			}
			callback(200,'{"response":"done"}');
		}
	}
}
