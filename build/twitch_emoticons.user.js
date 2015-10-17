// ==UserScript==
// @name        Twitch Emoticons
// @namespace   dogancelik.com
// @description Enables Twitch emoticons in IRCCloud
// @include     https://www.irccloud.com/*
// @version     2.2.0
// @grant       none
// @updateURL   https://github.com/dogancelik/irccloud-twitch-emoticons/raw/master/build/twitch_emoticons.meta.js
// @downloadURL https://github.com/dogancelik/irccloud-twitch-emoticons/raw/master/build/twitch_emoticons.user.js
// ==/UserScript==

//jslint jquery: true

(function () {
'use strict';

var emoteUrl = '//cdn.rawgit.com/dogancelik/irccloud-twitch-emoticons/master/build/emotes.all.json';
var emoteRefreshInterval = 86400000; // 1 day in milliseconds
var loadedEmotes = {};
var templateTwitch = '<img src="//static-cdn.jtvnw.net/emoticons/v1/:id/1.0" alt=":name" title=":name">';
var templateBetterttv = '<img src="//cdn.betterttv.net/emote/:src/1x" alt=":name" title=":name">';

// Instead of reading settings every time we process an element, we cache the settings here
var subscriberWhitelist = [];
var imageWidth = null;
var imageHeight = null;
var emoteEnabledGlobal = null;
var emoteEnabledSubscriber = null;
var emoteEnabledBetterttv = null;

// Settings names
var TE_ENABLED = 'enabled';
var TE_DATA = 'emote.data';
var TE_REFRESH = 'emote.data.date';
var TE_WATCH = 'watch.mode';
var TE_GLOBAL = 'emote.global.enabled';
var TE_SUB = 'emote.subscriber.enabled';
var TE_BETTER = 'emote.betterttv.enabled';
var TE_WHITELIST = 'emote.subscriber.whitelist';
var TE_WIDTH = 'image.width';
var TE_HEIGHT = 'image.height';

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
  },
  remove: function (keys) {
    var keys = [].concat(keys);
    keys.forEach((function (key) {
      localStorage.removeItem(this.keyPrefix + key);
    }).bind(this));
  }
};

function embedStyle() {
  var style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = '#te-container{font-size:18px}.te-success,.te-error{font-weight:bold}.te-result{display:none;}.te-result.userSuccess,.te-result.userError{display:block}.te-bold{font-weight:bold}#te-sets label > span::after{content:" emotes)"}#te-sets label > span::before{content:"("}#te-donate{font-weight:bold;}#te-donate > *{vertical-align:top}#te-enabled-label{font-weight:normal}#te-enabled-check:not(:checked) ~ #te-enabled-label{color:#f00;}#te-enabled-check:not(:checked) ~ #te-enabled-label::after{content:"Not enabled"}#te-enabled-check:checked ~ #te-enabled-label{color:#008000;}#te-enabled-check:checked ~ #te-enabled-label::after{content:"Enabled"}';
  document.head.appendChild(style);
}
  
function createMenu() {
  return $('<div id="te-bar" class="settingsMenu__item settingsMenu__item__twitchemoticons"><a class="settingsMenu__link" href="#?/settings=twitchemoticons">Twitch Emoticons</a></div>').insertAfter('.settingsContainer .settingsMenu .settingsMenu__item:last');
}
  
