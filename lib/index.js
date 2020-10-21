function getSchema(id) {
  const schemaId = id.replace('.json', '');
  return module.exports.schema[schemaId];
}

module.exports = {
  // eslint-disable-next-line global-require
  runner: require('./runner'),
  // eslint-disable-next-line global-require
  subprocess: require('./subprocess'),
  // eslint-disable-next-line global-require
  mocha: require('./mocha'),
  // eslint-disable-next-line global-require
  testsuite: require('./testsuite'),
  // eslint-disable-next-line global-require,import/no-unresolved
  schema: require('../schema'),
  getSchema,
  ui: {},
};
