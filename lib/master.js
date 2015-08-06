module.exports = function(gData,cluster){
	return {
		cluster: cluster,
		gData: gData,
		handler: function(msg,id){
			var _this = this;
			if(typeof msg.client != 'undefined'){
				switch(msg.client.type){
					case "in":
						if(typeof gData.clients[msg.client.uid] == 'undefined') gData.clients[msg.client.uid] = {};
						if(typeof gData.clients[msg.client.uid][msg.client.cluster] == 'undefined') gData.clients[msg.client.uid][msg.client.cluster] = 0;
						gData.clients[msg.client.uid][msg.client.cluster]++;
						break;
					case "exit":
						if(typeof gData.clients[msg.client.uid] !='undefined' && typeof gData.clients[msg.client.uid][msg.client.cluster] != 'undefined') {
							gData.clients[msg.client.uid][msg.client.cluster]--;
							if(gData.clients[msg.client.uid][msg.client.cluster]==0){
								delete gData.clients[msg.client.uid][msg.client.cluster];
							}
						}
						break;
					case "clear":
						if(typeof gData.clients[msg.client.uid] !='undefined' && Object.keys(gData.clients[msg.client.uid]).length==0){
							delete gData.clients[msg.client.uid];
							cluster.workers[msg.client.cluster].send({action:"clear",type:"client",uid:msg.client.uid});
						}
						break;
					case "cmd":
						_this.cmd({type: "client",uid: msg.client.uid, cid: msg.client.cid});
				}
			}
			console.log(msg);
			if(typeof msg.manager != 'undefined'){
				switch(msg.manager.type){
					case "in":
						if(typeof gData.managers[msg.manager.uid] == 'undefined') gData.managers[msg.manager.uid] = {};
						if(typeof gData.managers[msg.manager.uid][msg.manager.cluster] == 'undefined') gData.managers[msg.manager.uid][msg.manager.cluster] = 0;
						gData.managers[msg.manager.uid][msg.manager.cluster]++;
						break;
					case "exit":
						if(typeof gData.managers[msg.manager.uid][msg.manager.cluster] != 'undefined') {
							gData.managers[msg.manager.uid][msg.manager.cluster]--;
							if(gData.managers[msg.manager.uid][msg.manager.cluster]==0){
								delete gData.managers[msg.manager.uid][msg.manager.cluster];
							}
						}
						break;
					case "clear":
						if(typeof gData.managers[msg.manager.uid] !='undefined' && Object.keys(gData.managers[msg.manager.uid]).length==0){
							delete gData.managers[msg.manager.uid];
							cluster.workers[msg.manager.cluster].send({action:"clear",type:"manager",uid:msg.manager.uid});
						}
						break;
					case "cmd":
						_this.cmd({type: "manager",uid: msg.manager.uid, cid: msg.manager.cid});
				}
			}
		},
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
					_this.cmd(cmd);
				});
			}
			callback(200,'{"response":"done"}');
		},
		cmd: function(info, num){
			if( typeof num =='undefined') num = 0;
			if(num > 500) return;
			var _this = this;
			switch(info.type){
				case "client": 
					if(typeof gData.clients[info.uid]=='undefined' || Object.keys(gData.clients[info.uid]).length==0) setTimeout(function(){_this.cmd(info,num+1);},10);
					else {
						for(var index in gData.clients[info.uid]){
							_this.cluster.workers[index].send({"action":"cmd",type:"client",cid: info.cid, uid: info.uid});
						}
					}
					break;
				case "manager": 
					if(typeof gData.managers[info.uid]=='undefined' || Object.keys(gData.managers[info.uid]).length==0) setTimeout(function(){_this.cmd(info,num+1);},10);
					else {
						for(var index in gData.managers[info.uid]){
							console.log(gData.managers[info.uid],index,gData.managers[info.uid][index]);
							_this.cluster.workers[index].send({"action":"cmd",type:"manager",cid: info.cid, uid: info.uid});
						}
					}
					break;
			}
		}
	}
}
