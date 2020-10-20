/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const yaml = require('js-yaml');

const examplesDir = require('path').join(__dirname);
const listExamples = function() {
  let files = require('fs').readdirSync(examplesDir);
  files = ((() => {
    const result = [];
    for (let f of Array.from(files)) {       if (f.indexOf('.yaml')!==-1) {
        result.push(f);
      }
    }
    return result;
  })());
  return files;
};
const getExample = function(name) {
  const p = require('path').join(examplesDir, name);
  const content = require('fs').readFileSync(p, {encoding:'utf-8'});
  let results = [];
  yaml.safeLoadAll(content, doc => results.push(doc));
  if (results.length === 1) { results = results[0]; }
  return results;
};

const buildExampleBundle = function() {
  const examples = {};
  for (let name of Array.from(listExamples())) {
    examples[name] = getExample(name);
  }
  const contents = JSON.stringify(examples, null, 2);

  let dest = examplesDir+"/bundle.js";
  require('fs').writeFileSync(dest, `window.fbpspec_examples = ${contents};`);
  console.log(`wrote ${dest}`);

  dest = examplesDir+"/bundle.json";
  require('fs').writeFileSync(dest, contents);
  return console.log(`wrote ${dest}`);
};



exports.bundle = buildExampleBundle;
