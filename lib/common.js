/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const Promise = require('bluebird');

exports.isBrowser = function() {
  if ((typeof process !== 'undefined') && process.execPath && process.execPath.match(/node|iojs/)) {
    return false;
  }
  return true;
};

exports.randomString = function(n) {
  let text = "";
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0, end = n, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
    const idx = Math.floor(Math.random()*possible.length);
    text += possible.charAt(idx);
  }
  return text;
};

exports.asyncSeries = function(items, func, callback) {
  items = items.slice(0);
  const results = [];
  var next = function() {
    if (items.length === 0) {
      return callback(null, results);
    }
    const item = items.shift();
    return func(item, function(err, result) {
      if (err) { return callback(err); }
      results.push(result);
      return next();
    });
  };
  return next();
};

exports.isArray = Array.isArray || (value => ({}).toString.call( value ) === '[object Array]');

exports.startsWith = (str, sub) => str.indexOf(sub) === 0;

// Based on http://stackoverflow.com/a/38225011/1967571
const rejectDelayer = function(delay) {
  const f = reason => new Promise((resolve, reject) => setTimeout(reject.bind(null, reason), delay));
  return f;
};

exports.retryUntil = function(attempt, test, delay, max) {
  if (delay == null) { delay = 500; }
  if (max == null) { max = 5; }
  let p = Promise.reject(new Error('retry starter'));
  for (let i = 0, end = max, asc = 0 <= end; asc ? i <= end : i >= end; asc ? i++ : i--) {
    p = p.catch(attempt).then(test).catch(rejectDelayer(delay));
  }
  return p;
};
