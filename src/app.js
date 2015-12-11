/**
 * LMSController - control your Logitech music players from your pebble
 *
 * (c) 2015 Christian Herzog <daduke@daduke.org>
 * 
 * pebble.js rewrite of https://github.com/gibald/SqueezeBox
 *
 */

// get LMS URL
var settings = JSON.parse(localStorage.getItem("settings"));
if (settings) {
//	var URL = settings.protocol + '://' + settings.ip + ':' + settings.port;
}
var URL = 'http://192.168.1.24:9002/';

var title = '';
var artist = '';
var mode = '';

// load libraries
var UI = require('ui');
var Vector2 = require('vector2');
var Vibe = require('ui/vibe');
var Accel = require('ui/accel');

// XHR call to control logitech media player
var xhrRequest = function (url, type, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open(type, url);
	if (settings.user !== '') {
		xhr.setRequestHeader("Authorization", "Basic " + btoa(settings.user + ":" + settings.password));
	}
  xhr.onload = function () {
    callback(this.responseText);
  };
  xhr.send();
};

// JSON Ajax call to logitech media player RPC
function ajaxJSONPost(url, jsondata, callback){
  var xhr = new XMLHttpRequest();
  xhr.open("POST", url);
  xhr.setRequestHeader('Content-Type', 'application/json');
	if (settings.user !== '') {
		xhr.setRequestHeader("Authorization", "Basic " + btoa(settings.user + ":" + settings.password));
	}
  xhr.onreadystatechange = function () {
    if (xhr.readyState == 4 && xhr.status == 200) {
      var json = JSON.parse(xhr.responseText);
      callback(json);
    }
  };
  xhr.send(jsondata);
}

// get information about playing track
function trackInfo(mac, card) {
  var data='{"id":1,"method":"slim.request","params":["'+mac+'",["status","-",1,"tags:a"]]}';
	ajaxJSONPost(URL+"/jsonrpc.js", data, function(response) {
		artist = response.result.playlist_loop[0].artist + ' - ';
		title = response.result.playlist_loop[0].title;
		switch (response.result.mode) {
			case 'play':
				mode = '';
				card.action({
					up: 'images/volup.png',
					select: 'images/pause.png',
					down: 'images/voldown.png'
				});
				break;
			case 'pause':
				mode = 'is paused';
				artist = '';
				title = '';
				card.action({
					up: 'images/volup.png',
					select: 'images/play.png',
					down: 'images/voldown.png'
				});
				break;
		}
		if (response.result.power === 0) {
			mode = 'is off';
			artist = '';
			title = '';
			card.action({
				up: 'images/volup.png',
				select: 'images/play.png',
				down: 'images/voldown.png'
			});
		}
		card.body(mode + artist + title);
    }
  );
}

Accel.init();
// show splash screen while waiting for data
var splashWindow = new UI.Window();
var text = new UI.Text({
  position: new Vector2(0, 0),
  size: new Vector2(144, 168),
  text:'get player info...',
  font:'GOTHIC_28_BOLD',
  color:'white',
  textOverflow:'wrap',
  textAlign:'center',
  backgroundColor:'black'
});
splashWindow.add(text);
splashWindow.show();

// show player card
function showPlayer(event, data) {
	var playerMAC = data.result.players_loop[event.itemIndex].playerid;
	var playerName = data.result.players_loop[event.itemIndex].name;

	// show control card for selected player
	var playerCard = new UI.Card({
		title: playerName,
		body:  artist + ' - ' + title,

		// display icons
		action: {
			up: 'images/volup.png',
			select: 'images/play.png',
			down: 'images/voldown.png'
		}
	});
	playerCard.show();
	trackInfo(playerMAC, playerCard);

	// handlers for player control
	playerCard.on('click', 'up', function(event) {
		var myurl=URL+"/status.html?p0=mixer&p1=volume&p2=%2b10&player="+playerMAC;
		xhrRequest(myurl, 'GET', function(response) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
			trackInfo(playerMAC, playerCard);
		});
	});
	playerCard.on('click', 'select', function(event) {
		var myurl=URL+"/status.html?p0=pause&player="+playerMAC;
		xhrRequest(myurl, 'GET', function(response) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
			trackInfo(playerMAC, playerCard);
		});
	});
	playerCard.on('click', 'down', function(event) {
		var myurl=URL+"/status.html?p0=mixer&p1=volume&p2=-10&player="+playerMAC;
		xhrRequest(myurl, 'GET', function(response) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
			trackInfo(playerMAC, playerCard);
		});
	});
	playerCard.on('longClick', 'up', function(event) {
		var myurl=URL+"/status.html?p0=playlist&p1=jump&p2=-1&player="+playerMAC;
		xhrRequest(myurl, 'GET', function(response) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
			trackInfo(playerMAC, playerCard);
		});
	});
	playerCard.on('longClick', 'select', function(event) {
		var myurl=URL+"/status.html?p0=power&player="+playerMAC;
		xhrRequest(myurl, 'GET', function(response) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
			trackInfo(playerMAC, playerCard);
		});
	});
	playerCard.on('longClick', 'down', function(event) {
		var myurl=URL+"/status.html?p0=playlist&p1=jump&p2=%2b1&player="+playerMAC;
		xhrRequest(myurl, 'GET', function(response) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
			trackInfo(playerMAC, playerCard);
		});
	});
	playerCard.on('accelTap', function(event) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
		trackInfo(playerMAC, playerCard);
	});
}

// get list of players and create menu
var playerMenu;
var data = '{"id":1,"method":"slim.request","params":["",["serverstatus",0,999]]}';
ajaxJSONPost(URL+'/jsonrpc.js', data, getPlayers);

// callback for player data
function getPlayers(data) {
	var players = [];
	data.result.players_loop.forEach(function(s, i, o) {
		players.push({title: s.name, groups:[], subtitle: ''});
	});
		
	// menu UI element for list of players
  playerMenu = new UI.Menu({sections: [{ title: 'Players', items: players }], playerIndex: 0 });
	splashWindow.hide();
	playerMenu.show();
	
	// handler when player is selected
	playerMenu.on('select', function(event) {
		showPlayer(event, data);
	});
}

// LMS configuration
Pebble.addEventListener('showConfiguration', function(event) {
	var settings = encodeURIComponent(localStorage.getItem("settings"));
  Pebble.openURL('https://daduke.org/lmscontroller/index.html?' + settings);
});

Pebble.addEventListener("webviewclosed", function(event) {
	if (event.response) {
		var settings = JSON.parse(decodeURIComponent(event.response));
		localStorage.clear();
		localStorage.setItem("settings", JSON.stringify(settings));
//		URL = 'http://' + settings.ip  + ':' + settings.port;
	}
});
