/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let chai;
const tv4 = require('tv4');
if (!chai) { chai = require('chai'); }
const path = require('path');
const fs = require('fs');

const schemaPath = '../schema';
const getSchema = function(name) {
  const filepath = path.join(__dirname, schemaPath, name);
  return loadSchema(filepath);
};

var loadSchema = function(filepath) {
  const content = fs.readFileSync(filepath, { encoding: 'utf-8' });
  return JSON.parse(content);
};

describe('Schema meta validation', function() {
  let schemas = fs.readdirSync(path.join(__dirname, schemaPath));
  schemas = schemas.filter(s => s.indexOf('.json') !== -1);

  ({
    before() {
      const metaSchema = loadSchema(path.join(__dirname, 'json-schema.json'));
      return tv4.addSchema('http://json-schema.org/draft-04/schema', metaSchema);
    },
    after() {
      return tv4.reset();
    }
  });
  return schemas.forEach(function(schemaFile) {
    const schema = getSchema(schemaFile);
    tv4.addSchema(schema.id, schema);
    return describe(`${schemaFile} (${schema.title || schema.description})`, () => it('should validate against JSON meta schema', function() {
      const result = tv4.validateResult(schema, 'http://json-schema.org/draft-04/schema');
      return chai.expect(result.valid).to.equal(true);
    }));
  });
});
