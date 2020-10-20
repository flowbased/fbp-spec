const getSchema = function(id) {
  id = id.replace('.json', '');
  const schema = module.exports.schema[id];
  return schema;
};

module.exports = {
  runner: require('./runner'),
  subprocess: require('./subprocess'),
  mocha: require('./mocha'),
  testsuite: require('./testsuite'),
  schema: require('../schema'),
  getSchema,
  ui: {}
};
