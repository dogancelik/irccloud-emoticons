// ==UserScript==
// @name        IRCCloud Emoticons
// @namespace   dogancelik.com
// @description Enables Twitch emoticons and more in IRCCloud
// @icon        https://cdn.rawgit.com/irccloud-ext/graphics/master/emoticon-128.png
// @include     https://www.irccloud.com/*
// @version     3.0.0
// @grant       none
// @updateURL   https://github.com/dogancelik/irccloud-emoticons/raw/dev/build/irccloud-emoticons.meta.js
// @downloadURL https://github.com/dogancelik/irccloud-emoticons/raw/dev/build/irccloud-emoticons.user.js
// ==/UserScript==


(function () {
'use strict';

var emoteRefreshInterval = 604800000; // 7 days in milliseconds

// Emote packs
var defaultDomain = 'https://raw.githubusercontent.com/irccloud-ext/emoticon-packs/gh-pages';
var defaultPacks = ['/twitch/global', '/twitch/betterttv'];
var loadedPacks = {};
var failedPacks = [];

// Instead of reading settings every time we process an element, we cache the settings here
var imageWidth = null;
var imageHeight = null;

// Settings names
var TE_ENABLED = 'enabled';
var TE_DATA = 'emote.data';
var TE_REFRESH = 'emote.data.date';
var TE_WATCH = 'watch.mode';
var TE_WIDTH = 'image.width';
var TE_HEIGHT = 'image.height';
var TE_ACTIVE = 'packs.active';
var TE_CACHED = 'packs.cached';
var TE_URLS = 'packs.url';

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
  style.innerHTML = '#te-container{font-size:18px}#te-actions span{padding:2px 10px !important}.te-result{display:none;}.te-result.userSuccess,.te-result.userError{display:block}.te-bold{font-weight:bold}#te-sets label > span::after{content:" emotes)"}#te-sets label > span::before{content:"("}#te-donate{font-weight:bold;}#te-donate > *{vertical-align:top}#te-enabled-label{font-weight:normal}#te-enabled-check:not(:checked) ~ #te-enabled-label{color:#f00;}#te-enabled-check:not(:checked) ~ #te-enabled-label::after{content:"Not enabled"}#te-enabled-check:checked ~ #te-enabled-label{color:#008000;}#te-enabled-check:checked ~ #te-enabled-label::after{content:"Enabled"}';
  document.head.appendChild(style);
}

function createMenu() {
  return $('<div id="te-bar" class="settingsMenu__item settingsMenu__item__twitchemoticons"><a class="settingsMenu__link" href="#?/settings=twitchemoticons">Twitch Emoticons</a></div>').insertAfter('.settingsContainer .settingsMenu .settingsMenu__item:last');
}

function createContainer() {
  return $('<div id="te-container" data-section="twitchemoticons" class="settingsContents settingsContents__twitchemoticons"><h2 id="te-main-header" class="settingsTitle"><span><i>Emoticons</i></span>&nbsp;<input id="te-enabled-check" type="checkbox"/>&nbsp;<label id="te-enabled-label" for="te-enabled-check"></label></h2><p class="explanation">Type your text as you normally would, the script will automatically add emoticons to the messages.</p><div id="te-actions"><button id="te-reload"><span>Load the latest emoticons file</span></button><button id="te-reset"><span>Reset <i>Emoticons</i> completely</span></button></div><div id="te-result" class="te-result"></div><p class="te-bold explanation">After you change a setting, you need to click <i>Cancel</i> or <i>Save</i> button and reload the page.</p><h3>What to Watch?</h3><table class="checkboxForm"><tr><td><input id="te-enabled-messages-all" type="radio" name="watch"/></td><th><label for="te-enabled-messages-all">Watch all messages (including history)</label></th></tr><tr><td><input id="te-enabled-messages-new" type="radio" name="watch"/></td><th><label for="te-enabled-messages-new">Watch new messages only</label></th></tr></table><h3>Emoticon Sets</h3><p class="form"><label for="te-packs-active">Active Packs</label></p><p class="form"><textarea id="te-packs-active" class="input settings__inputSetting"></textarea></p><p class="form"><span>Loaded Packs:&nbsp;</span><span id="te-packs-loaded"></span></p><h3>Emoticon Size</h3><table class="form"><tr><th><label for="te-image-width">Width</label><span class="explanation">&nbsp;(optional)</span></th><td><input id="te-image-width" type="text" class="input"/></td></tr><tr><th><label for="te-image-height">Height</label><span class="explanation">&nbsp;(optional)</span></th><td><input id="te-image-height" type="text" class="input"/></td></tr></table><hr/><p id="te-donate" class="explanation">If you like this script, please&nbsp;<a href="http://dogancelik.com/donate.html" target="_blank">consider a donation</a></p><p class="explanation"><a href="https://github.com/dogancelik/irccloud-twitch-emoticons" target="_blank">Source code</a>&nbsp;-&nbsp;<a href="https://github.com/dogancelik/irccloud-twitch-emoticons/issues" target="_blank">Report bug / Request feature</a></p></div>').insertAfter('.settingsContentsWrapper .settingsContents:last');
}

function loadPacks(urls, callback) {

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

  var dateNow = Date.now();

  function promiseIt (url) {
    if (url[0] === '/') {
      url = defaultDomain + url + '.json';
    }

    var packName = Settings.get(TE_URLS + '.' + url); // resolved pack name from previously downloaded url
    console.log(url, packName);
    var shouldRefresh = false;

    if (packName != null) {
      var pack;
      try {
        pack = JSON.parse(Settings.get(TE_CACHED + '.' + packName));
      } catch (e) {
        pack = null;
      }

      if (pack != null) {
        var downloadDate = new Date(pack.downloadDate);
        var refreshDate = new Date(pack.downloadDate + emoteRefreshInterval);
        if (dateNow > refreshDate.getTime()) {
          shouldRefresh = true; // pack is old
        } else {
          shouldRefresh = false; // pack is recent
        }
      } else {
        shouldRefresh = true; // pack is null for some reason
      }
    } else {
      shouldRefresh = true; // no cached pack url -> pack name
    }

    console.log(shouldRefresh, url, pack);
    if (shouldRefresh) {
      return $.getJSON(url)
      .then(function (data) {
        Settings.set(TE_URLS + '.' + url, data.name);
        data.downloadDate = dateNow;
        return data;
      }, function () {
        return $.Deferred().resolve(false).promise();
      });
    } else {
      return pack;
    }
  }

  $.when.apply($, urls.map(promiseIt))
    .then(function () {
      console.log('args:', arguments);
      for (var i = 0; i < arguments.length; i++) {
        var pack;
        if ($.isFunction(arguments[i])) { // it's a promise
          if (arguments[i][1] !== 'success') continue; // pass errors
          pack = arguments[i][0]; // jqXHR data
        } else {
          pack = arguments[i];
        }

        var packName = pack.name;
        Settings.set(TE_CACHED + '.' + packName, JSON.stringify(pack));
        loadedPacks[packName] = pack;
      }
      callback();
      return true;
    });
}

function escapeRegExp(str){
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createRegex(key, sep, opts) {
  if (typeof sep === 'undefined') sep = '\\b';
  if (typeof opts === 'undefined') opts = 'g';
  return new RegExp(sep + escapeRegExp(key) + sep, opts);
}

function loopTextNodes(el, key, img, rgx) {
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

function processPack(packName, el, width, height) {
  for (var i = 0; i < loadedPacks[packName].icons.length; i++) {
    var icon = loadedPacks[packName].icons[i];
    // Regex
    var rgx;
    if (loadedPacks[packName].match === 'word') {
      rgx = createRegex(icon.match);
    } else {
      rgx = createRegex(icon.match, '\\S?');
    }

    // Search text
    if (el.innerHTML.indexOf(icon.match) === -1) continue;
    if (!rgx.test(el.innerHTML)) continue;

    // Image tag
    var img = loadedPacks[packName].template;
    for (var key in icon) {
      img = img.replace(new RegExp(':' + key, 'g'), icon[key]);
    }
    img = $(img).width(width).height(height);

    // Replace
    loopTextNodes(el, icon.match, img, rgx);
  }
}

function processMessage(el) {
  for (var keys = Object.keys(loadedPacks), i = 0; i < keys.length; i++) {
    processPack(keys[i], el, imageWidth, imageHeight);
  }
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
  var container = createContainer();

  var hashName = 'twitchemoticons';
  if (window.location.hash === '#?/settings=' + hashName) {
    SESSIONVIEW.showSettings(hashName);
  }

  var result = container.find('#te-result');

  container.find('#te-enabled-check').on('change', function() {
    Settings.set(TE_ENABLED, this.checked);
  }).prop('checked', JSON.parse(Settings.get(TE_ENABLED, true)));

  container.find('#te-reload').on('click', function() {
    try {
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
      Settings.remove([TE_ENABLED,TE_DATA,TE_WATCH,TE_ACTIVE,TE_CACHED,TE_URLS,TE_WHITELIST,TE_WIDTH,TE_HEIGHT]);
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

  var packsToLoad = JSON.parse(Settings.get(TE_ACTIVE, JSON.stringify(defaultPacks)));
  container.find('#te-packs-active').on('change', function() {
    var val = this.value.trim().split('\n').map(function (i) {
      return i.trim();
    }).filter(function (i) {
      return i;
    });
    Settings.set(TE_ACTIVE, JSON.stringify(val));
  }).val(packsToLoad.join('\n'));

  container.find('#te-image-width').on('change', function() {
    Settings.set(TE_WIDTH, this.value);
  }).val(Settings.get(TE_WIDTH, ''));

  container.find('#te-image-height').on('change', function() {
    Settings.set(TE_HEIGHT, this.value);
  }).val(Settings.get(TE_HEIGHT, ''));

  loadPacks(packsToLoad, function() {
    console.log('Loaded packs:', loadedPacks);
    var $loaded = container.find('#te-packs-loaded');

    $loaded.append(Object.keys(loadedPacks).map(function (name) {
      var count = loadedPacks[name].icons.length;
      return '<span><i>' + name + '</i> (<code>' + count +'</code>)</span>';
    }).join(', '));

    imageWidth = Settings.get(TE_WIDTH) || null;
    imageHeight = Settings.get(TE_HEIGHT) || null;

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
