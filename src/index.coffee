getSchema = (id) ->
  id = id.replace '.json', ''
  schema = module.exports.schema[id]
  return schema

module.exports =
  runner: require './runner'
  subprocess: require './subprocess'
  mocha: require './mocha'
  schema: require '../schema'
  getSchema: getSchema
