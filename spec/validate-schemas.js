const tv4 = require('tv4');
const chai = require('chai');
const path = require('path');
const fs = require('fs');

const schemaPath = '../schema';

function loadSchema(filepath) {
  const content = fs.readFileSync(filepath, { encoding: 'utf-8' });
  return JSON.parse(content);
}
function getSchema(name) {
  const filepath = path.join(__dirname, schemaPath, name);
  return loadSchema(filepath);
}

describe('Schema meta validation', () => {
  let schemas = fs.readdirSync(path.join(__dirname, schemaPath));
  schemas = schemas.filter((s) => s.indexOf('.json') !== -1);

  before(() => {
    const metaSchema = loadSchema(path.join(__dirname, 'json-schema.json'));
    tv4.addSchema('http://json-schema.org/draft-04/schema', metaSchema);
  });
  after(() => {
    tv4.reset();
  });
  schemas.forEach((schemaFile) => {
    const schema = getSchema(schemaFile);
    tv4.addSchema(schema.id, schema);
    describe(`${schemaFile} (${schema.title || schema.description})`, () => {
      it('should validate against JSON meta schema', () => {
        const result = tv4.validateResult(schema, 'http://json-schema.org/draft-04/schema');
        chai.expect(result.valid).to.equal(true);
      });
    });
  });
});
