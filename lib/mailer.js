var 	http 					= require('http'),
		fs 						= require('fs'),
		qs						= require('querystring'),
		url						= require('url');
module.exports = function(gData){
	return {
		gData: gData,
		cs: null,
		close: function(){
			var _this = this;
			_this.cs.close();
		},
		bind: function(){
			var _this = this;
			_this.cs = http.Server(function(request, response) {
					request.setEncoding("utf8");
					var info = url.parse(request.url,true);
					info.headers = request.headers;
					if(info.pathname=='/' || info.pathname=='/favicon.ico'){
						response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
						response.write("\n");
						response.end();
					}else {
						process.nextTick(function(){
							if (request.method == 'POST') {
								var body = '';
								request.on('data', function (data) {
									body += data;
									if (body.length > 1e7)
									request.connection.destroy();
								});
								request.on('end', function () {
									var post = qs.parse(body);
									info.query = post;
									info.type = "post";
									response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
									response.write("{}\n");
									response.end();

									_this.response(info);
								});
							}
							else{
								info.type = "get";
								response.writeHead(200, {"Content-Type": "application/json; charset=utf8"});
								response.write("{}\n");
								response.end();
								_this.response(info);
							}
						});
					}
					request.on('error', function() {});
					request.on('clientError', function() {});
					request.on('close', function() {});

			});
			_this.cs.timeout = 0;
			_this.cs.listen(_this.gData.config.srv.mail);
			console.log('listen',_this.gData.config.srv.mail);
		},
		response: function(info){
			var _this = this;
			if(typeof info.query.data=='undefined'){
				return;
			}
			var query = JSON.parse(info.query.data);
			console.log(query);
			var reply = '';
			if(query.client.cemail!='')
				reply = query.client.cname+' <'+query.client.cemail+'>';
			if(query.client.email!='')
				reply = query.client.name+' <'+query.client.email+'>';
			var locale = _this.gData.config.locale['ru'];
			if(typeof query.client.locale!='undefined' && _this.gData.config.locale[query.client.locale]!='undefined')
				locale = _this.gData.config.locale[query.client.locale];
			var date = new Date();
			date.toLocaleString(locale.date);
			var html  = '<p>'+locale['hello-p1']+' '+date.toLocaleString(locale.date)+locale['hello-p2']+'</p>';
				html += '<ul>';
			var text  = locale['hello-p1']+' '+date.toLocaleString(locale.date)+locale['hello-p2']+"\n";
				text += "\n";
			if(query.client['name'] != ''){
				html +='<li>'+locale['name']+': <strong>'+query.client['name']+'</strong></li>';
				text +=       locale['name']+': '+query.client['name']+"\n";
			}
			if(query.client['phone'] != ''){
				html +='<li>'+locale['phone']+': <strong>'+query.client['phone']+'</strong></li>';
				text +=       locale['phone']+': '+query.client['phone']+"\n";
			}
			if(query.client['email'] != ''){
				html +='<li>'+locale['email']+': <strong>'+query.client['email']+'</strong></li>';
				text +=       locale['email']+': '+query.client['email']+"\n";
			}
			if(query.client['mcomment'] != ''){
				html +='<li>'+locale['mcomment']+': <strong>'+query.client['mcomment']+'</strong></li>';
				text +=       locale['mcomment']+': '+query.client['mcomment']+"\n";
			}
			if(query.client['cname'] != ''){
				html +='<li>'+locale['cname']+': <strong>'+query.client['cname']+'</strong></li>';
				text +=       locale['cname']+': '+query.client['cname']+"\n";
			}
			if(query.client['cphone'] != ''){
				html +='<li>'+locale['cphone']+': <strong>'+query.client['cphone']+'</strong></li>';
				text +=       locale['cphone']+': '+query.client['cphone']+"\n";
			}
			if(query.client['cemail'] != ''){
				html +='<li>'+locale['cemail']+': <strong>'+query.client['cemail']+'</strong></li>';
				text +=       locale['cemail']+': '+query.client['cemail']+"\n";
			}
			if(query.client['ccomment'] != ''){
				html +='<li>'+locale['ccomment']+': <strong>'+query.client['ccomment']+'</strong></li>';
				text +=       locale['ccomment']+': '+query.client['ccomment']+"\n";
			}
			html += '<li>'+locale['msgText']+':</li></ul>';
			text += locale['msgText']+":\n";
			html += query.msg;
			text += query.msg;


			var mailOptions = {
				'from': _this.gData.config.mail.from,
				'to': query.mail,
				'subject': locale.subject,
				'text': text,
				'html': html
			};
			if(reply!='')
				mailOptions.replyTo = reply;
			_this.gData.mailer.sendMail(mailOptions, function(error, info){
			    if(error){
			        return console.log(error);
			    }
			    console.log('Message sent: ' + info.response);
			});


/*

var mailOptions = {
    from: '"Fred Foo 👥" <foo@blurdybloop.com>', // sender address
    to: 'bar@blurdybloop.com, baz@blurdybloop.com', // list of receivers
    subject: 'Hello ✔', // Subject line
    text: 'Hello world 🐴', // plaintext body
    html: '<b>Hello world 🐴</b>' // html body
};

// send mail with defined transport object
transporter.sendMail(mailOptions, function(error, info){
    if(error){
        return console.log(error);
    }
    console.log('Message sent: ' + info.response);
});


			$format = 'H:i:s d.m.Y';
						$text = '<p>Здравствуйте. '.date($format,$list['time']).' c офлайн консультанта Вам пришло сообщение:</p>';
						$text .= '<ul>';
						$msgText = str_replace(array("\r","\n"), array("","<br />"), $list['text']);
						if(strlen($list['name']) > 0) $text .='<li>Имя (от менеджера): <strong>'.$list['name'].'</strong></li>';
						if(strlen($list['phone']) > 0) $text .='<li>Телефон (от менеджера): <strong>'.$list['phone'].'</strong></li>';
						if(strlen($list['email']) > 0) $text .='<li>email (от менеджера): <strong>'.$list['email'].'</strong></li>';
						if(strlen($list['comment']) > 0) $text .='<li>Контакты (от менеджера): <strong>'.$list['comment'].'</strong></li>';
						if(strlen($list['tname']) > 0) $text .='<li>Имя: <strong>'.$list['tname'].'</strong></li>';
						if(strlen($list['tphone']) > 0) $text .='<li>Телефон: <strong>'.$list['tphone'].'</strong></li>';
						if(strlen($list['temail']) > 0) $text .='<li>email: <strong>'.$list['temail'].'</strong></li>';
						if(strlen($list['tcomment']) > 0) $text .='<li>Контакты: <strong>'.$list['tcomment'].'</strong></li>';
						$text .='<li>Текст сообщения:</li></ul>';
						$text.= $msgText;
				$mail = new mail();
				$mail->Subject = "Offline сообщение";
				$mail->Body    = $text; //Text Body
													if(strlen($list['temail']) > 0) {
														//print  "\ntE: {$list['temail']}\n";
														 $mail->addReplyTo($list['temail'],$list['tname']);
														//$mail->Sender = $list['temail'];
													}
													elseif(strlen($list['email']) > 0) {
														//print  "\nmE: {$list['email']}\n";
														$mail->addReplyTo($list['email'],$list['name']);
														//$mail->Sender = $list['email'];
													}
				$mail->addAddress($list['off_email'],$list['fio']);


*/

		}
	}
};