function createContainer() {
  return $('<div id="te-container" data-section="twitchemoticons" class="settingsContents settingsContents__twitchemoticons"><h2 id="te-main-header" class="settingsTitle"><span>Twitch Emoticons&nbsp;</span><input id="te-enabled-check" type="checkbox"/>&nbsp;<label id="te-enabled-label" for="te-enabled-check"></label></h2><p class="explanation">Type your text as you normally would, the script will automatically add emoticons to the messages.</p><p class="explanation"><a id="te-reload" href="javascript:void(0)">Click here to load the latest emoticons file</a>&nbsp;or&nbsp;<a id="te-reset" href="javascript:void(0)">click here to reset Twitch Emoticons completely</a></p><div id="te-result" class="te-result"></div><p class="te-bold explanation">After you change a setting, you need to click <i>Cancel</i> or <i>Save</i> button and reload the page.</p><h3>What to Watch?</h3><table class="checkboxForm"><tr><td><input id="te-enabled-messages-all" type="radio" name="watch"/></td><th><label for="te-enabled-messages-all">Watch all messages (including history)</label></th></tr><tr><td><input id="te-enabled-messages-new" type="radio" name="watch"/></td><th><label for="te-enabled-messages-new">Watch new messages only</label></th></tr></table><h3>Emoticon Sets</h3><table id="te-sets" class="checkboxForm"><tr><td><input id="te-enabled-global" type="checkbox"/></td><th><label for="te-enabled-global">Global emoticons&nbsp;<span></span></label></th></tr><tr><td><input id="te-enabled-subscriber" type="checkbox"/></td><th><label for="te-enabled-subscriber">Subscriber emoticons&nbsp;<span></span></label><div id="te-whitelist-box"><input id="te-whitelist-input" type="text" placeholder="Channel whitelist"/><br/><span class="explanation">Leave empty if you want all subscriber emoticons; seperate channels with a comma.</span></div><span class="explanation">Use a whitelist if you are using <i>Watch all messages</i> option otherwise it may lag.</span></th></tr><tr><td><input id="te-enabled-betterttv" type="checkbox"/></td><th><label for="te-enabled-betterttv">BetterTTV emoticons&nbsp;<span></span></label></th></tr></table><h3>Emoticon Size</h3><table class="form"><tr><th><label for="te-image-width">Width</label><span class="explanation">&nbsp;(optional)</span></th><td><input id="te-image-width" type="text" class="input"/></td></tr><tr><th><label for="te-image-height">Height</label><span class="explanation">&nbsp;(optional)</span></th><td><input id="te-image-height" type="text" class="input"/></td></tr></table><hr/><p id="te-donate" class="explanation">If you like this script, please&nbsp;<a href="http://dogancelik.com/donate.html" target="_blank">consider a donation</a></p><p class="explanation"><a href="https://github.com/dogancelik/irccloud-twitch-emoticons" target="_blank">Source code</a>&nbsp;-&nbsp;<a href="https://github.com/dogancelik/irccloud-twitch-emoticons/issues" target="_blank">Report bug / Request feature</a></p></div>').insertAfter('.settingsContentsWrapper .settingsContents:last');
}

function loadEmotes(url, callback) {
  var setData = Settings.get(TE_DATA, '');

  var dateNow = JSON.stringify(Date.now());

  function getDate() {
    return parseInt(Settings.get(TE_REFRESH, dateNow), 10);
  }

  function isValidDate(dateObj) {
    if (dateObj instanceof Date) {
      if (isNaN(dateObj.getTime())) {
        return false;
      } else {
        return true;
      }
    } else {
      return false;
    }
  }

  var refreshDate = new Date(getDate() + emoteRefreshInterval);
  if (isValidDate(refreshDate) === false) {
    Settings.set(TE_REFRESH, dateNow);
    refreshDate = new Date(getDate() + emoteRefreshInterval);
  }
  var needRefresh = Date.now() > refreshDate.getTime();

  if (setData == '' || needRefresh === true) {
    $.getJSON(url, function (data) {
      loadedEmotes = data;
      Settings.set(TE_DATA, JSON.stringify(data));
      Settings.set(TE_REFRESH, dateNow); // not necessary
      callback(data);
    });
  } else {
    var setJson = JSON.parse(setData);
    loadedEmotes = setJson;
    callback(setJson);
  }
}
  
function getWordRegex(key, opts) {
  if (typeof opts === 'undefined') {
    var opts = 'g';
  } else if (opts === false || opts === null) {
    opts = '';
  }
  return new RegExp('\\b' + key + '\\b', opts);
}

function loopTextNodes(el, key, img, rgx) {
  if (typeof rgx === 'undefined') {
    var rgx = getWordRegex(key, false);
  }
  Array.prototype.slice.call(el.childNodes).forEach(function(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      var splitNode = node;
      var lastNode = node;
      var match = splitNode.data.match(rgx);
      if (match != null) {
        splitNode = splitNode.splitText(match.index);
        splitNode.data = splitNode.data.replace(rgx, '');
        el.insertBefore(img.clone()[0], splitNode);
        loopTextNodes(el, key, img, rgx);
      }
    }
  });
}

