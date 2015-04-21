module.exports =
  runner: require './runner'
  subprocess: require './subprocess'
  mocha: require './mocha'
  schema: require '../schema'

module.exports.getSchema = (id) ->
  id = id.replace '.json', ''
  return module.exports.schema[id]
