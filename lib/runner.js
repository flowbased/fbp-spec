const fbp = require('fbp');
const fbpClient = require('fbp-client');
const debug = require('debug')('fbp-spec:runner');
const debugReceived = require('debug')('fbp-spec:runner:received');
const Promise = require('bluebird');
const common = require('./common');
const protocol = require('./protocol');
const testsuite = require('./testsuite');
const expectation = require('./expectation');

function debugReceivedMessages(client) {
  client.on('signal', ({ proto, command, payload }) => debugReceived(proto, command, payload));
}

function synthesizeTopicFixture(topic, components, callback) {
  debug('synthesizing fixture', topic);
  // export each of the ports for topic component
  // return a FBP graph?
  const component = components[topic];
  if (!component) {
    callback(new Error(`Could not find component for topic: ${topic}`));
    return;
  }

  const graph = {
    properties: {},
    inports: {},
    outports: {},
    processes: {},
    connections: [],
  };

  const processName = 'testee';
  graph.processes[processName] = { component: topic };

  component.inPorts.forEach((port) => {
    const portName = port.id;
    graph.inports[portName] = {
      process: processName,
      port: portName,
    };
  });
  component.outPorts.forEach((port) => {
    const portName = port.id;
    graph.outports[portName] = {
      process: processName,
      port: portName,
    };
  });

  // Sanity checking if this is usable as a fixture
  if (Object.keys(graph.outports).length < 1) {
    callback(new Error(`Component '${topic}' used as fixture has no outports`));
    return;
  }
  if (Object.keys(graph.inports).length < 1) {
    callback(new Error(`Component '${topic}' used as fixture has no inports`));
    return;
  }

  callback(null, graph);
}

// @context should have .components = {} property
function getFixtureGraph(context, suite, callback) {
  // TODO: follow runtime for component changes

  const hasComponents = (s) => (s.components != null) && (typeof s.components === 'object') && Object.keys(s.components).length;

  function updateComponents(cb) {
    if (hasComponents(context)) {
      cb(null);
      return;
    }
    protocol.getComponents(context.client, (err, components) => {
      if (err) {
        cb(err);
        return;
      }
      context.components = components;
      cb(null);
    });
  }

  updateComponents((err) => {
    if (err) {
      callback(err);
      return;
    }

    if (!suite.fixture) {
      synthesizeTopicFixture(suite.topic, context.components, callback);
      return;
    }

    if (suite.fixture.type === 'json') {
      let graph;
      try {
        graph = JSON.parse(suite.fixture.data);
      } catch (error) {
        callback(error);
        return;
      }
      callback(null, graph);
      return;
    }
    if (suite.fixture.type === 'fbp') {
      let graph;
      try {
        graph = fbp.parse(suite.fixture.data);
      } catch (error) {
        callback(error);
        return;
      }

      if (!graph.properties) {
        graph.properties = {};
      }
      callback(null, graph);
      return;
    }
    callback(new Error(`Unknown fixture type ${suite.fixture.type}`));
  });
}

function sendMessageAndWait(client, currentGraph, inputData, expectData, callback) {
  const observer = client.observe((s) => (s.protocol === 'runtime') && (s.command === 'packet') && (s.payload.graph === currentGraph));

  function signalsToReceived(signals) {
    const received = {};
    signals.forEach((signal) => {
      received[signal.payload.port] = signal.payload.payload;
    });
    return received;
  }

  function checkSuccess(s) {
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
  }
  function checkFailure(s) {
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
  }

  // send input packets
  const sendPackets = Promise.promisify(protocol.sendPackets);
  Promise.resolve()
    .then(() => sendPackets(client, currentGraph, inputData))
    .then(() => observer.until(checkSuccess, checkFailure))
    .then((signals) => signalsToReceived(signals))
    .nodeify(callback);
}

function needsSetup(suite) {
  const notSkipped = suite.cases.filter((c) => !c.skip);
  return notSkipped.length > 0;
}

class Runner {
  constructor(client, options = {}) {
    this.client = client;
    this.currentGraphId = null;
    this.components = {};
    this.parentElement = null;
    this.options = options;
    if ((this.options.connectTimeout == null)) { this.options.connectTimeout = 5 * 1000; }
    if ((this.options.commandTimeout == null)) { this.options.commandTimeout = 3 * 1000; }
  }

