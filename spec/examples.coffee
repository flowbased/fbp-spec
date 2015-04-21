fbpspec = require '../'

tv4 = require 'tv4'
chai = require 'chai' if not chai
yaml = require 'js-yaml'

examplesDir = require('path').join __dirname, '..', 'examples'
listExamples = () ->
  return require('fs').readdirSync examplesDir
getExample = (name) ->
  p = require('path').join examplesDir, name
  c = require('fs').readFileSync p, encoding:'utf-8'
  return yaml.safeLoad c

describe 'Examples', ->
  schema = null
  before: ->
    schema = fbpspec.getSchema 'testsuite'
    tv4.addSchema schema.id, schema
  after: ->
    tv4.reset()

  listExamples().forEach (name) ->
    describe "#{name}", ->
      example = getExample name

      it "should valididate against schema", ->
        results = tv4.validateMultiple example, schema.id
        chai.expect(results.errors).to.eql []


