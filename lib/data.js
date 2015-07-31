module.exports = function(redis,mysql){
	redis: redis,
	mysql: mysql,
	get: function(hash,callback){
		_this.redis.get(hash,function(err,res){
			if(res!=null) callback(JSON.parse(res));
			else {
				var info = hash.split(':');
				switch(info[1]){
					case 'c':
						switch(info[2]){
							case 'h':
								callback(null);
								break;
							case 'i':
								mysql.getConnection(function (err, connection) {
									connection.query( 'SELECT * FROM msg_client where id = ?',info[3], function(err, rows) {
										if(typeof rows[0] == 'undefined') callback(null);
										else  {
											var info = JSON.parse(rows[0].info);
											rows[0].info = info;
											callback(rows[0]);
											_this.redis.set(hash,JSON.stringify(rows[0]));
										}
										connection.release();
									});
								});
								break;
						}
						break;
				}
			}
		});
	}
}


/*
c:h select 
*/