/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

let getSuitesSync, jsyaml, loadYAML, validate;
if ((typeof window !== 'undefined' && window !== null ? window.jsyaml : undefined) != null) { ({
  jsyaml
} = window); }
if (!jsyaml) { jsyaml = require('js-yaml'); }

const common = require('./common');
const schemas = require('../schema');

exports.validate = (validate = function(obj) {
  let tv4 = typeof window !== 'undefined' && window !== null ? window.tv4 : undefined;
  if (!tv4) { tv4 = require('tv4'); }

  tv4.reset();
  for (let name in schemas) {
    const schema = schemas[name];
    tv4.addSchema(schema.id, schema);
  }

  const results = tv4.validateMultiple(obj, 'testsfile.json');
  if (results.missing.length) { results.passed = false; }
  return results;
});

const normalize = function(suite) {
  // Default name to topic
  if (!suite.name) { suite.name = suite.topic; }
  if (!suite.cases) { suite.cases = []; }

  return suite;
};

exports.create = base => normalize(base);

exports.loadYAML = (loadYAML = function(data) {
  const suites = [];
  const suite = jsyaml.safeLoadAll(data, doc => suites.push(normalize(doc)));
  return suites;
});

const loadHTTP = function(url, callback) {
  if (common.isBrowser()) {
    const req = new XMLHttpRequest();
    req.addEventListener('load', function() {
      const suites = loadYAML(this.responseText);
      return callback(null, suites);
    });
    req.addEventListener('error', function() {
      return callback(new Error(`Failed to load ${url}: ${this.statusText}`));
    });
    req.open("get", url, true);
    return req.send();
    
  } else {
    throw new Error('fbpspec.testsuite: Loading over HTTP not supported on node.js');
  }
};

const getFileSync = function(test, callback) {
  const fs = require('fs');
  const path = require('path');

  const stat = fs.statSync(test);
  if (stat.isDirectory()) {
    const files = ((() => {
      const result = [];
       for (let f of Array.from(fs.readdirSync(test))) {         if (f.indexOf('.yaml') !== -1) {
          result.push(path.join(test, f));
        }
      } 
      return result;
    })());
    return getSuitesSync(files);
  } else {
    const c = fs.readFileSync(test);
    return loadYAML(c);
  }
};

// FIXME: get rid of this...
exports.getSuitesSync = (getSuitesSync = function(tests) {
  if (!Array.isArray(tests)) { tests = [ tests ]; }

  let suites = [];
  for (let test of Array.from(tests)) {
    suites = suites.concat(getFileSync(test));
  }
  return suites;
});

exports.getSuites = function(tests, callback) {
  if (!Array.isArray(tests)) { tests = [ tests ]; }

  const loadTest = (test, cb) => {
    if (common.startsWith(test, 'http://' || common.startsWith('https://'))) {
      return loadHTTP(test, cb);
    } else {
      return cb(null, getFileSync(test));
    }
  };

  return common.asyncSeries(tests, loadTest, function(err, suitesList) {
    if (err) { return callback(err); }
    // flatten list
    const suites = [];
    for (let ss of Array.from(suitesList)) {
      for (let s of Array.from(ss)) {
        suites.push(s);
      }
    }
    return callback(null, suites);
  });
};
