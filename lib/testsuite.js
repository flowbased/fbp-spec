/* eslint-env browser, node */
const fetch = require('isomorphic-fetch');
const path = require('path');
const common = require('./common');
// eslint-disable-next-line import/no-unresolved
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

exports.loadYAML = function loadYAML(data, callback) {
  const suites = [];
  try {
    // eslint-disable-next-line global-require
    const yaml = (typeof window !== 'undefined' && window.jsyaml) ? window.jsyaml : require('js-yaml');
    yaml.safeLoadAll(data, (doc) => suites.push(normalize(doc)));
  } catch (e) {
    callback(e);
    return;
  }
  callback(null, suites);
};

exports.loadYAMLSync = function loadYAMLSync(data) {
  // eslint-disable-next-line global-require
  const yaml = (typeof window !== 'undefined' && window.jsyaml) ? window.jsyaml : require('js-yaml');
  const suites = [];
  yaml.safeLoadAll(data, (doc) => suites.push(normalize(doc)));
  return suites;
};

function loadHTTP(url, callback) {
  fetch(url)
    .then((res) => res.text())
    .then((source) => new Promise((resolve, reject) => {
      exports.loadYAML(source, (err, suites) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(suites);
      });
    }))
    .then((suites) => {
      callback(null, suites);
    }, callback);
}

function getFileSync(test) {
  // eslint-disable-next-line global-require
  const fs = require('fs');

  const stat = fs.statSync(test);
  if (stat.isDirectory()) {
    const files = fs.readdirSync(test);
    const filePaths = files
      .filter((f) => path.extname(f) === '.yaml')
      .map((f) => path.join(test, f));
    return exports.getSuitesSync(filePaths);
  }
  const c = fs.readFileSync(test, 'utf-8');
  return exports.loadYAMLSync(c);
}

function getFile(test, callback) {
  // eslint-disable-next-line global-require
  const fs = require('fs');

  fs.stat(test, (statErr, stat) => {
    if (statErr) {
      callback(statErr);
      return;
    }
    if (stat.isDirectory()) {
      fs.readdir(test, (dirErr, files) => {
        if (dirErr) {
          callback(dirErr);
          return;
        }
        const filePaths = files
          .filter((f) => path.extname(f) === '.yaml')
          .map((f) => path.join(test, f));
        exports.getSuites(filePaths, callback);
      });
      return;
    }
    fs.readFile(test, 'utf-8', (readErr, yaml) => {
      if (readErr) {
        callback(readErr);
        return;
      }
      exports.loadYAML(yaml, callback);
    });
  });
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
    getFile(test, cb);
  };

  common.asyncSeries(tests, loadTest, (err, suitesList) => {
    if (err) {
      callback(err);
      return;
    }
    // flatten list
    const suites = suitesList.reduce((a, b) => a.concat(b), []);
    callback(null, suites);
  });
};
