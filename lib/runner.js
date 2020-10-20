/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS202: Simplify dynamic range loops
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const common = require('./common');
const protocol = require('./protocol');
const testsuite = require('./testsuite');
const expectation = require('./expectation');

const fbp = require('fbp');
const fbpClient = require('fbp-client');
const debug = require('debug')('fbp-spec:runner');
const Promise = require('bluebird');

const debugReceivedMessages = function(client) {
  const debugReceived = require('debug')('fbp-spec:runner:received');
  return client.on('signal', ({protocol, command, payload}) => debugReceived(protocol, command, payload));
};

const synthesizeTopicFixture = function(topic, components, callback) {
    let port, portName;
    debug('synthesizing fixture', topic);
    // export each of the ports for topic component
    // return a FBP graph?
    const component = components[topic];
    if (!component) { return callback(new Error(`Could not find component for topic: ${topic}`)); }

    const graph = {
      properties: {},
      inports: {},
      outports: {},
      processes: {},
      connections: []
    };

    const processName = 'testee';
    graph.processes[processName] =
      {component: topic};

    for (port of Array.from(component.inPorts)) {
      portName = port.id;
      graph.inports[portName] = {
        process: processName,
        port: portName
      };
    }
    for (port of Array.from(component.outPorts)) {
      portName = port.id;
      graph.outports[portName] = {
        process: processName,
        port: portName
      };
    }

    // Sanity checking if this is usable as a fixture
    if (Object.keys(graph.outports) < 1) {
      return callback(new Error(`Component '${topic}' used as fixture has no outports`));
    }
    if (Object.keys(graph.inports) < 1) {
      return callback(new Error(`Component '${topic}' used as fixture has no inports`));
    }

    return callback(null, graph);
  };
    

// @context should have .components = {} property
const getFixtureGraph = function(context, suite, callback) {
  // TODO: follow runtime for component changes

  const hasComponents = s => (s.components != null) && (typeof s.components === 'object') && Object.keys(s.components).length;

  const updateComponents = function(cb) {
    if (hasComponents(context)) { return cb(null); }
    protocol.getComponents(context.client, function(err, components) {
      if (err) { return cb(err); }
      context.components = components;
      return cb(null);
    });
  };

  updateComponents(function(err) {
    let e, graph;
    if (err) { return callback(err); }

    if ((suite.fixture == null)) {
      return synthesizeTopicFixture(suite.topic, context.components, callback);
    } else if (suite.fixture.type === 'json') {
      try {
        graph = JSON.parse(suite.fixture.data);
      } catch (error) {
        e = error;
        return callback(e);
      }
      return callback(null, graph);
    } else if (suite.fixture.type === 'fbp') {
      try {
        graph = fbp.parse(suite.fixture.data);
      } catch (error1) {
        e = error1;
        return callback(e);
      }

      if (!graph.properties) { graph.properties = {}; }
      return callback(null, graph);
    } else {
      return callback(new Error(`Unknown fixture type ${suite.fixture.type}`));
    }
  });
};

const sendMessageAndWait = function(client, currentGraph, inputData, expectData, callback) {
  const observer = client.observe(s => (s.protocol === 'runtime') && (s.command === 'packet') && (s.payload.graph === currentGraph));

  const signalsToReceived = function(signals) {
    const received = {};
    for (let signal of Array.from(signals)) {
      received[signal.payload.port] = signal.payload.payload;
    }
    return received;
  };

  const checkSuccess = function(s) {
    // We're only interested in response packets
    if ((s.protocol !== 'runtime') || (s.command !== 'packet')) { return false; }
    // Check that is for the current graph under test
    if (s.payload.graph !== currentGraph) { return false; }
    // We're only interested in data IPs, not brackets
    if (s.payload.event !== 'data') { return false; }
    // Get signals received until this message
    const receivedSignals = observer.signals.slice(0, observer.signals.indexOf(s) + 1);
    const received = signalsToReceived(receivedSignals);
    const result = (Object.keys(received).length === Object.keys(expectData).length);
    return result;
  };
  const checkFailure = function(s) {
    if ((s.protocol === 'network') && (s.command === 'error')) {
      // network:error should imply failed test
      if (s.payload.graph && (s.payload.graph !== currentGraph)) { return false; }
      return true;
    }
    if ((s.protocol === 'network') && (s.command === 'processerror')) {
      // network:processerror should imply failed test
      if (s.payload.graph && (s.payload.graph !== currentGraph)) { return false; }
      return true;
    }
    if ((s.protocol === 'runtime') && (s.command === 'packet')) {
      // Output packet, see if it is an unexpected error
      // Check that is for the current graph under test
      if (s.payload.graph !== currentGraph) { return false; }
      // We're only interested in data IPs, not brackets
      if (s.payload.event !== 'data') { return false; }
      // We only care for packets to error port
      if (s.payload.port !== 'error') { return false; }
      // We only care if spec isn't expecting errors
      if (typeof expectData.error !== 'undefined') { return false; }
      return true;
    }

    return false;
  };

  // send input packets
  const sendPackets = Promise.promisify(protocol.sendPackets);
  Promise.resolve()
    .then(() => sendPackets(client, currentGraph, inputData))
    .then(() => observer.until(checkSuccess, checkFailure))
    .then(signals => signalsToReceived(signals))
    .nodeify(callback);
};

