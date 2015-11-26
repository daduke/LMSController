/**
 * lmspebble - control your squeezebox music players from your pebble
 *
 * (c) 2015 Christian Herzog <daduke@daduke.org>
 * 
 * pebble.js rewrite of https://github.com/gibald/SqueezeBox
 *
 */

// configure your logitech media player here
var protocol = 'http';
var host     = '192.168.0.1';
var port     = '9000';

// libraries we need
var UI = require('ui');
var Vector2 = require('vector2');
var Vibe = require('ui/vibe');


// XHR call to control logitech media player
var xhrRequest = function (url, type, callback) {
  var xhr = new XMLHttpRequest();
  console.log("status::: "+xhr.status);
  xhr.onload = function () {
    callback(this.responseText);
  };
  xhr.open(type, url);
  xhr.send();
};

// JSON Ajax call to logitech media player RPC
function ajaxJSONPost(url, jsondata, callback){
  var xhr = new XMLHttpRequest();
  xhr.open("POST", url);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onreadystatechange = function () {
    if (xhr.readyState == 4 && xhr.status == 200) {
      var json = JSON.parse(xhr.responseText);
      callback(json);
    }
  };
  xhr.send(jsondata);
}

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


// get list of players and create menu
var playerMenu;
var URL = protocol + '://' + host  + ':' + port;
var reqStr = '{"id":1,"method":"slim.request","params":["",["serverstatus",0,999]]}';
var ajResp;
ajaxJSONPost(URL+'/jsonrpc.js', reqStr, getPlayers);

// callback for player data
function getPlayers(data) {
  ajResp = data;
	var players = [];
	ajResp.result.players_loop.forEach(function(s, i, o) {
		players.push({title: s.name, groups:[], subtitle: ''});
	});
		
	// menu UI element for list of players
  playerMenu = new UI.Menu({sections: [{ title: 'Players', items: players }], playerIndex: 0 });
	splashWindow.hide();
	playerMenu.show();
	
	// handler when player is selected
	playerMenu.on('select', function(event) {
		var playerMAC = ajResp.result.players_loop[event.itemIndex].playerid;
		var playerName = ajResp.result.players_loop[event.itemIndex].name;
		var playerModel = ajResp.result.players_loop[event.itemIndex].model;
		
		// show control card for selected player
		var playerCard = new UI.Card({
			title: playerName,
			body:  playerModel,
			
			// display icons
			action: {
				up: 'images/volup.png',
				select: 'images/play.png',
				down: 'images/voldown.png'
			}
		});
		playerCard.show();
		
		// handlers for player control
		playerCard.on('click', 'up', function(event) {
			var myurl=URL+"/status.html?p0=mixer&p1=volume&p2=%2b10&player="+playerMAC;
			xhrRequest(myurl, 'GET', function(responseText) {Vibe.vibrate('short');});
		});
		playerCard.on('click', 'select', function(event) {
			var myurl=URL+"/status.html?p0=pause&player="+playerMAC;
			xhrRequest(myurl, 'GET', function(responseText) {Vibe.vibrate('short');});
		});
		playerCard.on('click', 'down', function(event) {
			var myurl=URL+"/status.html?p0=mixer&p1=volume&p2=-10&player="+playerMAC;
			xhrRequest(myurl, 'GET', function(responseText) {Vibe.vibrate('short');});
		});
		playerCard.on('longClick', 'up', function(event) {
			var myurl=URL+"/status.html?p0=playlist&p1=jump&p2=%2b1&player="+playerMAC;
			xhrRequest(myurl, 'GET', function(responseText) {Vibe.vibrate('short');});
		});
		playerCard.on('longClick', 'select', function(event) {
			var myurl=URL+"/status.html?p0=power&player="+playerMAC;
			xhrRequest(myurl, 'GET', function(responseText) {Vibe.vibrate('short');});
		});
		playerCard.on('longClick', 'down', function(event) {
			var myurl=URL+"/status.html?p0=playlist&p1=jump&p2=-1&player="+playerMAC;
			xhrRequest(myurl, 'GET', function(responseText) {Vibe.vibrate('short');});
		});
	});
}