'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var chai, fbpClient, mochacompat, protocol, runAllComponentTests, runner, runtimeDefinition, setupAndConnect, testPath, testsuite;

chai = require('chai');

fbpClient = require('fbp-client');

mochacompat = require('../src/mochacompat');

protocol = require('../src/protocol');

testsuite = require('../src/testsuite');

runner = require('../src/runner');

testPath = function testPath(name) {
  var path, test;
  path = require('path');
  test = path.join(__dirname, 'fixtures/mochacases', name);
  return test;
};

runtimeDefinition = function runtimeDefinition(options) {
  var def;
  def = {
    protocol: 'websocket',
    address: 'ws://localhost:' + options.port
  };
  return def;
};

setupAndConnect = function setupAndConnect(options, callback) {
  mochacompat.setup(options, function (err, state, httpServer) {
    var client, def;
    if (err) {
      return callback(err);
    }
    def = runtimeDefinition(options);
    client = null;
    fbpClient(def).then(function (c) {
      client = c;
      return client.connect();
    }).then(function () {
      return callback(null, client, def, state, httpServer);
    }, callback);
  });
};

runAllComponentTests = function runAllComponentTests(ru, callback) {
  var onUpdate, state;
  state = null;
  onUpdate = function onUpdate(s) {
    return state = s;
  };
  return ru.connect(function (err) {
    if (err) {
      return callback(err);
    }
    return runner.getComponentSuites(ru, function (err, suites) {
      if (err) {
        return callback(err);
      }
      return runner.runAll(ru, suites, onUpdate, function (err) {
        return callback(err, state);
      });
    });
  });
};

describe('Mocha compatibility runner', function () {
  var definition, httpServer, ru;
  httpServer = null;
  definition = null;
  ru = null;
  afterEach(function (done) {
    if (httpServer) {
      httpServer.close();
      httpServer = null;
    }
    if (ru) {
      return ru.disconnect(function (err) {
        ru = null;
        return done(err);
      });
    } else {
      return done();
    }
  });
  it('should implement the FBP runtime protocol', function (done) {
    var options;
    options = {
      files: [testPath('bdd-nested-passing.coffee')]
    };
    return setupAndConnect(options, function (err, client, def, state, server) {
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
  it('has the required FBP runtime capabilities', function () {
    var c;
    c = definition.capabilities;
    chai.expect(c).to.include('protocol:graph');
    chai.expect(c).to.include('protocol:component');
    chai.expect(c).to.include('protocol:network');
    return chai.expect(c).to.include('component:getsource');
  });
  describe("loading test file with nested describe()", function () {
    return it('should list each it() as separate fbp-spec testcase', function (done) {
      var options;
      options = {
        files: [testPath('bdd-nested-passing.coffee')]
      };
      return setupAndConnect(options, function (err, client, def, state, server) {
        httpServer = server;
        if (err) {
          return done(err);
        }
        return protocol.getComponentTests(client, function (err, suites) {
          var caseA, caseB, suiteNames, t, tests;
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

          var _tests$0$cases = _slicedToArray(tests[0].cases, 2);

          caseA = _tests$0$cases[0];
          caseB = _tests$0$cases[1];

          chai.expect(caseA.name).to.include('sub topic');
          chai.expect(caseB.name).to.include('sub sub topic');
          return done();
        });
      });
    });
  });
  describe('running a passing test', function () {
    return it('should recorded 1 passed test', function (done) {
      var options;
      options = {
        files: [testPath('bdd-simple-passing.coffee')]
      };
      return mochacompat.setup(options, function (err, state, server) {
        httpServer = server;
        ru = new runner.Runner(runtimeDefinition(options));
        return runAllComponentTests(ru, function (err, state) {
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
  describe('running a failing test', function () {
    var testcase;
    testcase = null;
    it('should recorded 1 failed test', function (done) {
      var options;
      options = {
        files: [testPath('bdd-simple-failing.coffee')]
      };
      return mochacompat.setup(options, function (err, state, server) {
        httpServer = server;
        ru = new runner.Runner(runtimeDefinition(options));
        return runAllComponentTests(ru, function (err, state) {
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
    return it('has error message of the Chai assertion', function () {
      return chai.expect(testcase != null ? testcase.error : void 0).to.contain('expected 42 to equal 41');
    });
  });
  return describe('suite with some skipped tests', function () {
    it('skipped tests should be marked as such');
    return it('non-skipped tests should be ran');
  });
});