const needsSetup = function(suite) {
  const notSkipped = suite.cases.filter(c => !c.skip);
  return notSkipped.length > 0;
};

class Runner {
  constructor(client, options) {
    this.client = client;
    if (options == null) { options = {}; }
    this.currentGraphId = null;
    this.components = {};
    this.parentElement = null;
    this.options = options;
    if ((this.options.connectTimeout == null)) { this.options.connectTimeout = 5*1000; }
    if ((this.options.commandTimeout == null)) { this.options.commandTimeout = 3*1000; }
  }

  prepareClient(callback) {
    if ((this.client.protocol != null) && (this.client.address != null)) {
      // is a runtime definition
      Promise.resolve()
        .then(() => fbpClient(this.client, { commandTimeout: this.options.commandTimeout }))
        .then(client => {
          this.client = client;

          if (this.parentElement && (client.definition.protocol === 'iframe')) {
            // We need to set up the parent element in this case
            client.transport.setParentElement(this.parentElement);
          }

          return client;
        })
        .nodeify(callback);
      return;
    }
    // This is a client instance
    callback(null, this.client);
  }

  // TODO: check the runtime capabilities before continuing
  connect(callback) {
    debug('connect');

    this.prepareClient(err => {
      if (err) { return callback(err); }

      debugReceivedMessages(this.client);
      this.client.on('network', function({command, payload}) {
        if ((command === 'output') && payload.message) { return console.log(payload.message); }
      });

      const timeBetweenAttempts = 500;
      const attempts = Math.floor(this.options.connectTimeout / timeBetweenAttempts);
      const isOnline = () => {
        const connected = this.client.isConnected();
        if (connected) { return Promise.resolve(); } else { return Promise.reject(new Error('Not connected to runtime')); }
      };
      const tryConnect = () => {
        debug('trying to connect');
        return this.client.connect();
      };
      return common.retryUntil(tryConnect, isOnline, timeBetweenAttempts, attempts)
        .then(() => this.checkCapabilities(['protocol:graph', 'protocol:network', 'protocol:runtime']))
        .nodeify(callback);
    });
  }

  disconnect(callback) {
    debug('disconnect');

    if (!(this.client != null ? this.client.isConnected() : undefined)) { return callback(); }

    Promise.resolve()
      .then(() => this.client.disconnect())
      .nodeify(callback);
  }

  checkCapabilities(capabilities) {
    if (!this.client.isConnected()) {
      return Promise.reject(new Error('Not connected to runtime'));
    }
    if (!__guard__(this.client.definition != null ? this.client.definition.capabilities : undefined, x => x.length)) {
      return Promise.reject(new Error('Runtime provides no capabilities'));
    }
    for (let capability of Array.from(capabilities)) {
      if (this.client.definition.capabilities.indexOf(capability) === -1) {
        return Promise.reject(new Error(`Runtime doesn't provide ${capability}`));
      }
    }
    return Promise.resolve();
  }

  setupSuite(suite, callback) {
    debug('setup suite', `\"${suite.name}\"`);
    if (!needsSetup(suite)) { return callback(null); }

    if (!this.client.isConnected()) {
      return callback(new Error('Disconnected from runtime'));
    }

    getFixtureGraph(this, suite, (err, graph) => {
      if (err) { return callback(err); }
      protocol.sendGraph(this.client, graph, (err, graphId) => {
        this.currentGraphId = graphId;
        if (err) { return callback(err); }
        return protocol.startNetwork(this.client, graphId, callback);
      });
    });
  }

  teardownSuite(suite, callback) {
    debug('teardown suite', `\"${suite.name}\"`);
    if (!needsSetup(suite)) { return callback(null); }

    if (!this.client.isConnected()) {
      return callback(new Error('Disconnected from runtime'));
    }

    if (!this.currentGraphId) {
      // Graph was never successfully set up, so no need to stop
      callback();
      return;
    }

    // FIXME: also remove the graph. Ideally using a 'destroy' message in FBP protocol
    protocol.stopNetwork(this.client, this.currentGraphId, callback);
  }

  runTest(testcase, callback) {
    debug('runtest', `\"${testcase.name}\"`);

    if (!this.client.isConnected()) {
      return callback(new Error('Disconnected from runtime'));
    }

    // XXX: normalize and validate in testsuite.coffee instead?
    const inputs = common.isArray(testcase.inputs) ? testcase.inputs : [ testcase.inputs ];
    const expects = common.isArray(testcase.expect) ? testcase.expect : [ testcase.expect ];
    const sequence = [];
    for (let i = 0, end = inputs.length, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
      sequence.push({
        inputs: inputs[i],
        expect: expects[i]});
    }

    const sendWait = (data, cb) => {
      return sendMessageAndWait(this.client, this.currentGraphId, data.inputs, data.expect, cb);
    };
    common.asyncSeries(sequence, sendWait, function(err, actuals) {
      if (err) { return callback(err); }
      actuals.forEach((r, idx) => sequence[idx].actual = r);
      return callback(null, sequence);
    });
  }
}

