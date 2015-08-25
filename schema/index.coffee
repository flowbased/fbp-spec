
schemas = [
  'base'
  'testcase'
  'testsuite'
  'testsuites'
  'expectations'
  'testsfile'
]

try
  for name in schemas
    module.exports[name] = require "./#{name}"
catch e
  console.log 'fbp-spec: Failed to load schemas', e


