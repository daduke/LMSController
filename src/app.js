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
	var URL = settings.protocol + '://' + settings.ip + ':' + settings.port;
}

var title = '';
var artist = '';

// load libraries
var UI = require('ui');
var Vector2 = require('vector2');
var Vibe = require('ui/vibe');
var Accel = require('ui/accel');
var ajax = require('ajax');

// XHR call to control logitech media player
var sbRequest = function (url, method, data, callback) {
	var options = {
		url: url,
	};
	if (settings.password !== '') {
		options.headers = { Authorization: "Basic " + btoa(settings.user + ":" + settings.password) };
	}
	if (data) {
		options.data = data;
	}
	if (method === 'POST') {
		options.method = 'post';
		options.type = 'json';
	}
	ajax(options,
		function(data, status, request) {
			callback(data);
		},
		function(error, status, request) {
			console.log('The ajax request failed: ' + request + '   ' + status + '    '  + error);
		}
	);
};

// get information about playing track
function trackInfo(mac, window, artistBox, titleBox) {
  var data = {"id":1,"method":"slim.request","params":[mac,["status","-",1,"tags:a"]]};
	sbRequest(URL+"/jsonrpc.js", "POST", data, function(response) {
		artist = response.result.playlist_loop[0].artist;
		title = response.result.playlist_loop[0].title;
		switch (response.result.mode) {
			case 'play':
				window.action({
					up: 'images/volup.png',
					select: 'images/pause.png',
					down: 'images/voldown.png'
				});
				break;
			case 'pause':
				if (response.result.remote === 1) {
					artist = 'is paused';
					title = '';
				}
				window.action({
					up: 'images/volup.png',
					select: 'images/play.png',
					down: 'images/voldown.png'
				});
				break;
		}
		if (response.result.power === 0) {
			artist = 'is off';
			title = '';
			window.action({
				up: 'images/volup.png',
				select: 'images/play.png',
				down: 'images/voldown.png'
			});
		}
		artistBox.text(artist);
		titleBox.text(title);
    }
  );
}

Accel.init();
// show splash screen while waiting for data
var splashWindow = new UI.Window();
var splashText = new UI.Text({
  position: new Vector2(0, 0),
  size: new Vector2(144, 168),
  text:'get player info...',
  font:'gothic_28_bold',
  color:'white',
  textOverflow:'wrap',
  textAlign:'center',
  backgroundColor:'black'
});
splashWindow.add(splashText);
splashWindow.show();

// show player card
function showPlayer(event, data) {
	var playerMAC = data.result.players_loop[event.itemIndex].playerid;
	var playerName = data.result.players_loop[event.itemIndex].name;

	// show control card for selected player
	var playerInfo = new UI.Window({
		action: {
			up: 'images/volup.png',
			select: 'images/play.png',
			down: 'images/voldown.png'
		}
	});
	var bgRect = new UI.Rect({
		position: new Vector2(0, 0),
		size: new Vector2(144, 168),
		backgroundColor: 'white'
	});
	playerInfo.add(bgRect);
	
	var playerBox = new UI.Text({
		position: new Vector2(3, 0),
		size: new Vector2(114, 25),
		font: 'gothic_18',
		text: playerName,
		color: 'black',
		textOverflow:'wrap',
		textAlign:'left',
	});
	playerInfo.add(playerBox);
	
	var artistBox = new UI.Text({
		position: new Vector2(3, 28),
		size: new Vector2(114, 60),
		font: 'gothic_24',
		text: '',
		color: 'black',
		textOverflow:'wrap',
		textAlign:'left',
	});
	playerInfo.add(artistBox);
	
	var titleBox = new UI.Text({
		position: new Vector2(3, 78),
		size: new Vector2(114, 150),
		font: 'gothic_24_bold',
		text: '',
		color: 'black',
		textOverflow:'wrap',
		textAlign:'left',
	});
	playerInfo.add(titleBox);
	
	playerInfo.show();
	trackInfo(playerMAC, playerInfo, artistBox, titleBox);

	// handlers for player control
	var increment = settings.increment;
	playerInfo.on('click', 'up', function(event) {
		var myurl=URL+"/status.html?p0=mixer&p1=volume&p2=%2b"+increment+"&player="+playerMAC;
		sbRequest(myurl, 'GET', '', function(response) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
			trackInfo(playerMAC, playerInfo, artistBox, titleBox);
		});
	});
	playerInfo.on('click', 'select', function(event) {
		var myurl=URL+"/status.html?p0=pause&player="+playerMAC;
		sbRequest(myurl, 'GET', '', function(response) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
			trackInfo(playerMAC, playerInfo, artistBox, titleBox);
		});
	});
	playerInfo.on('click', 'down', function(event) {
		var myurl=URL+"/status.html?p0=mixer&p1=volume&p2=-"+increment+"&player="+playerMAC;
		sbRequest(myurl, 'GET', '', function(response) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
			trackInfo(playerMAC, playerInfo, artistBox, titleBox);
		});
	});
	playerInfo.on('longClick', 'up', function(event) {
		var myurl=URL+"/status.html?p0=playlist&p1=jump&p2=-1&player="+playerMAC;
		sbRequest(myurl, 'GET', '', function(response) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
			trackInfo(playerMAC, playerInfo, artistBox, titleBox);
		});
	});
	playerInfo.on('longClick', 'select', function(event) {
		var myurl=URL+"/status.html?p0=power&player="+playerMAC;
		sbRequest(myurl, 'GET', '', function(response) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
			trackInfo(playerMAC, playerInfo, artistBox, titleBox);
		});
	});
	playerInfo.on('longClick', 'down', function(event) {
		var myurl=URL+"/status.html?p0=playlist&p1=jump&p2=%2b1&player="+playerMAC;
		sbRequest(myurl, 'GET', '', function(response) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
			trackInfo(playerMAC, playerInfo, artistBox, titleBox);
		});
	});
	playerInfo.on('accelTap', function(event) {
			if (settings.vibration) {
				Vibe.vibrate('short');
			}
		trackInfo(playerMAC, playerInfo, artistBox, titleBox);
	});
}

// get list of players and create menu
var playerMenu;
var data = {"id":1,"method":"slim.request","params":["",["serverstatus",0,999]]};
sbRequest(URL+'/jsonrpc.js', "POST", data, getPlayers);

// callback for player data
function getPlayers(data) {
	var players = [];
	data.result.players_loop.forEach(function(s, i, o) {
		var playing = (s.isplaying === 1)?'playing':'off';
		players.push({title: s.name, groups:[], subtitle: playing});
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
		URL = 'http://' + settings.ip  + ':' + settings.port;
	}
});