/*jslint node: true */

'use strict';

if (process.argv[2] == null) {
  console.log("Filename as argument must be provided.");
  process.exit(1);
}

var fs = require('fs');
var needle = require('needle');
var q = require('q');

var apiUrl = {
  global: 'https://twitchemotes.com/api_cache/v2/global.json',
  subscriber: 'https://twitchemotes.com/api_cache/v2/subscriber.json',
  betterttv: 'https://cdn.betterttv.net/emotes/emotes.json'
};

function download(url, callback) {
  var deferred = q.defer();
  needle.get(url, function (error, response) {
    if (!error && response.statusCode === 200) {
      deferred.resolve(response);
    } else {
      deferred.reject(error);
    }
  });
  return deferred.promise;
}

function parseGlobal(obj) {
  var newObj = {};
  Object.keys(obj.emotes).forEach(function (key) {
    newObj[key] = obj.emotes[key].image_id;
  });
  return newObj;
}

function parseSubscriber(obj) {
  var newObj = {};
  for (var i in obj.channels) {
    newObj[i] = {};
    for (var j in obj.channels[i].emotes) {
        var key = obj.channels[i].emotes[j].code;
        var value = obj.channels[i].emotes[j].image_id;
        newObj[i][key] = value;
    }
  }
  return newObj;
}

function parseBetterttv(obj) {
  var newObj = {}, i, key = '', value = '';
  for (i = 0; i < obj.length; i += 1) {
    key = obj[i].regex;
    value = obj[i].url;
    newObj[key] = value;
  }
  return newObj;
}

function save(filename, data) {
  var deferred = q.defer();
  fs.writeFile(filename, data, function (err) {
    if (err) {
      deferred.reject(err);
    } else {
      deferred.resolve(true);
    }
  });
  return deferred.promise;
}

var emotesGlobal = {};
var emotesSubscriber = {};
var emotesBetterttv = {};

q.all([
  download(apiUrl.global),
  download(apiUrl.subscriber),
  download(apiUrl.betterttv)
]).spread(function (resGlobal, resSubscriber, resBetterttv) {
  emotesGlobal = parseGlobal(resGlobal.body);
  emotesSubscriber = parseSubscriber(resSubscriber.body);
  emotesBetterttv = parseBetterttv(resBetterttv.body);
}).then(function () {
  return save(process.argv[2], JSON.stringify({
    global: emotesGlobal,
    subscriber: emotesSubscriber,
    betterttv: emotesBetterttv
  }));
}).then(function () {
  console.log('Emotes saved.');
}).fail(function (err) {
  console.log('Error:', err);
});