var chai, examples, fbpspec, isBrowser, runtimeInfo, setupAndRun, startRuntime, stopRuntime, yaml;

isBrowser = function() {
  return !((typeof process !== "undefined" && process !== null) && process.execPath && process.execPath.match(/node|iojs/));
};

fbpspec = isBrowser() ? require('fbp-spec/src/index') : require('..');

if (!chai) {
  chai = require('chai');
}

yaml = require('js-yaml');

if (isBrowser()) {
  examples = window.fbpspec_examples;
  runtimeInfo = {
    protocol: 'iframe',
    address: "fixtures/everything.html?fbp_noload=true&fbp_protocol=iframe"
  };
} else {
  examples = require('../examples/bundle.json');
  runtimeInfo = {
    protocol: 'websocket',
    address: "ws://localhost:3335",
    command: "python2 protocol-examples/python/runtime.py --port 3335"
  };
}

startRuntime = function(client, info, callback) {
  var parent, runtime;
  runtime = null;
  if (info.command) {
    runtime = fbpspec.subprocess.start(info.command, {}, callback);
  } else if (info.protocol === 'iframe') {
    parent = document.getElementById('fixtures');
    client.setParentElement(parent);
    callback(null);
  } else {
    callback(null);
  }
  return runtime;
};

stopRuntime = function(runtime) {
  if (runtime) {
    return runtime.kill();
  }
};

setupAndRun = function(runner, suite, testcase, callback) {
  return runner.setupSuite(suite, function(err) {
    if (err) {
      return callback(err);
    }
    return fbpspec.runner.runTestAndCheck(runner, testcase, function(err, r) {
      var results;
      results = r;
      return runner.teardownSuite(suite, function(e) {
        return callback(err, results);
      });
    });
  });
};

describe('Examples', function() {
  var runner, runtime;
  runner = null;
  runtime = null;
  before(function(done) {
    this.timeout(6000);
    runner = new fbpspec.runner.Runner(runtimeInfo);
    return runtime = startRuntime(runner.client, runtimeInfo, function(err) {
      if (err) {
        return done(err);
      }
      return runner.connect(done);
    });
  });
  after(function(done) {
    stopRuntime(runtime);
    return runner.disconnect(done);
  });
  return Object.keys(examples).forEach(function(name) {
    var example;
    example = null;
    return describe("" + name, function() {
      var e, error, error1;
      error = null;
      try {
        example = examples[name];
      } catch (error1) {
        e = error1;
        error = e;
      }
      it('should load without error', function() {
        chai.expect(error).to.not.exist;
        return chai.expect(example).to.exist;
      });
      it("should valididate against schema", function() {
        var results;
        results = fbpspec.testsuite.validate(example);
        chai.expect(results.errors).to.eql([]);
        chai.expect(results.missing).to.eql([]);
        return chai.expect(results.valid).to.equal(true);
      });
      return describe('testcases', function() {
        var suites;
        if (!example) {
          example = [];
        }
        suites = Array.isArray(example) ? example.slice(0) : [example];
        return suites.forEach(function(suite) {
          return suite.cases.forEach(function(testcase) {
            return describe("" + testcase.name, function() {
              var itOrSkip;
              itOrSkip = testcase.skip ? it.skip : it;
              if (testcase.assertion === 'should pass') {
                return itOrSkip("should pass", function(done) {
                  this.timeout(10000);
                  return setupAndRun(runner, suite, testcase, function(err, results) {
                    chai.expect(err).to.not.exist;
                    chai.expect(results.error).to.not.exist;
                    chai.expect(results.passed).to.be["true"];
                    return done();
                  });
                });
              } else if (testcase.assertion === 'should fail') {
                return itOrSkip("should fail", function(done) {
                  this.timeout(10000);
                  return setupAndRun(runner, suite, testcase, function(err, results) {
                    chai.expect(err).to.not.exist;
                    chai.expect(results.error, 'missing error').to.exist;
                    chai.expect(results.error.message).to.contain('expect');
                    chai.expect(results.passed).to.be["false"];
                    return done();
                  });
                });
              }
            });
          });
        });
      });
    });
  });
});
