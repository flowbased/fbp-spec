fbpspec = require '../'

tv4 = require 'tv4'
chai = require 'chai' if not chai
yaml = require 'js-yaml'

examplesDir = require('path').join __dirname, '..', 'examples'
listExamples = () ->
  return require('fs').readdirSync examplesDir
getExample = (name) ->
  p = require('path').join examplesDir, name
  content = require('fs').readFileSync p, encoding:'utf-8'
  results = []
  yaml.safeLoadAll content, (doc) ->
    results.push doc
  results = results[0] if results.length == 1
  return results

describe 'Examples', ->
  schema = fbpspec.getSchema 'testsfile'
  before: ->
    tv4.addSchema schema.id, schema
  after: ->
    tv4.reset()

  listExamples().forEach (name) ->
    describe "#{name}", ->
      error = null
      try
        example = getExample name
      catch e
        error = e

      it 'should load without error', ->
        chai.expect(error).to.not.exist
        chai.expect(example).to.exist

      it "should valididate against schema", ->
        results = tv4.validateMultiple example, schema.id
        chai.expect(results.errors).to.eql []