  prepareClient(callback) {
    if ((this.client.protocol != null) && (this.client.address != null)) {
      // is a runtime definition
      Promise.resolve()
        .then(() => fbpClient(this.client, { commandTimeout: this.options.commandTimeout }))
        .then((client) => {
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

    this.prepareClient((err) => {
      if (err) {
        callback(err);
        return;
      }

      debugReceivedMessages(this.client);
      this.client.on('network', ({ command, payload }) => {
        if ((command === 'output') && payload.message) {
          console.log(payload.message);
        }
      });

      const timeBetweenAttempts = 500;
      const attempts = Math.floor(this.options.connectTimeout / timeBetweenAttempts);
      const isOnline = () => {
        const connected = this.client.isConnected();
        if (connected) {
          return Promise.resolve();
        }
        return Promise.reject(new Error('Not connected to runtime'));
      };
      const tryConnect = () => {
        debug('trying to connect');
        return this.client.connect();
      };
      common.retryUntil(tryConnect, isOnline, timeBetweenAttempts, attempts)
        .then(() => this.checkCapabilities(['protocol:graph', 'protocol:network', 'protocol:runtime']))
        .nodeify(callback);
    });
  }

  disconnect(callback) {
    debug('disconnect');

    if (!(this.client != null ? this.client.isConnected() : undefined)) {
      callback();
      return;
    }

    Promise.resolve()
      .then(() => this.client.disconnect())
      .nodeify(callback);
  }

  checkCapabilities(capabilities) {
    if (!this.client.isConnected()) {
      return Promise.reject(new Error('Not connected to runtime'));
    }
    if (!this.client.definition
      || !this.client.definition.capabilities
      || !this.client.definition.capabilities.length) {
      return Promise.reject(new Error('Runtime provides no capabilities'));
    }
    for (let i = 0; i < capabilities.length; i += 1) {
      const capability = capabilities[i];
      if (this.client.definition.capabilities.indexOf(capability) === -1) {
        return Promise.reject(new Error(`Runtime doesn't provide ${capability}`));
      }
    }
    return Promise.resolve();
  }

  setupSuite(suite, callback) {
    debug(`setup suite "${suite.name}"`);
    if (!needsSetup(suite)) {
      callback(null);
      return;
    }

    if (!this.client.isConnected()) {
      callback(new Error('Disconnected from runtime'));
      return;
    }

    getFixtureGraph(this, suite, (err, graph) => {
      if (err) {
        callback(err);
        return;
      }
      protocol.sendGraph(this.client, graph, (sendErr, graphId) => {
        if (sendErr) {
          callback(sendErr);
          return;
        }
        this.currentGraphId = graphId;
        protocol.startNetwork(this.client, graphId, callback);
      });
    });
  }

  teardownSuite(suite, callback) {
    debug(`teardown suite "${suite.name}"`);
    if (!needsSetup(suite)) {
      callback(null);
      return;
    }

    if (!this.client.isConnected()) {
      callback(new Error('Disconnected from runtime'));
      return;
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
    debug(`runtest "${testcase.name}"`);

    if (!this.client.isConnected()) {
      callback(new Error('Disconnected from runtime'));
      return;
    }

    // XXX: normalize and validate in testsuite.js instead?
    const inputs = common.isArray(testcase.inputs) ? testcase.inputs : [testcase.inputs];
    const expects = common.isArray(testcase.expect) ? testcase.expect : [testcase.expect];
    const sequence = [];
    for (let i = 0, end = inputs.length, asc = end >= 0;
      asc ? i < end : i > end;
      asc ? i += 1 : i -= 1) {
      sequence.push({
        inputs: inputs[i],
        expect: expects[i],
      });
    }

    const sendWait = (data, cb) => sendMessageAndWait(
      this.client,
      this.currentGraphId,
      data.inputs,
      data.expect,
      cb,
    );
    common.asyncSeries(sequence, sendWait, (err, actuals) => {
      if (err) {
        callback(err);
        return;
      }
      actuals.forEach((r, idx) => {
        sequence[idx].actual = r;
      });
      callback(null, sequence);
    });
  }
}

// TODO: should this go into expectation?
function checkResults(results) {
  let result;
  const actuals = results.filter((r) => r.actual != null);
  const expects = results.filter((r) => r.expect != null);
  if (actuals.length < expects.length) {
    result = {
      passed: false,
      error: new Error(`Only got ${actuals.length} output messages out of ${expects.length}`),
    };
    return result;
  }

  const mappedResults = results.map((res) => {
    res.error = null;
    try {
      expectation.expect(res.expect, res.actual);
    } catch (e) {
      // FIXME: only catch actual AssertionErrors
      res.error = e;
    }
    return res;
  });

  const failures = mappedResults.filter((r) => r.error);
  if (failures.length === 0) {
    result = { passed: true };
  } else if (expects.length === 1) {
    result = { error: failures[0].error };
  } else if ((expects.length > 1) && (failures.length === 1)) {
    const index = mappedResults.findIndex((r) => r.error);
    const failed = mappedResults[index];
    result = { error: new Error(`Expectation ${index} of sequence failed: ${failed.error.message}`) };
  } else {
    const errors = mappedResults.map((r) => (r.error != null ? r.error.message : undefined) || '');
    result = { error: new Error(`Multiple failures in sequence: ${errors}`) };
  }

  return result;
}

function runTestAndCheck(runner, testcase, callback) {
  if (testcase.skip) {
    // TODO: pass some skipped state? its indirectly in .skip though
    callback(null, { passed: true });
    return;
  }

  // XXX: normalize and validate in testsuite.js instead?
  const inputs = common.isArray(testcase.inputs) ? testcase.inputs : [testcase.inputs];
  const expects = common.isArray(testcase.expect) ? testcase.expect : [testcase.expect];
  if (inputs.length !== expects.length) {
    callback(null, {
      passed: false,
      error: new Error(`Test sequence length mismatch. Got ${inputs.length} inputs and ${expects.length} expectations`),
    });
    return;
  }

  runner.runTest(testcase, (err, results) => {
    let result;
    if (err) {
      // Map error to a test failure
      result = {
        passed: false,
        error: err,
      };
      callback(null, result);
      return;
    }
    result = checkResults(results);
    if (result.error) {
      result.passed = false;
    }
    callback(null, result);
  });
}

function runSuite(runner, suite, runTest, callback) {
  if (suite.skip) {
    // TODO: pass some skipped state? its indirectly in .skip though
    callback(null, suite);
    return;
  }

  runner.setupSuite(suite, (err) => {
    debug('setup suite', err);
    if (err) {
      callback(err, suite);
      return;
    }

    common.asyncSeries(suite.cases, runTest, (runErr) => {
      debug('testrun complete', runErr);
      if (runErr) {
        runner.teardownSuite(suite, (teardownErr) => {
          debug('teardown suite', teardownErr);
          callback(runErr, suite);
        });
        return;
      }

      runner.teardownSuite(suite, (teardownErr) => {
        debug('teardown suite', teardownErr);
        callback(teardownErr, suite);
      });
    });
  });
}

function loadComponentSuites(componentTests, callback) {
  function loadYAML(source, cb) {
    testsuite.loadYAML(source, (err, suite) => {
      if (err) {
        // ignore, could be non fbp-spec test
        // TODO: include tests type in FBP protocol, so we know whether this is error or legit
        cb(null, null);
        return;
      }
      cb(null, suite);
    });
  }
  common.asyncSeries(componentTests, loadYAML, (err, suites) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, suites.filter((s) => s !== null).reduce((a, b) => a.concat(b), []));
  });
}

exports.getComponentSuites = function getComponentSuites(runner, callback) {
  protocol.getCapabilities(runner.client, (err, caps) => {
    if (err) {
      callback(err);
      return;
    }
    if (caps.indexOf('component:getsource') === -1) {
      callback(null, []);
      return;
    }

    protocol.getComponentTests(runner.client, (testsErr, tests) => {
      if (testsErr) {
        callback(testsErr);
        return;
      }
      loadComponentSuites(tests, (loadErr, suites) => {
        if (loadErr) {
          callback(loadErr);
          return;
        }
        debug('get component suites', tests.length, suites.length);
        callback(null, suites);
      });
    });
  });
};

// will update each of the testcases in @suites
// with .passed and .error states as tests are ran
function runAll(runner, suites, updateCallback, doneCallback) {
  function runTest(testcase, callback) {
    function done(error) {
      updateCallback(suites);
      callback(error);
    }

    runTestAndCheck(runner, testcase, (err, results) => {
      // ignore error to not bail out early
      const tcase = testcase;
      Object.keys(results).forEach((key) => {
        const val = results[key];
        tcase[key] = val;
      });
      if (testcase.error) {
        tcase.error = testcase.error.message;
      }
      debug(`ran test "${testcase.name}"`, testcase.passed, err);
      done(null);
    });
  }

  const runOneSuite = (suite, cb) => runSuite(runner, suite, runTest, cb);

  debug('running suites', suites.map((s) => s.name));
  common.asyncSeries(suites, runOneSuite, (err) => doneCallback(err));
}

exports.Runner = Runner;
exports.runAll = runAll;
exports.runTestAndCheck = runTestAndCheck;
