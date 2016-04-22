var chai, fs, getSchema, loadSchema, path, schemaPath, tv4;

tv4 = require('tv4');

if (!chai) {
  chai = require('chai');
}

path = require('path');

fs = require('fs');

schemaPath = '../schema';

getSchema = function(name) {
  var filepath;
  filepath = path.join(__dirname, schemaPath, name);
  return loadSchema(filepath);
};

loadSchema = function(filepath) {
  var content;
  content = fs.readFileSync(filepath, {
    encoding: 'utf-8'
  });
  return JSON.parse(content);
};

describe('Schema meta validation', function() {
  var schemas;
  schemas = fs.readdirSync(path.join(__dirname, schemaPath));
  schemas = schemas.filter(function(s) {
    return s.indexOf('.json') !== -1;
  });
  ({
    before: function() {
      var metaSchema;
      metaSchema = loadSchema(path.join(__dirname, 'json-schema.json'));
      return tv4.addSchema('http://json-schema.org/draft-04/schema', metaSchema);
    },
    after: function() {
      return tv4.reset();
    }
  });
  return schemas.forEach(function(schemaFile) {
    var schema;
    schema = getSchema(schemaFile);
    tv4.addSchema(schema.id, schema);
    return describe(schemaFile + " (" + (schema.title || schema.description) + ")", function() {
      return it('should validate against JSON meta schema', function() {
        var result;
        result = tv4.validateResult(schema, 'http://json-schema.org/draft-04/schema');
        return chai.expect(result.valid).to.equal(true);
      });
    });
  });
});
