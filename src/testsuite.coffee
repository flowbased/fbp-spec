
jsyaml = window.jsyaml if window?.jsyaml?
jsyaml = require 'js-yaml' if not jsyaml

common = require './common'
schemas = require '../schema'

exports.validate = validate = (obj) ->
  tv4 = window?.tv4
  tv4 = require 'tv4' if not tv4

  tv4.reset()
  for name, schema of schemas
    tv4.addSchema schema.id, schema

  results = tv4.validateMultiple obj, 'testsfile'
  return results

normalize = (suite) ->
  # Default name to topic
  suite.name = suite.topic if not suite.name
  suite.cases = [] if not suite.cases

  return suite

exports.create = (base) ->
  return normalize base

exports.loadYAML = loadYAML = (data) ->
  suites = []
  suite = jsyaml.safeLoadAll data, (doc) ->
    suites.push normalize(doc)
  return suites

loadHTTP = (url, callback) ->
  if common.isBrowser()
    req = new XMLHttpRequest();
    req.addEventListener 'load', () ->
      suites = loadYAML @responseText
      return callback null, suites
    req.addEventListener 'error', () ->
      return callback new Error "Failed to load #{url}: #{@statusText}"
    req.open "get", url, true
    req.send()
    
  else
    throw new Error 'fbpspec.testsuite: Loading over HTTP not supported on node.js'

getFileSync = (test, callback) ->
  fs = require 'fs'
  path = require 'path'

  stat = fs.statSync test
  if stat.isDirectory()
    files = ( path.join(test, f) for f in fs.readdirSync(test) when f.indexOf('.yaml') != -1 )
    return getSuitesSync files
  else
    c = fs.readFileSync test
    return loadYAML c

# FIXME: get rid of this...
exports.getSuitesSync = getSuitesSync = (tests) ->
  tests = [ tests ] if not Array.isArray tests

  suites = []
  for test in tests
    suites = suites.concat getFileSync(test)
  return suites

exports.getSuites = (tests, callback) ->
  tests = [ tests ] if not Array.isArray tests

  loadTest = (test, cb) =>
    if common.startsWith test, 'http://' or common.startsWith 'https://'
      return loadHTTP test, cb
    else
      return cb null, getFileSync(test)

  common.asyncSeries tests, loadTest, (err, suitesList) ->
    return callback err if err
    # flatten list
    suites = []
    for ss in suitesList
      for s in ss
        suites.push s
    return callback null, suites
