
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
      results.unshift result
      return next()
  next()

exports.isArray = Array.isArray || ( value ) -> return {}.toString.call( value ) is '[object Array]'

exports.startsWith = (str, sub) ->
  return str.indexOf(sub) == 0
