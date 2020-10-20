/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const chai = require('chai');
const fbpClient = require('fbp-client');
const mochacompat = require('../lib/mochacompat');
const protocol = require('../lib/protocol');
const testsuite = require('../lib/testsuite');
const runner = require('../lib/runner');

const testPath = function(name) {
  const path = require('path');
  const test = path.join(__dirname, 'fixtures/mochacases', name);
  return test;
};

const runtimeDefinition = function(options) {
  const def = {
    protocol: 'websocket',
    address: `ws://localhost:${options.port}`
  };
  return def;
};

const setupAndConnect = function(options, callback) {
  mochacompat.setup(options, function(err, state, httpServer) {
    if (err) { return callback(err); }
    const def = runtimeDefinition(options);
    let client = null;
    fbpClient(def)
      .then(function(c) {
        client = c;
        return client.connect();
      })
      .then((() => callback(null, client, def, state, httpServer)), callback);
  });
};

const runAllComponentTests = function(ru, callback) {
  let state = null;
  const onUpdate = s => state = s;
  return ru.connect(function(err) {
    if (err) { return callback(err); }
    return runner.getComponentSuites(ru, function(err, suites) {
      if (err) { return callback(err); }
      return runner.runAll(ru, suites, onUpdate, err => callback(err, state));
    });
  });
};

describe('Mocha compatibility runner', function() {
  let httpServer = null;
  let definition = null;
  let ru = null;

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
    const options =
      {files: [ testPath('bdd-nested-passing.coffee') ]};
    return setupAndConnect(options, function(err, client, def, state, server) {
      httpServer = server;
      definition = def;
      if (err) { return done(err); }
      chai.expect(def).to.include.keys(['protocol', 'type', 'version', 'capabilities']);
      chai.expect(def.protocol).to.equal('websocket');
      chai.expect(def.type).to.equal('fbp-spec-mocha');
      chai.expect(def.version).to.equal('0.5');
      return done();
    });
  });
  it('has the required FBP runtime capabilities', function() {
    const c = definition.capabilities;
    chai.expect(c).to.include('protocol:graph');
    chai.expect(c).to.include('protocol:component');
    chai.expect(c).to.include('protocol:network');
    return chai.expect(c).to.include('component:getsource');
  });

  describe("loading test file with nested describe()", () => it('should list each it() as separate fbp-spec testcase', function(done) {
    const options =
      {files: [ testPath('bdd-nested-passing.coffee') ]};
    return setupAndConnect(options, function(err, client, def, state, server) {
      httpServer = server;
      if (err) { return done(err); }
      return protocol.getComponentTests(client, function(err, suites) {
        if (err) { return done(err); }
        chai.expect(suites).to.be.a('object');
        const suiteNames = Object.keys(suites);
        chai.expect(suiteNames).to.have.length(1);
        const t = suites[suiteNames[0]];
        const tests = testsuite.loadYAML(t);
        chai.expect(tests).to.have.length(1);
        chai.expect(tests[0]).to.include.keys(['name', 'fixture', 'cases']);
        chai.expect(tests[0].cases).to.have.length(2);
        const [caseA, caseB] = Array.from(tests[0].cases);
        chai.expect(caseA.name).to.include('sub topic');
        chai.expect(caseB.name).to.include('sub sub topic');
        return done();
      });
    });
  }));

  describe('running a passing test', () => it('should recorded 1 passed test', function(done) {
    const options =
      {files: [ testPath('bdd-simple-passing.coffee') ]};
    return mochacompat.setup(options, function(err, state, server) {
      httpServer = server;

      ru = new runner.Runner(runtimeDefinition(options));
      return runAllComponentTests(ru, function(err, state) {
        if (err) { return done(err); }
        chai.expect(state).to.have.length(1);
        const {
          cases
        } = state[0];
        chai.expect(cases).to.have.length(1);
        chai.expect(cases[0].passed, 'testcase did not pass').to.equal(true);
        return done();
      });
    });
  }));

  describe('running a failing test', function() {
    let testcase = null;
    it('should recorded 1 failed test', function(done) {
      const options =
        {files: [ testPath('bdd-simple-failing.coffee') ]};
      return mochacompat.setup(options, function(err, state, server) {
        httpServer = server;
        ru = new runner.Runner(runtimeDefinition(options));
        return runAllComponentTests(ru, function(err, state) {
          if (err) { return done(err); }
          chai.expect(state).to.have.length(1);
          const {
            cases
          } = state[0];
          chai.expect(cases).to.have.length(1);
          testcase = cases[0];
          chai.expect(testcase.passed, 'failing testcase passed').to.equal(false);
          return done();
        });
      });
    });
    return it('has error message of the Chai assertion', () => chai.expect(testcase != null ? testcase.error : undefined).to.contain('expected 42 to equal 41'));
  });

  return describe('suite with some skipped tests', function() {
    it('skipped tests should be marked as such');
    return it('non-skipped tests should be ran');
  });
});
