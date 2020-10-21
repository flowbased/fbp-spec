const isBrowser = () => !((typeof process !== 'undefined' && process !== null) && process.execPath && process.execPath.match(/node|iojs/));

const chai = require('chai');

// eslint-disable-next-line import/no-unresolved
const fbpspec = isBrowser() ? require('fbp-spec') : require('..');

let examples;
let runtimeInfo;
if (isBrowser()) {
  examples = window.fbpspec_examples;
  runtimeInfo = {
    protocol: 'iframe',
    address: '/base/browser/spec/fixtures/everything.html?fbp_noload=true&fbp_protocol=iframe',
  };
} else {
  // eslint-disable-next-line global-require,import/no-unresolved
  examples = require('../examples/bundle.json');
  runtimeInfo = {
    protocol: 'websocket',
    address: 'ws://localhost:3335',
    command: 'python2 protocol-examples/python/runtime.py --port 3335',
  };
}

const startRuntime = function (runner, info, callback) {
  let runtime = null;
  if (info.command) {
    runtime = fbpspec.subprocess.start(info.command, {}, callback);
  } else if (info.protocol === 'iframe') {
    const parent = document.createElement('div');
    document.body.appendChild(parent);
    const r = runner;
    r.parentElement = parent;
    callback(null);
  } else {
    callback(null);
  }

  return runtime;
};

const stopRuntime = function (runtime) {
  if (runtime) {
    runtime.kill();
  }
};

const setupAndRun = (runner, suite, testcase, callback) => {
  runner.setupSuite(suite, (err) => {
    if (err) {
      callback(err);
      return;
    }
    fbpspec.runner.runTestAndCheck(runner, testcase, (runErr, r) => {
      if (runErr) {
        callback(runErr);
        return;
      }
      const results = r;
      runner.teardownSuite(suite, (e) => callback(e, results));
    });
  });
};

describe('Examples', () => {
  let runner = null;
  let runtime = null;
  before(function (done) {
    this.timeout(6000);
    runner = new fbpspec.runner.Runner(runtimeInfo);
    runtime = startRuntime(runner, runtimeInfo, (err) => {
      if (err) {
        done(err);
        return;
      }
      runner.connect(done);
    });
  });
  after((done) => {
    stopRuntime(runtime);
    runner.disconnect(done);
  });

  Object.keys(examples).forEach((name) => {
    let example = null;
    describe(`${name}`, () => {
      before((done) => {
        try {
          example = examples[name];
          done();
        } catch (e) {
          done(e);
        }
      });

      it('should validate against schema', function () {
        if (isBrowser()) {
          this.skip();
          return;
        }
        const results = fbpspec.testsuite.validate(example);
        chai.expect(results.errors).to.eql([]);
        chai.expect(results.missing).to.eql([]);
        chai.expect(results.valid).to.equal(true);
      });

      describe('testcases', () => {
        if (!example) { example = []; }
        const suites = Array.isArray(example) ? example.slice(0) : [example];
        suites.forEach((suite) => suite.cases.forEach((testcase) => describe(`${testcase.name}`, () => {
          let itOrSkip = testcase.skip ? it.skip : it;
          if (isBrowser() && (suite.topic === 'DummyComponent')) {
            // These tests only work with the Python runtime
            itOrSkip = it.skip;
          }

          if (testcase.assertion === 'should pass') {
            itOrSkip('should pass', function (done) {
              this.timeout(10000);
              setupAndRun(runner, suite, testcase, (err, results) => {
                if (err) {
                  done(err);
                  return;
                }
                chai.expect(results.error).to.be.a('null');
                chai.expect(results.passed).to.equal(true);
                done();
              });
            });
          } if (testcase.assertion === 'should fail') {
            itOrSkip('should fail', function (done) {
              this.timeout(10000);
              setupAndRun(runner, suite, testcase, (err, results) => {
                if (err) {
                  done(err);
                  return;
                }
                chai.expect(results.error, 'missing error').be.an('error');
                chai.expect(results.error.message).to.contain('expect');
                chai.expect(results.passed).equal(false);
                done();
              });
            });
          }
        })));
      });
    });
  });
});
