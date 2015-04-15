tv4 = require 'tv4'
chai = require 'chai' if not chai
path = require 'path'
fs = require 'fs'

schemaPath = '../schema'
getSchema = (name) ->
  filepath = path.join __dirname, schemaPath, name
  loadSchema filepath

loadSchema = (filepath) ->
  content = fs.readFileSync filepath, { encoding: 'utf-8' }
  return JSON.parse content

describe 'Schema meta validation', ->
  schemas = fs.readdirSync path.join __dirname, schemaPath
  before: ->
    metaSchema = loadSchema path.join __dirname, 'json-schema.json'
    tv4.addSchema 'http://json-schema.org/draft-04/schema', metaSchema
  after: ->
    tv4.reset()
  schemas.forEach (schemaFile) ->
    schema = getSchema schemaFile
    tv4.addSchema schema.id, schema
    describe "#{schemaFile} (#{schema.title or schema.description})", ->
      it 'should validate against JSON meta schema', ->
        result = tv4.validateResult schema, 'http://json-schema.org/draft-04/schema'
        chai.expect(result.valid).to.equal true
