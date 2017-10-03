
Promise = require 'bluebird'

exports.isBrowser = () ->
  if typeof process isnt 'undefined' and process.execPath and process.execPath.match /node|iojs/
    return false
  return true

exports.randomString = (n) ->
  text = "";
  possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for i in [0...n]
    idx = Math.floor Math.random()*possible.length
    text += possible.charAt idx
  return text

exports.asyncSeries = (items, func, callback) ->
  items = items.slice 0
  results = []
  next = () ->
    if items.length == 0
      return callback null, results
    item = items.shift()
    func item, (err, result) ->
      return callback err if err
      results.push result
      return next()
  next()

exports.isArray = Array.isArray || ( value ) -> return {}.toString.call( value ) is '[object Array]'

exports.startsWith = (str, sub) ->
  return str.indexOf(sub) == 0

# Based on http://stackoverflow.com/a/38225011/1967571
rejectDelayer = (delay) ->
  f = (reason) ->
    return new Promise (resolve, reject) ->
      setTimeout(reject.bind(null, reason), delay)
  return f

exports.retryUntil = (attempt, test, delay=500, max=5) ->
  p = Promise.reject(new Error 'retry starter')
  for i in [0..max]
    p = p.catch(attempt).then(test).catch(rejectDelayer(delay))
  return p
