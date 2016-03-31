/**
 * LMSController - control your Logitech music players from your pebble
 *
 * (c) 2016 Christian Herzog <daduke@daduke.org>
 *
 */

// get LMS URL
var settings = JSON.parse(localStorage.getItem("settings")) || [];
if (settings) {
    var URL = settings.protocol + '://' + settings.ip + ':' + settings.port;
}
if (settings.menuskip) {
    settings.menuskip = "|" + settings.menuskip;
}
var skipList = 'Turn Off|Turn On|Search|App Gallery|Library Views|Remote Music|Compilations|Music Folder|Genres|Years'+settings.menuskip;
if (settings.menushow) {
    settings.menushow.split("|").forEach(function (item) {
        var menushow = new RegExp("\\|"+item, "g");
        skipList = skipList.replace(menushow, "");
    });
}
var menuskip = new RegExp(skipList, "g");
if (settings.debug) console.log('skip: '+menuskip);

var artist = 'empty playlist';
var title = '';
var volume = 0;
var BGCOLOR;
var ABCOLOR;
var HICOLOR;
var XRES;
var YRES;
var TALIGN;
var PALIGN;
var WIDTH;
var TOP;
var MAC;
var playerInfo;
var artistBox;
var titleBox;
var volumeBox;
var actionMenus = [];
var platform;

// load libraries
var UI = require('ui');
var Vector2 = require('vector2');
var Vibe = require('ui/vibe');
var Accel = require('ui/accel');
var ajax = require('ajax');

// *** helper functions ***
//iOS is missing btoa() -> own Base64 routine
var Base64 = (function() {
    "use strict";
    var _keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var _utf8_encode = function (string) {
        var utftext = "", c, n;
        string = string.replace(/\r\n/g,"\n");
        for (n = 0; n < string.length; n++) {
            c = string.charCodeAt(n);
            if (c < 128) {
                utftext += String.fromCharCode(c);
            } else if((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            } else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }
        }
        return utftext;
    };

    var encode = function (input) {
        var output = "", chr1, chr2, chr3, enc1, enc2, enc3, enc4, i = 0;
        input = _utf8_encode(input);
        while (i < input.length) {
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);
            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;
            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }
            output += _keyStr.charAt(enc1);
            output += _keyStr.charAt(enc2);
            output += _keyStr.charAt(enc3);
            output += _keyStr.charAt(enc4);
        }
        return output;
    };
    return {
        'encode': encode
    };
}());

// XHR call to control logitech media player
function sbRequest(url, method, data, callback) {
    var options = {
        url: url,
    };
    if (settings.password !== '') {
        options.headers = { Authorization: "Basic " + Base64.encode(settings.user + ":" + settings.password) };
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
                if (settings.debug) console.log('The ajax request failed: ' + request + '   ' + status + '    '  + error);
            }
        );
}

// update info window
function updateInfo(response, window, artistBox, titleBox, volumeBox) {
    if (response.result.playlist_loop) {
        artist = response.result.playlist_loop[0].artist || 'empty playlist';
        title = response.result.playlist_loop[0].title || '';
    } else {
        artist = 'empty playlist';
        title = '';
    }
    volume = response.result["mixer volume"];
    if (volume === 100) volume = 99;
    if (volume < 0) volume = 0;
    switch (response.result.mode) {
        case 'play':
            window.action({
                up: 'images/volup.png',
                select: 'images/pause.png',
                down: 'images/voldown.png',
                backgroundColor: ABCOLOR
            });
            break;
        case 'pause':
        case 'stop':
            if (response.result.remote === 1 && !settings.streampause) {
                artist = 'is paused';
                title = '';
            }
            window.action({
                up: 'images/volup.png',
                select: 'images/play.png',
                down: 'images/voldown.png',
                backgroundColor: ABCOLOR
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
            backgroundColor: ABCOLOR
        });
    }
    artistBox.text(artist);
    titleBox.text(title);
    volumeBox.text(volume);
}

// get information about playing track
function trackInfo(mac, window, artistBox, titleBox, volumeBox) {
    var data = {"id":1,"method":"slim.request","params":[mac,["status","-",1,"tags:a"]]};
    sbRequest(URL+"/jsonrpc.js", "POST", data, function(response) {
        updateInfo(response, window, artistBox, titleBox, volumeBox);
    });
}

function actOnButton(playerMAC, playerInfo, artistBox, titleBox, volumeBox) {
    if (settings.vibration) {
        Vibe.vibrate('short');
    }
    trackInfo(playerMAC, playerInfo, artistBox, titleBox, volumeBox);
}

