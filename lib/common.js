const Promise = require('bluebird');

exports.isBrowser = function isBrowser() {
  if ((typeof process !== 'undefined') && process.execPath && process.execPath.match(/node|iojs/)) {
    return false;
  }
  return true;
};

exports.randomString = function randomString(n) {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0, end = n, asc = end >= 0; asc ? i < end : i > end; asc ? i += 1 : i -= 1) {
    const idx = Math.floor(Math.random() * possible.length);
    text += possible.charAt(idx);
  }
  return text;
};

exports.asyncSeries = function asyncSeries(items, func, callback) {
  const runItems = items.slice(0);
  const results = [];
  function next() {
    if (runItems.length === 0) {
      callback(null, results);
      return;
    }
    const item = runItems.shift();
    func(item, (err, result) => {
      if (err) {
        callback(err);
        return;
      }
      results.push(result);
      next();
    });
  }
  next();
};

exports.isArray = Array.isArray || ((value) => ({}).toString.call(value) === '[object Array]');

exports.startsWith = (str, sub) => str.indexOf(sub) === 0;

// Based on http://stackoverflow.com/a/38225011/1967571
const rejectDelayer = function rejectDelayer(delay) {
  return (reason) => new Promise((resolve, reject) => setTimeout(reject.bind(null, reason), delay));
};

exports.retryUntil = function retryUntil(attempt, test, delay = 500, max = 5) {
  let p = Promise.reject(new Error('retry starter'));
  for (let i = 0, end = max, asc = end >= 0; asc ? i <= end : i >= end; asc ? i += 1 : i -= 1) {
    p = p.catch(attempt).then(test).catch(rejectDelayer(delay));
  }
  return p;
};
