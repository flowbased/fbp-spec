/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

let chai, examples, runtimeInfo;
const isBrowser = () => !((typeof process !== 'undefined' && process !== null) && process.execPath && process.execPath.match(/node|iojs/));

const fbpspec = isBrowser() ? require('fbp-spec') : require('..');

if (!chai) { chai = require('chai'); }
const yaml = require('js-yaml');

if (isBrowser()) {
  examples = window.fbpspec_examples;
  runtimeInfo = {
    protocol: 'iframe',
    address: "/base/browser/spec/fixtures/everything.html?fbp_noload=true&fbp_protocol=iframe"
  };
} else {
  examples = require('../examples/bundle.json');
  runtimeInfo = {
    protocol: 'websocket',
    address: "ws://localhost:3335",
    command: "python2 protocol-examples/python/runtime.py --port 3335"
  };
}

const startRuntime = function(runner, info, callback) {
  let runtime = null;
  if (info.command) {
    runtime = fbpspec.subprocess.start(info.command, {}, callback);
  } else if (info.protocol === 'iframe') {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    runner.parentElement = parent;
    callback(null);
  } else {
    callback(null);
  }
  
  return runtime;
};

const stopRuntime = function(runtime) {
  if (runtime) { return runtime.kill(); }
};

const setupAndRun = (runner, suite, testcase, callback) => runner.setupSuite(suite, function(err) {
  if (err) { return callback(err); }

  return fbpspec.runner.runTestAndCheck(runner, testcase, function(err, r) {
    const results = r;

    return runner.teardownSuite(suite, e => callback(err, results));
  });
});


describe('Examples', function() {
  let runner = null;
  let runtime = null;
  before(function(done) {
    this.timeout(6000);
    runner = new fbpspec.runner.Runner(runtimeInfo);
    return runtime = startRuntime(runner, runtimeInfo, function(err) {
      if (err) { return done(err); }
      return runner.connect(done);
    });
  });
  after(function(done) {
    stopRuntime(runtime);
    return runner.disconnect(done);
  });

  return Object.keys(examples).forEach(function(name) {
    let example = null;
    return describe(`${name}`, function() {
      let error = null;
      try {
        example = examples[name];
      } catch (e) {
        error = e;
      }

      it('should load without error', function() {
        chai.expect(error).to.not.exist;
        return chai.expect(example).to.exist;
      });

      it("should valididate against schema", function() {
        if (isBrowser()) { return this.skip(); }
        const results = fbpspec.testsuite.validate(example);
        chai.expect(results.errors).to.eql([]);
        chai.expect(results.missing).to.eql([]);
        return chai.expect(results.valid).to.equal(true);
      });


      return describe('testcases', function() {

        if (!example) { example = []; }
        const suites = Array.isArray(example) ? example.slice(0) : [ example ];
        return suites.forEach(suite => suite.cases.forEach(testcase => describe(`${testcase.name}`, function() {

          let itOrSkip = testcase.skip ? it.skip : it;
          if (isBrowser() && (suite.topic === 'DummyComponent')) {
            // These tests only work with the Python runtime
            itOrSkip = it.skip;
          }

          if (testcase.assertion === 'should pass') {
            return itOrSkip("should pass", function(done) {
              this.timeout(10000);
              return setupAndRun(runner, suite, testcase, function(err, results) {
                if (err) { return done(err); }
                chai.expect(results.error).to.not.exist;
                chai.expect(results.passed).to.be.true;
                return done();
              });
            });
          } else if (testcase.assertion === 'should fail') {
            return itOrSkip("should fail", function(done) {
              this.timeout(10000);
              return setupAndRun(runner, suite, testcase, function(err, results) {
                if (err) { return done(err); }
                chai.expect(results.error, 'missing error').to.exist;
                chai.expect(results.error.message).to.contain('expect');
                chai.expect(results.passed).to.be.false;
                return done();
              });
            });
          }
        })));
      });
    });
  });
});
