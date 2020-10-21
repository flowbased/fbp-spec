/* eslint-env browser, node */
const common = require('./common');
const schemas = require('../schema');

exports.validate = function validate(obj) {
  // eslint-disable-next-line global-require
  const tv4 = (typeof window !== 'undefined' && window.tv4) ? window.tv4 : require('tv4');
  if (!tv4) {
    throw new Error('TV4 not available, unable to validate');
  }

  tv4.reset();
  Object.keys(schemas).forEach((name) => {
    const schema = schemas[name];
    tv4.addSchema(schema.id, schema);
  });

  const results = tv4.validateMultiple(obj, 'testsfile.json');
  if (results.missing.length) {
    results.passed = false;
  }
  return results;
};

function normalize(suite) {
  // Default name to topic
  const s = suite;
  if (!suite.name) {
    s.name = suite.topic;
  }
  if (!suite.cases) {
    s.cases = [];
  }

  return suite;
}

exports.create = (base) => normalize(base);

exports.loadYAML = function loadYAML(data) {
  // eslint-disable-next-line global-require
  const yaml = (typeof window !== 'undefined' && window.jsyaml) ? window.jsyaml : require('js-yaml');
  const suites = [];
  yaml.safeLoadAll(data, (doc) => suites.push(normalize(doc)));
  return suites;
};

function loadHTTP(url, callback) {
  if (common.isBrowser()) {
    const req = new XMLHttpRequest();
    req.addEventListener('load', () => {
      const suites = exports.loadYAML(this.responseText);
      callback(null, suites);
    });
    req.addEventListener('error', () => {
      callback(new Error(`Failed to load ${url}: ${this.statusText}`));
    });
    req.open('get', url, true);
    req.send();
    return;
  }
  throw new Error('fbpspec.testsuite: Loading over HTTP not supported on node.js');
}

function getFileSync(test) {
  // eslint-disable-next-line global-require
  const fs = require('fs');

  const stat = fs.statSync(test);
  if (stat.isDirectory()) {
    const files = fs.readdirSync(test).filter((f) => (f.indexOf('.yaml') !== -1));
    return exports.getSuitesSync(files);
  }
  const c = fs.readFileSync(test, 'utf-8');
  return exports.loadYAML(c);
}

// FIXME: get rid of this...
exports.getSuitesSync = function getSuitesSync(tests) {
  if (!common.isArray(tests)) {
    return exports.getSuitesSync([tests]);
  }

  let suites = [];
  tests.forEach((test) => {
    suites = suites.concat(getFileSync(test));
  });
  return suites;
};

exports.getSuites = function getSuites(tests, callback) {
  if (!common.isArray(tests)) {
    exports.getSuites([tests], callback);
    return;
  }

  const loadTest = (test, cb) => {
    if (common.startsWith(test, 'http://' || common.startsWith('https://'))) {
      loadHTTP(test, cb);
      return;
    }
    // FIXME: Load files async
    cb(null, getFileSync(test));
  };

  common.asyncSeries(tests, loadTest, (err, suitesList) => {
    if (err) {
      callback(err);
      return;
    }
    // flatten list
    const suites = [];
    suitesList.forEach((ss) => {
      ss.forEach((s) => {
        suites.push(s);
      });
    });
    callback(null, suites);
  });
};
