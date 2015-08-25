try
  module.exports =
    testcase: require './testcase'
    testsuite: require './testsuite'
    testsuites: require './testsuites'
    base: require './base'
    expectation: require './expectations'
    testsfile: require './testsfile'
catch e
  console.log 'fbp-spec: Failed to load schemas', e
