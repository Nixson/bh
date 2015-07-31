var http = require('http');

var num = 0;
function hg(){
	if(num > 10000) return;
	console.log(num);
num++;
var req = http.request({hostname:"localhost",port:8000,path:"/",method:"get"},function(){
//	setTimeout(function(){},1);
	hg();
});
req.write(" ");
req.end();
}

 hg();