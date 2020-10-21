/* eslint global-require: "off" */
try {
  module.exports = {
    base: require('./base.json'),
    testcase: require('./testcase.json'),
    testsuite: require('./testsuite.json'),
    testsuites: require('./testsuites.json'),
    expectations: require('./expectations.json'),
    testsfile: require('./testsfile.json'),
  };
} catch (e) {
  console.log('fbp-spec: Failed to load schemas', e);
}
