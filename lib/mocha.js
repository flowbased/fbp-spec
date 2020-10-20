/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

//# Run fbp-spec testcases using Mocha as a runner/frontend
//# Intended to allow reuse of Mocha reporters, or
//# to quickly add a couple of fbp-spec cases to a predominantly Mocha-based testsuite
//# See also ./mochacompat.coffee

const runnerModule = require('./runner');
const {
  Runner
} = runnerModule;
const testsuite = require('./testsuite');
const expectation = require('./expectation');
const subprocess = require('./subprocess');


const debug = require('debug')('fbp-spec:mocha');

const runSuite = function(runner, suite) {

  const suiteDescribe = suite.skip ? describe.skip : describe;
  return suiteDescribe(`${suite.name}`, function() {
    beforeEach(function(done) {
      if (suite.timeout != null) { this.timeout(suite.timeout); }
      return runner.setupSuite(suite, done);
    });
    afterEach(done => runner.teardownSuite(suite, done));

    return suite.cases.forEach(function(testcase) {
      const caseDescribe = testcase.skip ? describe.skip : describe;
      return caseDescribe(testcase.name, () => it(testcase.assertion, function(done) {
        if (suite.timeout != null) { this.timeout(suite.timeout); }
        if (testcase.timeout != null) { this.timeout(testcase.timeout); }

        return runnerModule.runTestAndCheck(runner, testcase, function(err, result) {
          if (err) { return done(err); }
          return done(result.error);
        });
      }));
    });
  });
};

//# run()
// Must be be ran using Mocha,
// it is responsible for setting up the "describe", and "it" functions
exports.run = function(rt, tests, options) {
  // default pretty high to give time for runtime to start
  let suites;
  if ((options.starttimeout == null)) { options.starttimeout = 5000; }
  if ((options.fixturetimeout == null)) { options.fixturetimeout = 2000; }

  const runnerOptions = {
    connectTimeout: options.starttimeout,
    commandTimeout: options.commandtimeout
  };
  const runner = new Runner(rt, runnerOptions);
  try {
    suites = testsuite.getSuitesSync(tests);
  } catch (e) {
    console.log('Unable to get suites:', e);
    throw e;
  }
  let process = null;

  const start = function(callback) {
    if (!rt.command) { return callback(null); }
    const subprocessOptions = {};
    return process = subprocess.start(rt.command, subprocessOptions, callback);
  };
  const stop = function(callback) {
    if (process) { process.kill(); }
    return callback(null);
  };

  before(function(done) {
    this.timeout(options.starttimeout+500);
    start(function(err) {
      debug('started', err);
      expectation.noError(err);
      return runner.connect(done);
    });
    return null;
  });
  after(function(done) {
    stop(function(err) {
      debug('stopped', err);
      expectation.noError(err);
      return runner.disconnect(done);
    });
    return null;
  });

  return (() => {
    const result = [];
    for (let suite of Array.from(suites)) {
      if ((suite.timeout == null)) { suite.timeout = options.fixturetimeout; }
      result.push(runSuite(runner, suite));
    }
    return result;
  })();
};

