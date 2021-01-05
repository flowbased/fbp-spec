const yaml = require('js-yaml');

const path = require('path');

const examplesDir = path.join(__dirname);

const listExamples = function () {
  // eslint-disable-next-line global-require
  const files = require('fs').readdirSync(examplesDir);
  const result = [];
  files.forEach((f) => {
    if (f.indexOf('.yaml') !== -1) {
      result.push(f);
    }
  });
  return result;
};
const getExample = function (name) {
  const p = path.join(examplesDir, name);
  // eslint-disable-next-line global-require
  const content = require('fs').readFileSync(p, { encoding: 'utf-8' });
  const results = [];
  yaml.loadAll(content, (doc) => results.push(doc));
  if (results.length === 1) {
    return results[0];
  }
  return results;
};

const buildExampleBundle = function () {
  const examples = {};
  listExamples().forEach((name) => {
    examples[name] = getExample(name);
  });
  const contents = JSON.stringify(examples, null, 2);

  let dest = `${examplesDir}/bundle.js`;
  // eslint-disable-next-line global-require
  require('fs').writeFileSync(dest, `window.fbpspec_examples = ${contents};`);
  console.log(`wrote ${dest}`);

  dest = `${examplesDir}/bundle.json`;
  // eslint-disable-next-line global-require
  require('fs').writeFileSync(dest, contents);
  return console.log(`wrote ${dest}`);
};

exports.bundle = buildExampleBundle;
