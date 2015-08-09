
jsyaml = window.jsyaml if window?.jsyaml?
jsyaml = require 'js-yaml' if not jsyaml

normalize = (suite) ->
  # Default name to topic
  suite.name = suite.topic if not suite.name

  return suite

exports.loadYAML = loadYAML = (data) ->
  suites = []
  suite = jsyaml.safeLoadAll data, (doc) ->
    suites.push normalize(doc)
  return suites

exports.getSuitesSync = getSuitesSync = (tests) ->
  fs = require 'fs'
  path = require 'path'
  tests = [ tests ] if not Array.isArray tests

  suites = []

  for test in tests
    stat = fs.statSync test
    if stat.isDirectory()
      files = ( path.join(test, f) for f in fs.readdirSync(test) when f.indexOf('.yaml') != -1 )
      suites = suites.concat getSuitesSync(files)
    else
      c = fs.readFileSync test
      suites = suites.concat loadYAML(c)

  return suites

