(function(){
	if(window["localStorage"] != null){
		var bhelpVersion = localStorage.getItem("bhelp_versioni"), bl="bhelp_latesti";
		var ba=bhelpSrvAddress+"/mini.js";
		console.log(bhelpSrvAddress,ba,bhelpSrvVersion);
		if(bhelpVersion==null || bhelpVersion != bhelpSrvVersion) bhelpLoad(ba,bl);
		else eval(localStorage.getItem(bl));
	} else bhelpLoad(ba,bl);
	function bhelpLoad(url,name){
		console.log(bhelpSrvAddress,ba,url);
		if (window.XMLHttpRequest) xmlhttp=new XMLHttpRequest();
		else xmlhttp=new ActiveXObject("Microsoft.XMLHTTP");
		xmlhttp.onreadystatechange=function(){
			if (xmlhttp.readyState==4 && xmlhttp.status==200){
				if(window["localStorage"] === null) {localStorage.setItem(name,xmlhttp.responseText);}
				eval(xmlhttp.responseText);
			}
		};
		console.log(url);
		xmlhttp.open("GET", url,true );
		xmlhttp.send();
	}

})();
