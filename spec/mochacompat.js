var chai, connectClient, fbpClient, mochacompat, protocol, runAllComponentTests, runner, runtimeDefinition, setupAndConnect, testPath, testsuite;

chai = require('chai');

fbpClient = require('fbp-protocol-client');

mochacompat = require('../src/mochacompat');

protocol = require('../src/protocol');

testsuite = require('../src/testsuite');

runner = require('../src/runner');

testPath = function(name) {
  var path, test;
  path = require('path');
  test = path.join(__dirname, 'fixtures/mochacases', name);
  return test;
};

connectClient = function(client, callback) {
  var onStatus;
  onStatus = (function(_this) {
    return function(status) {
      if (!status.online) {
        return;
      }
      client.removeListener('status', onStatus);
      return protocol.getCapabilities(client, function(err, caps, def) {
        return callback(err, def);
      });
    };
  })(this);
  client.on('status', onStatus);
  return client.connect();
};

runtimeDefinition = function(options) {
  var def;
  def = {
    protocol: 'websocket',
    address: "ws://localhost:" + options.port
  };
  return def;
};

setupAndConnect = function(options, callback) {
  return mochacompat.setup(options, function(err, state, httpServer) {
    var Transport, client, def;
    if (err) {
      return callback(err);
    }
    def = runtimeDefinition(options);
    Transport = fbpClient.getTransport(def.protocol);
    client = new Transport(def);
    return connectClient(client, function(err, def) {
      return callback(err, client, def, state, httpServer);
    });
  });
};

runAllComponentTests = function(ru, callback) {
  var onUpdate, state;
  state = null;
  onUpdate = function(s) {
    return state = s;
  };
  return ru.connect(function(err) {
    if (err) {
      return done(err);
    }
    return runner.getComponentSuites(ru, function(err, suites) {
      if (err) {
        return done(err);
      }
      return runner.runAll(ru, suites, onUpdate, function(err) {
        return callback(err, state);
      });
    });
  });
};

describe('Mocha compatibility runner', function() {
  var definition, httpServer, ru;
  httpServer = null;
  definition = null;
  ru = null;
  afterEach(function(done) {
    if (httpServer) {
      httpServer.close();
      httpServer = null;
    }
    if (ru) {
      return ru.disconnect(function(err) {
        ru = null;
        return done(err);
      });
    } else {
      return done();
    }
  });
  it('should implement the FBP runtime protocol', function(done) {
    var options;
    options = {
      files: [testPath('bdd-nested-passing.coffee')]
    };
    return setupAndConnect(options, function(err, client, def, state, server) {
      httpServer = server;
      definition = def;
      if (err) {
        return done(err);
      }
      chai.expect(def).to.include.keys(['protocol', 'type', 'version', 'capabilities']);
      chai.expect(def.protocol).to.equal('websocket');
      chai.expect(def.type).to.equal('fbp-spec-mocha');
      chai.expect(def.version).to.equal('0.5');
      return done();
    });
  });
  it('has the required FBP runtime capabilities', function() {
    var c;
    c = definition.capabilities;
    chai.expect(c).to.include('protocol:graph');
    chai.expect(c).to.include('protocol:component');
    chai.expect(c).to.include('protocol:network');
    return chai.expect(c).to.include('component:getsource');
  });
  describe("loading test file with nested describe()", function() {
    return it('should list each it() as separate fbp-spec testcase', function(done) {
      var options;
      options = {
        files: [testPath('bdd-nested-passing.coffee')]
      };
      return setupAndConnect(options, function(err, client, def, state, server) {
        httpServer = server;
        if (err) {
          return done(err);
        }
        return protocol.getComponentTests(client, function(err, suites) {
          var caseA, caseB, ref, suiteNames, t, tests;
          if (err) {
            return done(err);
          }
          chai.expect(suites).to.be.a('object');
          suiteNames = Object.keys(suites);
          chai.expect(suiteNames).to.have.length(1);
          t = suites[suiteNames[0]];
          tests = testsuite.loadYAML(t);
          chai.expect(tests).to.have.length(1);
          chai.expect(tests[0]).to.include.keys(['name', 'fixture', 'cases']);
          chai.expect(tests[0].cases).to.have.length(2);
          ref = tests[0].cases, caseA = ref[0], caseB = ref[1];
          chai.expect(caseA.name).to.include('sub topic');
          chai.expect(caseB.name).to.include('sub sub topic');
          return done();
        });
      });
    });
  });
  describe('running a passing test', function() {
    return it('should recorded 1 passed test', function(done) {
      var options;
      options = {
        files: [testPath('bdd-simple-passing.coffee')]
      };
      return mochacompat.setup(options, function(err, state, server) {
        httpServer = server;
        ru = new runner.Runner(runtimeDefinition(options));
        return runAllComponentTests(ru, function(err, state) {
          var cases;
          if (err) {
            return done(err);
          }
          chai.expect(state).to.have.length(1);
          cases = state[0].cases;
          chai.expect(cases).to.have.length(1);
          chai.expect(cases[0].passed, 'testcase did not pass').to.equal(true);
          return done();
        });
      });
    });
  });
  describe('running a failing test', function() {
    var testcase;
    testcase = null;
    it('should recorded 1 failed test', function(done) {
      var options;
      options = {
        files: [testPath('bdd-simple-failing.coffee')]
      };
      return mochacompat.setup(options, function(err, state, server) {
        httpServer = server;
        ru = new runner.Runner(runtimeDefinition(options));
        return runAllComponentTests(ru, function(err, state) {
          var cases;
          if (err) {
            return done(err);
          }
          chai.expect(state).to.have.length(1);
          cases = state[0].cases;
          chai.expect(cases).to.have.length(1);
          testcase = cases[0];
          chai.expect(testcase.passed, 'failing testcase passed').to.equal(false);
          return done();
        });
      });
    });
    return it('has error message of the Chai assertion', function() {
      return chai.expect(testcase != null ? testcase.error : void 0).to.contain('expected 42 to equal 41');
    });
  });
  return describe('suite with some skipped tests', function() {
    it('skipped tests should be marked as such');
    return it('non-skipped tests should be ran');
  });
});