// TODO: should this go into expectation?
const checkResults = function(results) {
  let result;
  const actuals = results.filter(r => r.actual != null);
  const expects = results.filter(r => r.expect != null);
  if (actuals.length < expects.length) {
    result = {
      passed: false,
      error: new Error(`Only got ${actual.length} output messages out of ${expect.length}`)
    };
    return result;
  }

  results = results.map(function(res) {
    res.error = null;
    try {
      expectation.expect(res.expect, res.actual);
    } catch (e) {
      // FIXME: only catch actual AssertionErrors
      res.error = e;
    }
    return res;
  });

  const failures = results.filter(r => r.error);
  if (failures.length === 0) {
    result =
      {passed: true};
  } else {
    if (expects.length === 1) {
      result =
        {error: failures[0].error};
    } else if ((expects.length > 1) && (failures.length === 1)) {
      const index = results.findIndex(r => r.error);
      const failed = results[index];
      result =
        {error: new Error(`Expectation ${index} of sequence failed: ${failed.error.message}`)};
    } else {
      const errors = results.map(r => (r.error != null ? r.error.message : undefined) || '');
      result =
        {error: new Error(`Multiple failures in sequence: ${errors}`)};
    }
  }

  return result;
};

const runTestAndCheck = function(runner, testcase, callback) {
  if (testcase.skip) { return callback(null, { passed: true }); }
    // TODO: pass some skipped state? its indirectly in .skip though

  // XXX: normalize and validate in testsuite.coffee instead?
  const inputs = common.isArray(testcase.inputs) ? testcase.inputs : [ testcase.inputs ];
  const expects = common.isArray(testcase.expect) ? testcase.expect : [ testcase.expect ];
  if (inputs.length !== expects.length) {
    return callback(null, {
      passed: false,
      error: new Error(`Test sequence length mismatch. Got ${inputs.length} inputs and ${expects.length} expectations`)
    }
    );
  }

  runner.runTest(testcase, function(err, results) {
    let result;
    if (err) {
      // Map error to a test failure
      result = {
        passed: false,
        error: err
      };
      return callback(null, result);
    }
    result = checkResults(results);
    if (result.error) {
      result.passed = false;
    }
    return callback(null, result);
  });
};

const runSuite = function(runner, suite, runTest, callback) {
  if (suite.skip) { return callback(null, suite); }
  // TODO: pass some skipped state? its indirectly in .skip though

  runner.setupSuite(suite, function(err) {
    debug('setup suite', err);
    if (err) { return callback(err, suite); }

    return common.asyncSeries(suite.cases, runTest, function(err) {
      debug('testrun complete', err);

      return runner.teardownSuite(suite, function(err) {
        debug('teardown suite', err);
        return callback(err, suite);
      });
    });
  });
};


exports.getComponentSuites = function(runner, callback) {
  protocol.getCapabilities(runner.client, function(err, caps) {
    if (err) { return callback(err); }
    if (!Array.from(caps).includes('component:getsource')) { return callback(null, []); }

    return protocol.getComponentTests(runner.client, function(err, tests) {
      if (err) { return callback(err); }
      const suites = loadComponentSuites(tests);
      debug('get component suites', tests.length, suites.length);
      return callback(null, suites);
    });
  });
};

var loadComponentSuites = function(componentTests) {
  let suites = [];
  for (let name in componentTests) {
    const tests = componentTests[name];
    try {
      const ss = testsuite.loadYAML(tests);
      suites = suites.concat(ss);
    } catch (e) {
      // ignore, could be non fbp-spec test
      // TODO: include tests type in FBP protocol, so we know whether this is error or legit
      continue;
    }
  }
  return suites;
};

// will update each of the testcases in @suites
// with .passed and .error states as tests are ran
const runAll = function(runner, suites, updateCallback, doneCallback) {

  const runTest = function(testcase, callback) {
    const done = function(error) {
      updateCallback(suites);
      return callback(error);
    };

    return runTestAndCheck(runner, testcase, function(err, results) {
      for (let key in results) {
        const val = results[key];
        testcase[key] = val;
      }
      if (testcase.error) { testcase.error = testcase.error.message; }
      debug('ran test', '"testcase.name"', testcase.passed, err);
      return done(null);
    }); // ignore error to not bail out early
  };

  const runOneSuite = (suite, cb) => runSuite(runner, suite, runTest, cb);

  debug('running suites', (Array.from(suites).map((s) => s.name)));
  common.asyncSeries(suites, runOneSuite, err => doneCallback(err));

};

exports.Runner = Runner;
exports.runAll = runAll;
exports.runTestAndCheck = runTestAndCheck;

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}