function processImage(elStr, width, height) {
  return $(elStr).width(width).height(height).clone();
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
    loopTextNodes(el, key, img);
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
        loopTextNodes(el, emote, img);
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
  var watchMode = Settings.get(TE_WATCH);

  if (watchMode == '0') {
    var observer = new MutationObserver(function(records) {
      records.forEach(function(record) {
        var els = [];

        // When we get new messages
        if (record.target.classList.contains('log') === true) {
          Array.prototype.slice.call(record.addedNodes).forEach(function (el) {
            if (el.classList.contains('type_buffer_msg') === true) {
              els.push(el);
            }
          });
        }

        // When we load the history
        if (record.target.classList.contains('type_buffer_msg')) {
          els.push(record.target);
        }


        els.forEach(function(el) {
          var parent = $(el).parent();

          // We process messages in the current log for once
          if (parent.data('te-history') != '1' && parent.hasClass('log')) {
            parent.find('.type_buffer_msg .message .content').each(function(i, elc) {
              processMessage(elc);
            });
            parent.data('te-history', '1');
          }

          var elc = el.querySelector('.message .content');
          if (elc == null) return;
          processMessage(elc);
        });
      });
    });
    observer.observe(document.getElementById('buffersContainer'), {
      subtree: true,
      childList: true
    });
  } else if (watchMode == '1') {
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
}

function init() {
  embedStyle();

  var menu = createMenu();

  if (window.location.hash === '#?/settings=twitchemoticons') {
    window.location.hash = '#?/settings';
    menu.find('a')[0].click();
  }

  var container = createContainer();
  var result = container.find('#te-result');
  
  container.find('#te-enabled-check').on('change', function() {
    Settings.set(TE_ENABLED, this.checked);
  }).prop('checked', JSON.parse(Settings.get(TE_ENABLED, true)));
  
  container.find('#te-reload').on('click', function() {
    try {
      Settings.set(TE_DATA, '');
      result.text('Emptied emoticon cache successfully!');
      result.removeClass().addClass('te-result userSuccess');
    }
    catch (e) {
      result.text('Could not empty emoticon cache!');
      result.removeClass().addClass('te-result userError');
    }
  });

  container.find('#te-reset').on('click', function() {
    try {
      Settings.remove([TE_ENABLED,TE_DATA,TE_WATCH,TE_GLOBAL,TE_SUB,TE_BETTER,TE_WHITELIST,TE_WIDTH,TE_HEIGHT]);
      result.text('Reset successful!');
      result.removeClass().addClass('te-result userSuccess');
    }
    catch (e) {
      result.text('Reset unsuccessful!');
      result.removeClass().addClass('te-result userError');
    }
  });
  
  var radiosWatch = container.find("input:radio[name='watch']");
  radiosWatch.on('change', function() {
    Settings.set(TE_WATCH, radiosWatch.index(this));
  });
  radiosWatch.eq(Settings.get(TE_WATCH, 1)).prop('checked', true);

  container.find('#te-enabled-global').on('change', function() {
    Settings.set(TE_GLOBAL, this.checked);
  }).prop('checked', JSON.parse(Settings.get(TE_GLOBAL, true)));
  
  container.find('#te-enabled-subscriber').on('change', function() {
      Settings.set(TE_SUB, this.checked);
  }).prop('checked', JSON.parse(Settings.get(TE_SUB, false)));
  
  container.find('#te-enabled-betterttv').on('change', function() {
      Settings.set(TE_BETTER, this.checked);
  }).prop('checked', JSON.parse(Settings.get(TE_BETTER, true)));
  
  container.find('#te-whitelist-input').on('change', function() {
    Settings.set(TE_WHITELIST, this.value);
  }).val(Settings.get(TE_WHITELIST, ''));
  
  container.find('#te-image-width').on('change', function() {
    Settings.set(TE_WIDTH, this.value);
  }).val(Settings.get(TE_WIDTH, ''));
  
  container.find('#te-image-height').on('change', function() {
    Settings.set(TE_HEIGHT, this.value);
  }).val(Settings.get(TE_HEIGHT, ''));
  
  loadEmotes(emoteUrl, function() {
    var spans = container.find('#te-sets label > span');
    spans.eq(0).append($('<code>').text(Object.keys(loadedEmotes.global).length));
    spans.eq(1).append($('<code>').text(countSubEmote('subscriber')));
    spans.eq(2).append($('<code>').text(Object.keys(loadedEmotes.betterttv).length));
    
    // Chrome can't into .map(String.trim)
    subscriberWhitelist = Settings.get(TE_WHITELIST).trim().toLowerCase().split(',').map(function(i) { return i.trim(); }).filter(function(i){ return i !== ""; });
    imageWidth = Settings.get(TE_WIDTH) || null;
    imageHeight = Settings.get(TE_HEIGHT) || null;
    emoteEnabledGlobal = JSON.parse(Settings.get(TE_GLOBAL));
    emoteEnabledSubscriber = JSON.parse(Settings.get(TE_SUB));
    emoteEnabledBetterttv = JSON.parse(Settings.get(TE_BETTER));
    
    if (JSON.parse(Settings.get(TE_ENABLED))) {
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