if(typeof localStorage!='undefined'){
	var bhelpVersion = localStorage.getItem("bhelp_version");
	if(bhelpVersion==null || bhelpVersion != bhelpSrvVersion) bhelpLoad(bhelpSrvAddress); else eval(localStorage.getItem("bhelp_latest"));
} else bhelpLoad(bhelpSrvAddress);

function bhelpLoad(url){
	if (window.XMLHttpRequest) xmlhttp=new XMLHttpRequest(); else xmlhttp=new ActiveXObject("Microsoft.XMLHTTP");
    xmlhttp.onreadystatechange=function(){if (xmlhttp.readyState==4 && xmlhttp.status==200){if(typeof localStorage!='undefined') {localStorage.setItem("bhelp_latest",xmlhttp.responseText);} eval(xmlhttp.responseText);}}; xmlhttp.open("GET", url, false ); xmlhttp.send();
}
