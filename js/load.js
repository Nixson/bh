(function(){function msieversion() {var ua = window.navigator.userAgent;var msie = ua.indexOf("MSIE ");if (msie > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./)) return parseInt(ua.substring(msie + 5, ua.indexOf(".", msie)));else return false;} function bhelpLoad(url,name){var mv = msieversion();if(!mv) {xmlhttp=new XMLHttpRequest(); xmlhttp.onreadystatechange=function(){if (xmlhttp.readyState==4 && xmlhttp.status==200){localStorage.setItem(name,xmlhttp.responseText);localStorage.setItem("bhelp_versioni",bhelpVer); eval(xmlhttp.responseText);}};}else if(mv < 9 && mv > 6) {xmlhttp=new XDomainRequest();xmlhttp.onload=function(){if (xmlhttp.readyState==4 && xmlhttp.status==200) {eval(xmlhttp.responseText); if(mv==8) {localStorage.setItem(name,xmlhttp.responseText);localStorage.setItem("bhelp_versioni",bhelpVer);} }}url = url.replace("https","http");}else return false;xmlhttp.open("GET", url, true ); xmlhttp.send();}var bl="bhelp_latesti",ba=bhelpSrvAddress+"/mini.js";if(window["localStorage"] != null){var bhelpVersion = localStorage.getItem("bhelp_versioni"); if(bhelpVersion==null || bhelpVersion != bhelpVer) bhelpLoad(ba,bl); else eval(localStorage.getItem(bl));} else bhelpLoad(ba,bl);})();
