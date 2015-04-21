
# TODO: add proper option for debug
debug = console.log
#debug = () ->

exports.debug = debug

exports.randomString = (n) ->
  text = "";
  possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for i in [0...n]
    idx = Math.floor Math.random()*possible.length
    text += possible.charAt idx
  return text

