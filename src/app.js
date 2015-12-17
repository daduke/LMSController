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

var artist = 'empty playlist';
var title = '';

// load libraries
var UI = require('ui');
var Vector2 = require('vector2');
var Vibe = require('ui/vibe');
var Accel = require('ui/accel');
var ajax = require('ajax');

// *** helper functions ***
// XHR call to control logitech media player
function sbRequest(url, method, data, callback) {
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
}

// update info window
function updateInfo(response, window, artistBox, titleBox) {
	artist = response.result.playlist_loop[0].artist || 'empty playlist';
	title = response.result.playlist_loop[0].title || '';
	switch (response.result.mode) {
		case 'play':
			window.action({
				up: 'images/volup.png',
				select: 'images/pause.png',
				down: 'images/voldown.png',
				backgroundColor: 'black'
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
				down: 'images/voldown.png',
				backgroundColor: 'black'
			});
			break;
	}
	if (response.result.power === 0) {
		artist = 'is off';
		title = '';
		window.action({
			up: 'images/volup.png',
			select: 'images/play.png',
			down: 'images/voldown.png',
			backgroundColor: 'black'
		});
	}
	artistBox.text(artist);
	titleBox.text(title);
}

// get information about playing track
function trackInfo(mac, window, artistBox, titleBox) {
  var data = {"id":1,"method":"slim.request","params":[mac,["status","-",1,"tags:a"]]};
	sbRequest(URL+"/jsonrpc.js", "POST", data, function(response) {
		updateInfo(response, window, artistBox, titleBox);
	});
}

function actOnButton(playerMAC, playerInfo, artistBox, titleBox) {
	if (settings.vibration) {
		Vibe.vibrate('short');
	}
	trackInfo(playerMAC, playerInfo, artistBox, titleBox);
}

// show player window
function showPlayer(event, playerData) {
	var playerMAC = playerData.result.players_loop[event.itemIndex].playerid;
	var playerName = playerData.result.players_loop[event.itemIndex].name;

	// build control window for selected player
	var playerInfo = new UI.Window({
		action: {
			up: 'images/volup.png',
			select: 'images/play.png',
			down: 'images/voldown.png',
			backgroundColor: 'black',
			fullscreen: false
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
		size: new Vector2(110, 22),
		font: 'gothic_18_bold',
		text: playerName,
		color: 'black',
		textOverflow:'ellipsis',
		textAlign:'left',
	});
	playerInfo.add(playerBox);
	
	var artistBox = new UI.Text({
		position: new Vector2(3, 23),
		size: new Vector2(110, 60),
		font: 'gothic_24',
		text: '',
		color: 'black',
		textOverflow: 'ellipsis',
		textAlign:'left',
	});
	playerInfo.add(artistBox);
	
	var titleBox = new UI.Text({
		position: new Vector2(3, 72),
		size: new Vector2(110, 96),
		font: 'gothic_24_bold',
		text: '',
		color: 'black',
		textOverflow: 'ellipsis',
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
			actOnButton(playerMAC, playerInfo, artistBox, titleBox);
		});
	});
	playerInfo.on('click', 'select', function(event) {
		var myurl=URL+"/status.html?p0=pause&player="+playerMAC;
		sbRequest(myurl, 'GET', '', function(response) {
			actOnButton(playerMAC, playerInfo, artistBox, titleBox);
		});
	});
	playerInfo.on('click', 'down', function(event) {
		var myurl=URL+"/status.html?p0=mixer&p1=volume&p2=-"+increment+"&player="+playerMAC;
		sbRequest(myurl, 'GET', '', function(response) {
			actOnButton(playerMAC, playerInfo, artistBox, titleBox);
		});
	});
	playerInfo.on('longClick', 'up', function(event) {
		var myurl=URL+"/status.html?p0=playlist&p1=jump&p2=-1&player="+playerMAC;
		sbRequest(myurl, 'GET', '', function(response) {
			actOnButton(playerMAC, playerInfo, artistBox, titleBox);
		});
	});
	playerInfo.on('longClick', 'select', function(event) {
		var myurl=URL+"/status.html?p0=power&player="+playerMAC;
		sbRequest(myurl, 'GET', '', function(response) {
			actOnButton(playerMAC, playerInfo, artistBox, titleBox);
		});
	});
	playerInfo.on('longClick', 'down', function(event) {
		var myurl=URL+"/status.html?p0=playlist&p1=jump&p2=%2b1&player="+playerMAC;
		sbRequest(myurl, 'GET', '', function(response) {
			actOnButton(playerMAC, playerInfo, artistBox, titleBox);
		});
	});
	playerInfo.on('accelTap', function(event) {
		actOnButton(playerMAC, playerInfo, artistBox, titleBox);
	});
}

// populate menu
function updateMenu() {
	var data = {"id":1,"method":"slim.request","params":["",["serverstatus",0,999]]};
	sbRequest(URL+'/jsonrpc.js', "POST", data, getPlayers);
}

// callback for player data
function getPlayers(data) {
	var players = [];
	playerData = data;
	data.result.players_loop.forEach(function(s, i, o) {
		var playing = (s.isplaying === 1)?'playing':'on';
		if (s.power === 0) playing = 'off';
		players.push({title: s.name, groups:[], subtitle: playing});
	});
//	players.sort(function(a,b) {
//    return a.title.localeCompare(b.title);
//	});
  playerMenu.items(0, players);
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

// *** program flow starts here ***
Accel.init();
// menu for the LMS players
var playerMenu = new UI.Menu({sections: [{ title: 'Players', items: [{title: 'getting players..'}] }], playerIndex: 0 });
var playerData;
// handler when menu is drawn
playerMenu.on('show', function(event) {
	updateMenu(event);
});

// handler when player is selected
playerMenu.on('select', function(event) {
	showPlayer(event, playerData);
});
playerMenu.show();	// rest of program flow happens via handlers