// show player window
function showPlayer(event) {
    var playerMAC = event.item.mac;
    MAC = playerMAC;
    var playerName = event.item.title;
    var counter = localStorage.getItem(playerMAC);
    localStorage.setItem(playerMAC, ++counter);


    // build control window for selected player
    playerInfo = new UI.Window({
        action: {
            up: 'images/volup.png',
            select: 'images/play.png',
            down: 'images/voldown.png'
        },
        backgroundColor: ABCOLOR,
        fullscreen: true
    });
    var bgRect = new UI.Rect({
        position: new Vector2(0, 0),
        size: new Vector2(XRES, YRES),
        backgroundColor: BGCOLOR
    });
    playerInfo.add(bgRect);

    var xpos = (platform === 'chalk')?(XRES/2):51;
    var playerBox = new UI.Text({
        position: new Vector2(xpos-48, TOP),
        size: new Vector2(96, 22),
        font: 'gothic_18_bold',
        text: playerName,
        color: 'black',
        textOverflow:'ellipsis',
        textAlign: PALIGN
    });
    playerInfo.add(playerBox);

    artistBox = new UI.Text({
        position: new Vector2(3, TOP+23),
        size: new Vector2(WIDTH, 60),
        font: 'gothic_24',
        text: '',
        color: 'black',
        textOverflow: 'ellipsis',
        textAlign: TALIGN
    });
    playerInfo.add(artistBox);

    titleBox = new UI.Text({
        position: new Vector2(3, TOP+72),
        size: new Vector2(WIDTH, 96),
        font: 'gothic_24_bold',
        text: '',
        color: 'black',
        textOverflow: 'ellipsis',
        textAlign: TALIGN
    });
    playerInfo.add(titleBox);

    var x = (platform === 'chalk')?83:100;
    volumeBox = new UI.Text({
        position: new Vector2(x, 0),
        size: new Vector2(18, 22),
        font: 'gothic_14',
        text: '',
        color: 'black',
        textOverflow: 'ellipsis',
        textAlign: 'left'
    });
    playerInfo.add(volumeBox);

    playerInfo.show();
    trackInfo(playerMAC, playerInfo, artistBox, titleBox, volumeBox);
    // handlers for player control
    var increment = settings.increment;
    playerInfo.on('click', 'up', function(event) {
        var myurl=URL+"/status.html?p0=mixer&p1=volume&p2=%2b"+increment+"&player="+playerMAC;
        sbRequest(myurl, 'GET', '', function(response) {
            actOnButton(playerMAC, playerInfo, artistBox, titleBox, volumeBox);
        });
    });
    playerInfo.on('click', 'select', function(event) {
        var myurl=URL+"/status.html?p0=pause&player="+playerMAC;
        sbRequest(myurl, 'GET', '', function(response) {
            actOnButton(playerMAC, playerInfo, artistBox, titleBox, volumeBox);
        });
    });
    playerInfo.on('click', 'down', function(event) {
        var myurl=URL+"/status.html?p0=mixer&p1=volume&p2=-"+increment+"&player="+playerMAC;
        sbRequest(myurl, 'GET', '', function(response) {
            actOnButton(playerMAC, playerInfo, artistBox, titleBox, volumeBox);
        });
    });
    playerInfo.on('longClick', 'up', function(event) {
        playerInfo.action({
            up: 'images/prev.png',
            select: 'images/dots.png',
            down: 'images/next.png',
            backgroundColor: ABCOLOR
        });
        var myurl=URL+"/status.html?p0=playlist&p1=jump&p2=-1&player="+playerMAC;
        sbRequest(myurl, 'GET', '', function(response) {
            actOnButton(playerMAC, playerInfo, artistBox, titleBox, volumeBox);
        });
    });
    playerInfo.on('longClick', 'select', function(event) {
        playerInfo.action({
            up: 'images/prev.png',
            select: 'images/dots.png',
            down: 'images/next.png',
            backgroundColor: ABCOLOR
        });
        var myurl=URL+"/jsonrpc.js";
        var data = {"id":1,"method":"slim.request","params":[playerMAC,["menu",0,500,"direct:1"]]};
        sbRequest(myurl, "POST", data, function(response) {
            getMenu(response, 'home');
        });
    });
    playerInfo.on('longClick', 'down', function(event) {
        playerInfo.action({
            up: 'images/prev.png',
            select: 'images/dots.png',
            down: 'images/next.png',
            backgroundColor: ABCOLOR
        });
        var myurl=URL+"/status.html?p0=playlist&p1=jump&p2=%2b1&player="+playerMAC;
        sbRequest(myurl, 'GET', '', function(response) {
            actOnButton(playerMAC, playerInfo, artistBox, titleBox, volumeBox);
        });
    });
    playerInfo.on('accelTap', function(event) {
        actOnButton(playerMAC, playerInfo, artistBox, titleBox, volumeBox);
    });
    playerInfo.on('show', function(event) {
        trackInfo(playerMAC, playerInfo, artistBox, titleBox, volumeBox);
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
    data.result.players_loop.forEach(function(s, i, o) {
        var playing = (s.isplaying === 1)?'playing':'on';
        if (s.power === 0) playing = 'off';
        players.push({title: s.name, subtitle: playing, mac: s.playerid});
    });
    players.sort( function( a, b ) {
        var countA = localStorage.getItem(a.mac);
        var countB = localStorage.getItem(b.mac);
        if (settings.dynsort) {
            return countA  > countB ? -1 : 1;
        } else {
            return a.title < b.title ? -1 : 1;
        }
    });
    playerMenu.items(0, players);
}

function processMenu(event) {
    var myurl=URL+"/jsonrpc.js";
    var data;
    var topNode;
    var topName;
    var ti = 0;		//if 1, we go back to track info screen
    if (event.item.go) {
        var cmd = event.item.go.cmd;
        var params = event.item.go.params;
        if (cmd[0] && (cmd[0] === 'play' || cmd[0] === 'playalbum')) {
            data = {"id":1,"method":"slim.request","params":[MAC, event.item.go.params]};
            ti = 1;
        } else if (cmd[0] && cmd[0] === 'playlist') {
            if (cmd[1] === 'song') {
                data = {"id":1,"method":"slim.request","params":[MAC,["playlist","index",cmd[2]]]};
            } else {
                data = {"id":1,"method":"slim.request","params":[MAC,["playlistcontrol","cmd:load","menu:1",cmd[1]+"_id:"+cmd[2],"useContextMenu:1"]]};
            }
            ti = 1;
        } else if (cmd[0] && cmd[0] === 'custom') {
            data = {"id":1,"method":"slim.request","params":[MAC, event.item.go.params]};
        } else if (cmd[0] && cmd[0] === 'showplaylist') {
            topNode = 'showplaylist';
            data = {"id":1,"method":"slim.request","params":[MAC,["status","-",50,"tags:a"]]};
        } else {
            topNode = '';
            topName = '';
            cmd.push(0,500);
            for (var key in params) {
                cmd.push(key+":"+params[key]);
            }
            data = {"id":1,"method":"slim.request","params":[MAC,cmd]};
        }
    } else {
        topNode = event.item.id;
        topName = event.item.title;
        data = {"id":1,"method":"slim.request","params":[MAC,["menu",0,500,"direct:1"]]};
    }
    if (settings.debug) console.log(JSON.stringify(data));
    sbRequest(myurl, "POST", data, function(response) {
        if (ti) {		//close menus if we're going back to track info
            actionMenus.forEach(function(s, i, o) {
                s.hide();
            });
            setTimeout(function() {		//wait for track to start before reading track info
                trackInfo(MAC, playerInfo, artistBox, titleBox, volumeBox);
            }, 5000);
        } else {
            getMenu(response, topNode, topName);
        }
    });
}

// callback for player menu
function getMenu(data, topNode, topName) {
    var entries = [];
    var go = {};
    var am = new UI.Menu({
        sections: [{
            title: topName,
            items: [{title: 'getting menu..'}]
        }],
        menuIndex: 0,
        backgroundColor: BGCOLOR,
        highlightBackgroundColor: HICOLOR
    });

    if (topNode === 'home') {   //top level menu gets playlist menu
        go = {"cmd": ["showplaylist"], "params": []};
        entries.push({id: '0', title: 'Show Playlist', weight: 0, go: go});
    }

    if (topNode === 'showplaylist') {
        data.result.playlist_loop.forEach(function(s, i, o) {		//parse and display playlist
            if (settings.debug) console.log(JSON.stringify(s));
            go = {"cmd": [ "playlist", 'song', s["playlist index"]]};
            entries.push({id: s.id, title: s.title, subtitle: s.artist, weight: 0, go: go});
        });
    } else {
        data.result.item_loop.forEach(function(s, i, o) {		//parse result loop
            if (topNode !== '' && s.node !== topNode) { return; }		//filter out submenu entries
            if (s.text.match(menuskip)) { return; }		//filter out submenu entries
            if (settings.debug) console.log(JSON.stringify(s));
            if (s.goAction) {		//parse action command tied to entry
                if (s.goAction === 'play' || s.goAction === 'playControl') {
                    go = {"cmd": ["play"], "params": []};
                    data.result.base.actions.play.cmd.forEach(function(s, i, o) {
                        go.params.push(s);
                    });
                    go.params.push('item_id:'+s.params.item_id);
                }
            } else if (s.type === 'playlist') {
                if (s.params) {
                    go = {"cmd": ["playalbum"], "params": []};
                    data.result.base.actions.play.cmd.forEach(function(s, i, o) {
                        go.params.push(s);
                    });
                    for (var key in s.params) {
                        go.params.push(key+":"+s.params[key]);
                    }
                } else if (s.commonParams.playlist_id) {
                    go = {"cmd": [ "playlist", 'playlist', s.commonParams.playlist_id ]};
                } else if (s.commonParams.artist_id) {
                    go = {"cmd": [ "playlist", 'artist', s.commonParams.artist_id ]};
                } else if (s.commonParams.album_id) {
                    go = {"cmd": [ "playlist", 'album', s.commonParams.album_id ]};
                }
            } else if (s.type === 'album') {
                if (s.params.album) {
                    go = {"cmd": ["playalbum"], "params": []};
                    data.result.base.actions.play.cmd.forEach(function(s, i, o) {
                        go.params.push(s);
                    });
                    for (var key in s.params) {
                        go.params.push(key+":"+s.params[key]);
                    }
                    for (var key in data.result.base.actions.play.params) {
                        go.params.push(key+":"+data.result.base.actions.play.params[key]);
                    }
                }
            } else if (s.params) {
                go = {"cmd": ["custom"], "params": []};
                data.result.base.actions.go.cmd.forEach(function(s, i, o) {
                    go.params.push(s);
                });
                go.params.push(0, 500);
                for (var key in s.params) {
                    go.params.push(key+":"+s.params[key]);
                }
                go.params.push("useContextMenu:1");
            } else {
                go = (s.actions && s.actions.go)?s.actions.go:'';
            }
            entries.push({id: s.id, title: s.text, weight: s.weight, go: go});
        });
    }
    /*		entries.sort( function(a,b) {
            if (a.weight) {
            return a.weight > b.weight ? 1 : -1;
            } else {
            return a.title > b.title ? 1 : -1;
            }
            }); */
        am.on('select', function(event) {
            processMenu(event);
        });
    am.items(0, entries);
    am.show();
    actionMenus.push(am);
}

// LMS configuration
Pebble.addEventListener('showConfiguration', function(event) {
    var settings = encodeURIComponent(localStorage.getItem("settings"));
    Pebble.openURL('https://daduke.org/lmscontroller/index.html?' + settings);
});

Pebble.addEventListener("webviewclosed", function(event) {
    if (event.response!="CANCELLED" && event.response != "{}") {
        var settings = JSON.parse(decodeURIComponent(event.response));
        localStorage.clear();
        localStorage.setItem("settings", JSON.stringify(settings));
        URL = 'http://' + settings.ip  + ':' + settings.port;
    }
});

// *** program flow starts here ***
if (Pebble.getActiveWatchInfo) {
    var watchinfo = Pebble.getActiveWatchInfo();
    platform = watchinfo.platform;
} else {
    platform="aplite";
} 
if (platform === 'aplite') {
    BGCOLOR = 'white';
    ABCOLOR = 'lightGray';
    HICOLOR = 'black';
    XRES = 144;
    YRES = 168;
    TALIGN = 'left';
    PALIGN = 'left';
    WIDTH = 110;
    TOP = 0;
} else if (platform === 'basalt') {
    BGCOLOR = 'pictonBlue';
    ABCOLOR = 'blueMoon';
    HICOLOR = 'blueMoon';
    XRES = 144;
    YRES = 168;
    TALIGN = 'left';
    PALIGN = 'left';
    WIDTH = 110;
    TOP = 0;
} else if (platform === 'chalk') {
    BGCOLOR = 'pictonBlue';
    ABCOLOR = 'blueMoon';
    HICOLOR = 'blueMoon';
    XRES = 180;
    YRES = 180;
    TALIGN = 'right';
    PALIGN = 'center';
    WIDTH = 132;
    TOP = 14;
}
Accel.init();
// menu for the LMS players
var playerMenu = new UI.Menu({
    sections: [{
        title: 'Players',
        items: [{title: 'getting players..'}]
    }],
    playerIndex: 0,
    backgroundColor: BGCOLOR,
    highlightBackgroundColor: HICOLOR
});
// handler when menu is drawn
playerMenu.on('show', function(event) {
    updateMenu(event);
});

// handler when player is selected
playerMenu.on('select', function(event) {
    showPlayer(event);
});
// toggle player power via long press
playerMenu.on('longSelect', function(event) {
    var playerMAC = event.item.mac;
    var myurl=URL+"/status.html?p0=power&player="+playerMAC;
    sbRequest(myurl, 'GET', '', function(response) {
        updateMenu(event);
    });
});
playerMenu.show();  // rest of program flow happens via handlers
