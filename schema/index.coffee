try
  module.exports =
    testcase: require './testcase'
    testsuite: require './testsuite'
catch e
  console.log 'fbp-spec: Failed to load schemas', e
