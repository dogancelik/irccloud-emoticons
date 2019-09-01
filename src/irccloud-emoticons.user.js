// @include-static ../build/$meta$

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

// Other regex matching options
var optsRegex = { sep: '\\S?', escape: false };
var optsNonword = { sep: '\\S?' };

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
    [].concat(keys).forEach((function (key) {
      localStorage.removeItem(this.keyPrefix + key);
    }).bind(this));
  }
};

function embedStyle() {
  var style = document.createElement('style');
  style.type = 'text/css';
  style.innerHTML = '/* @include ../build/style.css */';
  document.head.appendChild(style);
}

function createMenu() {
  return $('<div id="te-bar" class="settingsMenu__item settingsMenu__item__twitchemoticons"><a class="settingsMenu__link" href="/?/settings=twitchemoticons">Emoticons</a></div>').insertAfter('.settingsContainer .settingsMenu .settingsMenu__item:last');
}

function createContainer() {
  return $('/* @include ../build/container.html */').insertAfter('.settingsContentsWrapper .settingsContents:last');
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

    var pack;
    var packName = Settings.get(TE_URLS + '.' + url); // resolved pack name from previously downloaded url
    var shouldRefresh = false;

    if (packName != null) {
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

    console.log('Cached pack name:', packName);
    console.log('Should refresh:', shouldRefresh);
    console.log('URL:', url);
    console.log('Cached pack:', pack);

    if (shouldRefresh) {
      return $.getJSON(url)
      .then(function (data) {
        Settings.set(TE_URLS + '.' + url, data.name);
        data.downloadDate = dateNow;
        return data;
      }, function () {
        failedPacks.push(url);
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
        var pack = arguments[i];
        if (typeof pack !== 'object') continue; // skip failed requests
        if (!pack.hasOwnProperty('name')) continue; // skip objects that has not name

        var packName = pack.name;
        Settings.set(TE_CACHED + '.' + packName, JSON.stringify(pack));
        loadedPacks[packName] = pack;
      }
      callback();
      return true;
    });
}

function addRegexes() {
  Object.keys(loadedPacks).forEach(function (packName) {
    var matchType = loadedPacks[packName].match;
    for (var i = 0; i < loadedPacks[packName].icons.length; i++) {
      var _regex;
      var match = loadedPacks[packName].icons[i].match;
      switch (matchType) {
        case 'word': _regex = createRegex(match); break;
        case 'regex': _regex = createRegex(match, optsRegex); break;
        default: _regex = createRegex(match, optsNonword); break;
      }
      loadedPacks[packName].icons[i]._regex = _regex;
    }
  });
}

function escapeRegExp(str){
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createRegex(key, opts) {
  if (typeof opts === 'undefined') opts = {};
  if (!opts.hasOwnProperty('sep')) opts.sep = '\\b';
  if (!opts.hasOwnProperty('flags')) opts.flags = 'g';
  if (!opts.hasOwnProperty('escape')) opts.escape = true;

  return new RegExp(opts.sep + (opts.escape ? escapeRegExp(key) : key) + opts.sep, opts.flags);
}

function loopTextNodes(el, iconKey, img, rgx) {
  var arr;
  if (el.nodeType === Node.TEXT_NODE) {
    arr = [el];
  } else {
    arr = Array.prototype.slice.call(el.childNodes).filter(function (node) {
      return node.nodeType === Node.TEXT_NODE;
    });
  }

  arr.forEach(function(node) {
    var newNode = node;
    rgx.lastIndex = 0;
    var result;
    while (result = rgx.exec(newNode.data)) {
      rgx.lastIndex = 0;
      newNode = newNode.splitText(result.index);
      newNode.replaceData(0, result[0].length, '');
      newNode.parentNode.insertBefore(img.clone()[0], newNode);
      // loopTextNodes(newNode, iconKey, img, rgx);
    }
  });
}

function processPack(packName, el, width, height) {
  var matchType = loadedPacks[packName].match;
  for (var i = 0; i < loadedPacks[packName].icons.length; i++) {
    var icon = loadedPacks[packName].icons[i];

    // Search text
    if (matchType === 'word' && el.innerHTML.indexOf(icon.match) === -1) continue;
    if (!icon._regex.test(el.textContent)) continue;

    // Image tag
    var img = loadedPacks[packName].template;
    for (var key in icon) {
      img = img.replace(new RegExp(':' + key, 'g'), icon[key]);
    }
    img = $(img).width(width).height(height);

    // Replace
    loopTextNodes(el, icon.match, img, icon._regex);
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
      for (var key in localStorage) {
        if (key.indexOf(TE_CACHED) !== -1) localStorage.removeItem(key);
      }
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
      Settings.remove([TE_ENABLED,TE_DATA,TE_WATCH,TE_ACTIVE,TE_CACHED,TE_URLS,TE_WIDTH,TE_HEIGHT]);
      result.text('Reset successful!');
      result.removeClass().addClass('te-result userSuccess');
    }
    catch (e) {
      console.log('Reset error:', e);
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
    addRegexes(); // don't create regexes on message processing

    var $loaded = container.find('#te-packs-loaded');
    var $failed = container.find('#te-packs-failed');

    $loaded.append(Object.keys(loadedPacks).map(function (name) {
      var count = loadedPacks[name].icons.length;
      return '<span><i>' + name + '</i> (<code>' + count +'</code>)</span>';
    }).join(', '));

    $failed.append(failedPacks.map(function (url) {
      return '<code>' + url.replace(defaultDomain, '<i>(default domain)</i>') + '</code>';
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
