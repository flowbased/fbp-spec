const chai = require('chai');
const fbpClient = require('fbp-client');
const mochacompat = require('../lib/mochacompat');
const protocol = require('../lib/protocol');
const testsuite = require('../lib/testsuite');
const runner = require('../lib/runner');

const testPath = function (name) {
  // eslint-disable-next-line global-require
  const path = require('path');
  const test = path.join(__dirname, 'fixtures/mochacases', name);
  return test;
};

const runtimeDefinition = function (options) {
  const def = {
    protocol: 'websocket',
    address: `ws://localhost:${options.port}`,
  };
  return def;
};

const setupAndConnect = function (options, callback) {
  mochacompat.setup(options, (err, state, httpServer) => {
    if (err) {
      callback(err);
      return;
    }
    const def = runtimeDefinition(options);
    let client = null;
    fbpClient(def)
      .then((c) => {
        client = c;
        return client.connect();
      })
      .then((() => callback(null, client, def, state, httpServer)), callback);
  });
};

const runAllComponentTests = function (ru, callback) {
  let state = null;
  const onUpdate = (s) => {
    state = s;
  };
  ru.connect((err) => {
    if (err) {
      callback(err);
      return;
    }
    runner.getComponentSuites(ru, (suiteErr, suites) => {
      if (suiteErr) {
        callback(suiteErr);
        return;
      }
      runner.runAll(ru, suites, onUpdate, (runErr) => callback(runErr, state));
    });
  });
};

describe('Mocha compatibility runner', () => {
  let httpServer = null;
  let definition = null;
  let ru = null;

  afterEach((done) => {
    if (httpServer) {
      httpServer.close();
      httpServer = null;
    }
    if (ru) {
      ru.disconnect((err) => {
        ru = null;
        done(err);
      });
      return;
    }
    done();
  });

  it('should implement the FBP runtime protocol', (done) => {
    const options = { files: [testPath('bdd-nested-passing.js')] };
    setupAndConnect(options, (err, client, def, state, server) => {
      httpServer = server;
      definition = def;
      if (err) {
        done(err);
        return;
      }
      chai.expect(def).to.include.keys(['protocol', 'type', 'version', 'capabilities']);
      chai.expect(def.protocol).to.equal('websocket');
      chai.expect(def.type).to.equal('fbp-spec-mocha');
      chai.expect(def.version).to.equal('0.5');
      done();
    });
  });
  it('has the required FBP runtime capabilities', () => {
    const c = definition.capabilities;
    chai.expect(c).to.include('protocol:graph');
    chai.expect(c).to.include('protocol:component');
    chai.expect(c).to.include('protocol:network');
    chai.expect(c).to.include('component:getsource');
  });

  describe('loading test file with nested describe()', () => it('should list each it() as separate fbp-spec testcase', (done) => {
    const options = { files: [testPath('bdd-nested-passing.js')] };
    setupAndConnect(options, (err, client, def, state, server) => {
      httpServer = server;
      if (err) {
        done(err);
        return;
      }
      protocol.getComponentTests(client, (componentTestsErr, suites) => {
        if (componentTestsErr) {
          done(componentTestsErr);
          return;
        }
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
        done();
      });
    });
  }));

  describe('running a passing test', () => it('should recorded 1 passed test', (done) => {
    const options = { files: [testPath('bdd-simple-passing.js')] };
    mochacompat.setup(options, (err, state, server) => {
      httpServer = server;

      ru = new runner.Runner(runtimeDefinition(options));
      runAllComponentTests(ru, (runErr, updatedState) => {
        if (runErr) {
          done(runErr);
          return;
        }
        chai.expect(updatedState).to.have.length(1);
        const {
          cases,
        } = updatedState[0];
        chai.expect(cases).to.have.length(1);
        chai.expect(cases[0].passed, 'testcase did not pass').to.equal(true);
        done();
      });
    });
  }));

  describe('running a failing test', () => {
    let testcase = null;
    it('should recorded 1 failed test', (done) => {
      const options = { files: [testPath('bdd-simple-failing.js')] };
      mochacompat.setup(options, (err, state, server) => {
        httpServer = server;
        ru = new runner.Runner(runtimeDefinition(options));
        runAllComponentTests(ru, (runErr, updatedState) => {
          if (runErr) {
            done(runErr);
            return;
          }
          chai.expect(updatedState).to.have.length(1);
          const {
            cases,
          } = updatedState[0];
          chai.expect(cases).to.have.length(1);
          [testcase] = cases;
          chai.expect(testcase.passed, 'failing testcase passed').to.equal(false);
          done();
        });
      });
    });
    it('has error message of the Chai assertion', () => {
      chai.expect(testcase != null ? testcase.error : undefined).to.contain('expected 42 to equal 41');
    });
  });

  describe('suite with some skipped tests', () => {
    it('skipped tests should be marked as such');
    it('non-skipped tests should be ran');
  });
});
