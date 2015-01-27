//jslint jquery: true

(function () {
'use strict';

var emoteUrl = '//cdn.rawgit.com/dogancelik/irccloud-twitch-emoticons/master/build/emotes.all.json';
var loadedEmotes = {};
var templateTwitch = '<img src="//static-cdn.jtvnw.net/emoticons/v1/:id/1.0" alt=":name" title=":name">';
var templateBetterttv = '<img src=":src" alt=":name" title=":name">';

// Instead of reading settings every time we process an element, we cache the settings here
var subscriberWhitelist = [];
var imageWidth = null;
var imageHeight = null;
var emoteEnabledGlobal = null;
var emoteEnabledSubscriber = null;
var emoteEnabledBetterttv = null;

var Settings = {
  keyPrefix: 'te.',
  get: function(key, def) {
    var getVal = localStorage.getItem(this.keyPrefix + key);
    if (typeof def !== 'undefined' && getVal == null) {
      this.set(key, def);
      return def;
    }
    return getVal;
  },
  set: function(key, value) {
    localStorage.setItem(this.keyPrefix + key, value);
  }
};

function embedStyle() {
  var style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = '/* @include ../build/style.css */';
  document.head.appendChild(style);
}
  
function createMenu(itemId, itemClass, itemName) {
  return $('<div id="' + itemId + '"><a>' + itemName + '</a></div>').addClass(itemClass).insertAfter('#statusActions');
}
  
function createContainer() {
  return $('/* @include ../build/container.html */').insertAfter($('#upgradeContainer'));
}

function loadEmotes(url, callback) {
  var setData = Settings.get('emote.data', '');
  if (setData == '') {
    $.getJSON(url, function (data) {    
      loadedEmotes = data;
      Settings.set('emote.data', JSON.stringify(data));
      callback(data);
    });
  } else {
    var setJson = JSON.parse(setData);
    loadedEmotes = setJson;
    callback(setJson);
  }
}
  
function getWordRegex(key) {
  return new RegExp('\\b' + key + '\\b', 'g');
}

function processImage(elStr, width, height) {
  if (width == null && height == null) return elStr;
  return $(elStr).width(width).height(height).clone().wrap('<div/>').parent().html();
}
  
function processEmote(category, el, width, height) { 
  for (var key in loadedEmotes[category]) {
    // Regex
    var rgx = getWordRegex(key);
    
    // Search text
    if (el.innerHTML.indexOf(key) === -1) continue;
    if (!rgx.test(el.innerHTML)) continue;
    
    // Image tag
    var img = '';
    if (category === 'betterttv') {
      img = templateBetterttv.replace(/:name/g, key).replace(':src', loadedEmotes[category][key]);
    } else {
      img = templateTwitch.replace(/:name/g, key).replace(':id', loadedEmotes[category][key]);
    }
    img = processImage(img, width, height);
    
    // Replace
    el.innerHTML = el.innerHTML.replace(rgx, img);
  }
}
  
function processSubEmote(category, el, width, height) {
  for (var chan in loadedEmotes[category]) {    
    if ((subscriberWhitelist.length > 0 && subscriberWhitelist.indexOf(chan) !== -1) || (subscriberWhitelist.length == 0)) {
      for (var emote in loadedEmotes[category][chan]) {
        
        // Stupid fix for duplicate Kappa
        if (emote === 'Kappa') continue;
        
        // Regex
        var rgx = getWordRegex(emote);

        // Search
        if (el.innerHTML.indexOf(emote) === -1) continue;
        if (!rgx.test(el.innerHTML)) continue;
        
        // Image
        var img = '';
        img = templateTwitch.replace(/:name/g, emote).replace(':id', loadedEmotes[category][chan][emote]);
        img = processImage(img, width, height);
        
        // Replace
        el.innerHTML = el.innerHTML.replace(rgx, img);
      } 
    } else {
      continue;
    }
  }
}
  
function countSubEmote(category) {
  var t = 0;
  for (var key in loadedEmotes[category]) {
    t += Object.keys(loadedEmotes[category][key]).length;
  }
  return t;
}
  
function processMessage(el) {
  if (emoteEnabledGlobal) processEmote('global', el, imageWidth, imageHeight);
  if (emoteEnabledSubscriber) processSubEmote('subscriber', el, imageWidth, imageHeight);
  if (emoteEnabledBetterttv) processEmote('betterttv', el, imageWidth, imageHeight);
}
  
function bindMessages() {
  window.SESSION.backend.bind('message', function (msg) {
    if (msg.type === 'buffer_msg') {
      var elId = 'e' + msg.bid + '_' + msg.eid;
      setTimeout(function() {
        var el = document.getElementById(elId);
        if (el == null) return;
        var elc = el.querySelector('.message .content');
        processMessage(elc);
      }, 100);
    }
  });
}

function init() {
  embedStyle();

  var container = createContainer();
  
  container.find('#te-enabled-check').on('change', function() {
    Settings.set('enabled', this.checked);
  }).prop('checked', JSON.parse(Settings.get('enabled', true)));
  
  container.find('#te-reload').on('click', function() {
    Settings.set('emote.data', '');
    this.innerHTML = '(Will download the latest emoticons file after you reload the page)';
  });
  
  var radiosWatch = container.find("input:radio[name='watch']");
  radiosWatch.on('change', function() {
    Settings.set('watch.mode', radiosWatch.index(this));
  });
  radiosWatch.eq(Settings.get('watch.mode'), 1).prop('checked', true);

  container.find('#te-enabled-global').on('change', function() {
    Settings.set('emote.global.enabled', this.checked);
  }).prop('checked', JSON.parse(Settings.get('emote.global.enabled', true)));
  
  container.find('#te-enabled-subscriber').on('change', function() {
      Settings.set('emote.subscriber.enabled', this.checked);
  }).prop('checked', JSON.parse(Settings.get('emote.subscriber.enabled', false)));
  
  container.find('#te-enabled-betterttv').on('change', function() {
      Settings.set('emote.betterttv.enabled', this.checked);
  }).prop('checked', JSON.parse(Settings.get('emote.betterttv.enabled', true)));
  
  container.find('#te-whitelist-input').on('change', function() {
    Settings.set('emote.subscriber.whitelist', this.value);
  }).val(Settings.get('emote.subscriber.whitelist', ''));
  
  container.find('#te-image-width').on('change', function() {
    Settings.set('image.width', this.value);
  }).val(Settings.get('image.width', ''));
  
  container.find('#te-image-height').on('change', function() {
    Settings.set('image.height', this.value);
  }).val(Settings.get('image.height', ''));
  
  container.find('.close').on('click', function() {
    container.fadeOut();
  });
  
  var menu = createMenu('te-bar', 'te-menu', 'Twitch Emoticons');
  menu.children('a').on('click', function() {
    container.fadeIn();
  });
  
  loadEmotes(emoteUrl, function() {
    var spans = container.find('#te-sets label > span');
    spans.eq(0).append($("<code>").text(Object.keys(loadedEmotes.global).length));
    spans.eq(1).append($("<code>").text(countSubEmote('subscriber')));
    spans.eq(2).append($("<code>").text(Object.keys(loadedEmotes.betterttv).length));
    
    // Chrome can't into .map(String.trim)
    subscriberWhitelist = Settings.get('emote.subscriber.whitelist').trim().toLowerCase().split(',').map(function(i) { return i.trim(); }).filter(function(i){ return i !== ""; });
    imageWidth = Settings.get('image.width') || null;
    imageHeight = Settings.get('image.height') || null;
    emoteEnabledGlobal = JSON.parse(Settings.get('emote.global.enabled'));
    emoteEnabledSubscriber = JSON.parse(Settings.get('emote.subscriber.enabled'));
    emoteEnabledBetterttv = JSON.parse(Settings.get('emote.betterttv.enabled'));
    
    if (JSON.parse(Settings.get('enabled'))) {
      bindMessages();
    }
  });
}
  
(function checkSession () {
  if (window.hasOwnProperty('SESSION')) {
    window.SESSION.bind('init', function () {
      init();
    });
  } else {
    setTimeout(checkSession, 100);
  }
})();

})();