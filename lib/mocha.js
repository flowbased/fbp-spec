/* eslint-env node, mocha */
// # Run fbp-spec testcases using Mocha as a runner/frontend
// # Intended to allow reuse of Mocha reporters, or
// # to quickly add a couple of fbp-spec cases to a predominantly Mocha-based testsuite
// # See also ./mochacompat.coffee

const debug = require('debug')('fbp-spec:mocha');

const runnerModule = require('./runner');

const {
  Runner,
} = runnerModule;
const testsuite = require('./testsuite');
const expectation = require('./expectation');
const subprocess = require('./subprocess');

function runSuite(runner, suite) {
  const suiteDescribe = suite.skip ? describe.skip : describe;
  suiteDescribe(`${suite.name}`, () => {
    beforeEach(function (done) {
      if (suite.timeout != null) {
        this.timeout(suite.timeout);
      }
      runner.setupSuite(suite, done);
    });
    afterEach((done) => runner.teardownSuite(suite, done));

    suite.cases.forEach((testcase) => {
      const caseDescribe = testcase.skip ? describe.skip : describe;
      caseDescribe(testcase.name, () => it(testcase.assertion, function (done) {
        if (suite.timeout != null) {
          this.timeout(suite.timeout);
        }
        if (testcase.timeout != null) {
          this.timeout(testcase.timeout);
        }

        runnerModule.runTestAndCheck(runner, testcase, (err, result) => {
          if (err) {
            done(err);
            return;
          }
          done(result.error);
        });
      }));
    });
  });
}

// # run()
// Must be be ran using Mocha,
// it is responsible for setting up the "describe", and "it" functions
exports.run = function run(rt, tests, options) {
  // default pretty high to give time for runtime to start
  let suites;
  const opts = options;
  if ((options.starttimeout == null)) { opts.starttimeout = 5000; }
  if ((options.fixturetimeout == null)) { opts.fixturetimeout = 2000; }

  const runnerOptions = {
    connectTimeout: options.starttimeout,
    commandTimeout: options.commandtimeout,
  };
  const runner = new Runner(rt, runnerOptions);
  try {
    suites = testsuite.getSuitesSync(tests);
  } catch (e) {
    console.log('Unable to get suites:', e);
    throw e;
  }
  let process = null;

  const start = function (callback) {
    if (!rt.command) {
      callback(null);
      return;
    }
    const subprocessOptions = {};
    process = subprocess.start(rt.command, subprocessOptions, callback);
  };
  const stop = function (callback) {
    if (process) { process.kill(); }
    callback(null);
  };

  before(function (done) {
    this.timeout(options.starttimeout + 500);
    start((err) => {
      debug('started', err);
      expectation.noError(err);
      runner.connect(done);
    });
  });
  after((done) => {
    stop((err) => {
      debug('stopped', err);
      expectation.noError(err);
      runner.disconnect(done);
    });
  });

  suites.forEach((suite) => {
    if ((suite.timeout == null)) {
      const s = suite;
      s.timeout = options.fixturetimeout;
    }
    runSuite(runner, suite);
  });
};
