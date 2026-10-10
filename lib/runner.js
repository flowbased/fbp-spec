/**
 * Runs fbp-spec testsuites against an FBP runtime.
 * @module lib/runner
 */

import debugLib from "debug";
import fbp from "fbp";
import fbpClient from "fbp-client";
import flowtrace from "flowtrace";

import { asyncSeries, isArray, retryUntil } from "./common.js";
import { expect as checkExpectation } from "./expectation.js";
import * as protocol from "./protocol.js";
import * as testsuite from "./testsuite.js";

const debug = debugLib("fbp-spec:runner");
const debugReceived = debugLib("fbp-spec:runner:received");
const { FlowtraceRecorder } = flowtrace;

/**
 * Options for configuring a Runner.
 * @typedef {object} RunnerOptions
 * @property {number} [connectTimeout] Time to wait for the connection to come up, in milliseconds
 * @property {number} [commandTimeout] Maximum time to wait for a command response, in milliseconds
 * @property {((graphId: string, testcaseName: string, trace: object) => void)} [traceCallback]
 *   Called with a recorded Flowtrace for each test, when tracing is enabled
 * @property {object} [parentElement] DOM element to attach iframe runtimes to (browser only)
 */

/**
 * One entry in a test sequence: inputs sent, expected outputs, and the actual outputs.
 * @typedef {{ inputs: *, expect: *, actual?: * }} TestSequenceEntry
 */

/**
 * Anything that can run a testcase; satisfied by Runner.
 * @typedef {{ runTest(testcase: object): Promise<TestSequenceEntry[]> }} RunnerLike
 */

/**
 * Log all protocol messages received from a client.
 * @param {import("fbp-client").FbpClient} client Client to listen on
 * @returns {void}
 */
function debugReceivedMessages(client) {
  client.on("signal", (message) => {
    const { proto, command, payload } =
      /** @type {{ proto: string, command: string, payload: * }} */ (message);
    debugReceived(proto, command, payload);
  });
}

/**
 * Build a fixture graph that exposes all ports of the topic component.
 * @param {string} topic Component name to use as fixture
 * @param {Record<string, import("./protocol.js").RuntimeComponent>} components Components available on the runtime
 * @returns {import("./protocol.js").GraphPayload} A graph JSON payload
 */
function synthesizeTopicFixture(topic, components) {
  debug("synthesizing fixture", topic);
  // export each of the ports for topic component
  // return a FBP graph?
  const component = components[topic];
  if (!component) {
    throw new Error(`Could not find component for topic: ${topic}`);
  }

  /** @type {import("./protocol.js").GraphPayload & { properties: Record<string, *>, inports: Record<string, *>, outports: Record<string, *>, processes: Record<string, *>, connections: *[] }} */
  const graph = {
    properties: {},
    inports: {},
    outports: {},
    processes: {},
    connections: [],
  };

  const processName = "testee";
  graph.processes[processName] = { component: topic };

  for (const port of component.inPorts) {
    const portName = port.id;
    graph.inports[portName] = {
      process: processName,
      port: portName,
    };
  }
  for (const port of component.outPorts) {
    const portName = port.id;
    graph.outports[portName] = {
      process: processName,
      port: portName,
    };
  }

  // Sanity checking if this is usable as a fixture
  if (Object.keys(graph.outports).length < 1) {
    throw new Error(`Component '${topic}' used as fixture has no outports`);
  }
  if (Object.keys(graph.inports).length < 1) {
    throw new Error(`Component '${topic}' used as fixture has no inports`);
  }

  return graph;
}

/**
 * Determine the fixture graph for a suite, loading components from the runtime if needed.
 * @param {{ components: Record<string, import("./protocol.js").RuntimeComponent>, client: import("fbp-client").FbpClient }} context
 *   Object holding the runtime context; the .components property is populated as needed
 * @param {import("./testsuite.js").Suite} suite Testsuite to determine fixture for
 * @returns {Promise<import("./protocol.js").GraphPayload>} Graph JSON payload
 */
async function getFixtureGraph(context, suite) {
  // TODO: follow runtime for component changes

  const hasComponents =
    /** @type {(s: { components?: Record<string, import("./protocol.js").RuntimeComponent> }) => boolean} */ (
      (s) =>
        s.components != null &&
        typeof s.components === "object" &&
        Object.keys(s.components).length
    );

  if (!hasComponents(context)) {
    context.components = await protocol.getComponents(context.client);
  }

  if (!suite.fixture) {
    return synthesizeTopicFixture(suite.topic ?? "", context.components);
  }

  if (suite.fixture.type === "json") {
    let graph;
    try {
      graph = /** @type {import("./protocol.js").GraphPayload} */ (
        JSON.parse(suite.fixture.data)
      );
    } catch (error) {
      const err = /** @type {Error} */ (error);
      throw new Error(`Could not parse JSON fixture: ${err.message}`);
    }
    return graph;
  }
  if (suite.fixture.type === "fbp") {
    let graph;
    try {
      graph = /** @type {import("./protocol.js").GraphPayload} */ (
        fbp.parse(suite.fixture.data)
      );
    } catch (error) {
      const err = /** @type {Error} */ (error);
      throw new Error(`Could not parse FBP fixture: ${err.message}`);
    }

    if (!graph.properties) {
      graph.properties = {};
    }
    return graph;
  }
  throw new Error(`Unknown fixture type ${suite.fixture.type}`);
}

/**
 * Send input data to the graph, and wait for the expected output packets to arrive.
 * @param {import("fbp-client").FbpClient} client Connected client
 * @param {string} currentGraph ID of the graph under test
 * @param {Record<string, *>} inputData Input data keyed by port name
 * @param {Record<string, *>} expectData Expected output data keyed by port name
 * @returns {Promise<Record<string, *>>} Data received on the outports
 */
async function sendMessageAndWait(client, currentGraph, inputData, expectData) {
  const observer = client.observe(
    (s) =>
      s.protocol === "runtime" &&
      s.command === "packet" &&
      s.payload.graph === currentGraph,
  );

  /**
   * Convert observed signals into received data, keyed by port.
   * @param {{ payload: Record<string, *> }[]} signals Observed signals
   * @returns {Record<string, *>} Data keyed by port name
   */
  function signalsToReceived(signals) {
    /** @type {Record<string, *>} */
    const received = {};
    for (const signal of signals) {
      received[signal.payload.port] = signal.payload.payload;
    }
    return received;
  }

  /**
   * Check whether a signal means we have received all the expected output.
   * @param {{ protocol: string, command: string, payload: Record<string, *> }} s Signal to check
   * @returns {boolean} True when complete
   */
  function checkSuccess(s) {
    // We're only interested in response packets
    if (s.protocol !== "runtime" || s.command !== "packet") {
      return false;
    }
    // Check that is for the current graph under test
    if (s.payload.graph !== currentGraph) {
      return false;
    }
    // We're only interested in data IPs, not brackets
    if (s.payload.event !== "data") {
      return false;
    }
    // Get signals received until this message
    const receivedSignals = observer.signals.slice(
      0,
      observer.signals.indexOf(s) + 1,
    );
    const received = signalsToReceived(receivedSignals);
    const result =
      Object.keys(received).length === Object.keys(expectData).length;
    return result;
  }
  /**
   * Check whether a signal means the test has failed.
   * @param {{ protocol: string, command: string, payload: Record<string, *> }} s Signal to check
   * @returns {boolean} True when failed
   */
  function checkFailure(s) {
    if (s.protocol === "network" && s.command === "error") {
      // network:error should imply failed test
      if (s.payload.graph && s.payload.graph !== currentGraph) {
        return false;
      }
      return true;
    }
    if (s.protocol === "network" && s.command === "processerror") {
      // network:processerror should imply failed test
      if (s.payload.graph && s.payload.graph !== currentGraph) {
        return false;
      }
      return true;
    }
    if (s.protocol === "runtime" && s.command === "packet") {
      // Output packet, see if it is an unexpected error
      // Check that is for the current graph under test
      if (s.payload.graph !== currentGraph) {
        return false;
      }
      // We're only interested in data IPs, not brackets
      if (s.payload.event !== "data") {
        return false;
      }
      // We only care for packets to error port
      if (s.payload.port !== "error") {
        return false;
      }
      // We only care if spec isn't expecting errors
      if (typeof expectData.error !== "undefined") {
        return false;
      }
      return true;
    }
    return false;
  }

  // send input packets
  await protocol.sendPackets(client, currentGraph, inputData);
  const signals = await observer.until(checkSuccess, checkFailure);
  return signalsToReceived(signals);
}

/**
 * Whether a suite has any testcases that are not skipped.
 * @param {import("./testsuite.js").Suite} suite Testsuite
 * @returns {boolean} True if the suite needs setup
 */
function needsSetup(suite) {
  const notSkipped = (suite.cases ?? []).filter((c) => !c.skip);
  return notSkipped.length > 0;
}

/**
 * Runs testsuites against a connected FBP runtime.
 */
export class Runner {
  /**
   * @param {object|import("fbp-client").FbpClient} client Either a runtime definition,
   *   or an already-connected fbp-client instance
   * @param {RunnerOptions} [options] Runner options; timeouts are in milliseconds
   */
  constructor(client, options = {}) {
    /** @type {import("fbp-client").FbpClient} */
    this.client = /** @type {import("fbp-client").FbpClient} */ (client);
    this.currentGraphId = null;
    /** @type {Record<string, import("./protocol.js").RuntimeComponent>} */
    this.components = {};
    this.parentElement = /** @type {object|null} */ (null);
    /** @type {RunnerOptions} */
    this.options = options;
    /** @type {import("flowtrace").FlowtraceRecorder|null} */
    this.recorder = null;
    if (this.options.connectTimeout == null) {
      this.options.connectTimeout = 5 * 1000;
    }
    if (this.options.commandTimeout == null) {
      this.options.commandTimeout = 3 * 1000;
    }
  }

  /**
   * Ensure this.client is a connected fbp-client instance.
   * @returns {Promise<import("fbp-client").FbpClient>} Connected client
   */
  async prepareClient() {
    const isDefinition = "protocol" in this.client && "address" in this.client;
    if (isDefinition) {
      // is a runtime definition
      const client = await fbpClient(this.client, {
        commandTimeout: this.options.commandTimeout,
      });

      if (this.parentElement && client.definition.protocol === "iframe") {
        // We need to set up the parent element in this case
        client.transport.setParentElement(this.parentElement);
      }

      this.client = client;
      return client;
    }
    // This is a client instance
    return this.client;
  }

  // TODO: check the runtime capabilities before continuing
  /**
   * Connect to the runtime, retrying until the connection is up.
   * @returns {Promise<void>} Resolves when connected and capabilities are checked
   */
  async connect() {
    debug("connect");

    const client = await this.prepareClient();
    debugReceivedMessages(client);
    client.on("network", (message) => {
      const { command, payload } =
        /** @type {{ command: string, payload: { message?: string } }} */ (
          message
        );
      if (command === "output" && payload.message) {
        console.log(payload.message);
      }
    });

    const timeBetweenAttempts = 500;
    const attempts = Math.floor(
      (this.options.connectTimeout ?? 5000) / timeBetweenAttempts,
    );
    const isOnline = async () => {
      const connected = this.client.isConnected();
      if (connected) {
        return;
      }
      throw new Error("Not connected to runtime");
    };
    const tryConnect = async () => {
      debug("trying to connect");
      return this.client.connect();
    };
    await retryUntil(tryConnect, isOnline, timeBetweenAttempts, attempts);
    await this.checkCapabilities([
      "protocol:graph",
      "protocol:network",
      "protocol:runtime",
    ]);
  }

  /**
   * Disconnect from the runtime, if connected.
   * @returns {Promise<void>} Resolves when disconnected
   */
  async disconnect() {
    debug("disconnect");

    if (!this.client?.isConnected()) {
      return;
    }

    await this.client.disconnect();
  }

  /**
   * Check that the runtime provides the given capabilities.
   * @param {string[]} capabilities Capability names required
   * @returns {Promise<void>} Rejects if a capability is missing
   */
  async checkCapabilities(capabilities) {
    if (!this.client.isConnected()) {
      throw new Error("Not connected to runtime");
    }
    if (!this.client.definition?.capabilities?.length) {
      throw new Error("Runtime provides no capabilities");
    }
    const caps = this.client.definition?.capabilities ?? [];
    for (const capability of capabilities) {
      if (caps.indexOf(capability) === -1) {
        throw new Error(`Runtime doesn't provide ${capability}`);
      }
    }
  }

  /**
   * Set up the fixture graph for a suite, and start its network.
   * @param {import("./testsuite.js").Suite} suite Testsuite to set up
   * @returns {Promise<void>} Resolves when the network is running
   */
  async setupSuite(suite) {
    debug(`setup suite "${suite.name}"`);
    if (this.options.traceCallback && !this.recorder) {
      this.recorder = new FlowtraceRecorder(this.client);
    }
    if (!needsSetup(suite)) {
      return;
    }

    if (!this.client.isConnected()) {
      throw new Error("Disconnected from runtime");
    }

    const graph = await getFixtureGraph(this, suite);
    const graphId = await protocol.sendGraph(this.client, graph);
    this.currentGraphId = graphId;
    if (this.recorder) {
      await this.recorder.start(graphId);
    }
    await protocol.startNetwork(this.client, graphId);
  }

  /**
   * Stop the network for a suite, and stop any tracing.
   * @param {import("./testsuite.js").Suite} suite Testsuite to tear down
   * @returns {Promise<void>} Resolves when the network is stopped
   */
  async teardownSuite(suite) {
    debug(`teardown suite "${suite.name}"`);
    if (this.recorder && this.currentGraphId) {
      await this.recorder.stop(this.currentGraphId);
    }
    if (!needsSetup(suite)) {
      return;
    }

    if (!this.client.isConnected()) {
      throw new Error("Disconnected from runtime");
    }

    if (!this.currentGraphId) {
      // Graph was never successfully set up, so no need to stop
      return;
    }

    // FIXME: also remove the graph. Ideally using a 'destroy' message in FBP protocol
    await protocol.stopNetwork(this.client, this.currentGraphId);
  }

  /**
   * Run a single testcase, recording the actual outputs in the sequence.
   * @param {import("./testsuite.js").Testcase} testcase Testcase to run
   * @returns {Promise<TestSequenceEntry[]>} The input/expect sequence with actuals filled in
   */
  async runTest(testcase) {
    debug(`runtest "${testcase.name}"`);

    if (!this.client.isConnected()) {
      throw new Error("Disconnected from runtime");
    }
    if (!this.currentGraphId) {
      // Suite has not been set up
      throw new Error("No graph is set up for the suite");
    }

    // XXX: normalize and validate in testsuite.js instead?
    const inputs = /** @type {Record<string, *>|Record<string, *>[]} */ (
      testcase.inputs
    );
    const expects = /** @type {Record<string, *>|Record<string, *>[]} */ (
      testcase.expect
    );
    const inputList = /** @type {Record<string, *>[]} */ (
      isArray(inputs) ? inputs : [inputs]
    );
    const expectList = /** @type {Record<string, *>[]} */ (
      isArray(expects) ? expects : [expects]
    );
    /** @type {TestSequenceEntry[]} */
    const sequence = [];
    for (let i = 0; i < inputList.length; i += 1) {
      sequence.push({
        inputs: inputList[i],
        expect: expectList[i],
      });
    }

    const actuals = [];
    for (const data of sequence) {
      actuals.push(
        await sendMessageAndWait(
          // eslint-disable-line no-await-in-loop
          this.client,
          this.currentGraphId,
          data.inputs,
          data.expect,
        ),
      );
    }

    if (this.options.traceCallback && this.currentGraphId && this.recorder) {
      this.options.traceCallback(
        this.currentGraphId,
        testcase.name ?? "",
        this.recorder.dump(this.currentGraphId),
      );
    }
    actuals.forEach((r, idx) => {
      sequence[idx].actual = r;
    });
    return sequence;
  }
}

/**
 * Check actual test results against the expectations.
 * @param {Array<TestSequenceEntry & { error?: Error|null }>} results
 *   Input/expect/actual sequence as produced by Runner#runTest
 * @returns {{ passed: boolean, error?: Error }} Result of the check
 */
export function checkResults(results) {
  /** @type {{ passed: boolean, error?: Error }} */
  let result;
  const actuals = results.filter((r) => r.actual != null);
  const expects = results.filter((r) => r.expect != null);
  if (actuals.length < expects.length) {
    result = {
      passed: false,
      error: new Error(
        `Only got ${actuals.length} output messages out of ${expects.length}`,
      ),
    };
    return result;
  }

  const mappedResults = results.map((res) => {
    res.error = null;
    try {
      checkExpectation(res.expect, res.actual);
    } catch (e) {
      // FIXME: only catch actual AssertionErrors
      res.error = /** @type {Error} */ (e);
    }
    return res;
  });

  const failures = mappedResults.filter((r) => r.error);
  if (failures.length === 0) {
    result = { passed: true };
  } else if (expects.length === 1) {
    result = {
      passed: false,
      error: failures[0].error ?? new Error("unknown expectation failure"),
    };
  } else if (expects.length > 1 && failures.length === 1) {
    const index = mappedResults.findIndex((r) => r.error);
    const failed = mappedResults[index];
    result = {
      passed: false,
      error: new Error(
        `Expectation ${index} of sequence failed: ${failed.error?.message}`,
      ),
    };
  } else {
    const errors = mappedResults.map(
      (r) => (r.error != null ? r.error.message : undefined) || "",
    );
    result = {
      passed: false,
      error: new Error(`Multiple failures in sequence: ${errors}`),
    };
  }

  return result;
}

/**
 * Run a single testcase and check its results.
 * @param {RunnerLike} runner Runner with a set up suite
 * @param {import("./testsuite.js").Testcase} testcase Testcase to run
 * @returns {Promise<{ passed: boolean, error?: Error }>} Test result
 */
export async function runTestAndCheck(runner, testcase) {
  if (testcase.skip) {
    // TODO: pass some skipped state? its indirectly in .skip though
    return { passed: true };
  }

  // XXX: normalize and validate in testsuite.js instead?
  const inputs = /** @type {Record<string, *>|Record<string, *>[]} */ (
    testcase.inputs
  );
  const expects = /** @type {Record<string, *>|Record<string, *>[]} */ (
    testcase.expect
  );
  const inputList = /** @type {Record<string, *>[]} */ (
    isArray(inputs) ? inputs : [inputs]
  );
  const expectList = /** @type {Record<string, *>[]} */ (
    isArray(expects) ? expects : [expects]
  );
  if (inputList.length !== expectList.length) {
    return {
      passed: false,
      error: new Error(
        `Test sequence length mismatch. Got ${inputList.length} inputs and ${expectList.length} expectations`,
      ),
    };
  }

  /** @type {TestSequenceEntry[]} */
  let results;
  try {
    results = await runner.runTest(testcase);
  } catch (err) {
    // Map error to a test failure
    return {
      passed: false,
      error: /** @type {Error} */ (err),
    };
  }

  const result = checkResults(results);
  return result;
}

/**
 * Run all testcases in a suite.
 * @param {Runner} runner Runner to run with
 * @param {import("./testsuite.js").Suite} suite Testsuite to run
 * @param {(testcase: import("./testsuite.js").Testcase) => Promise<void>} runTest Async function running and checking one testcase
 * @returns {Promise<import("./testsuite.js").Suite>} The suite
 */
export async function runSuite(runner, suite, runTest) {
  if (suite.skip) {
    // TODO: pass some skipped state? its indirectly in .skip though
    return suite;
  }

  try {
    await runner.setupSuite(suite);
  } catch (err) {
    debug("setup suite", err);
    throw err;
  }

  try {
    await asyncSeries(suite.cases ?? [], runTest);
  } finally {
    await runner
      .teardownSuite(suite)
      .catch((err) => debug("teardown suite", err));
  }
  return suite;
}

/**
 * Load and parse the fbp-spec tests attached to components.
 * Non-fbp-spec test sources are ignored.
 * @param {Record<string, string>} componentTests YAML test sources, keyed by component name
 * @returns {Promise<import("./testsuite.js").Suite[]>} Parsed testsuites
 */
export async function loadComponentSuites(componentTests) {
  const tests = Object.keys(componentTests).map((name) => componentTests[name]);
  const suites = await asyncSeries(tests, (source) => {
    try {
      return Promise.resolve(testsuite.loadYAML(source));
    } catch {
      // ignore, could be non fbp-spec test
      // TODO: include tests type in FBP protocol, so we know whether this is error or legit
      return Promise.resolve(null);
    }
  });
  return suites.filter((s) => s !== null).reduce((a, b) => a.concat(b), []);
}

/**
 * Get the testsuites attached to components on the runtime.
 * Requires the runtime to support the 'component:getsource' capability.
 * @param {Runner} runner Runner connected to the runtime
 * @returns {Promise<import("./testsuite.js").Suite[]>} Testsuites
 */
export async function getComponentSuites(runner) {
  const caps = await protocol.getCapabilities(runner.client);
  if (caps.indexOf("component:getsource") === -1) {
    return [];
  }

  const tests = await protocol.getComponentTests(runner.client);
  const suites = await loadComponentSuites(tests);
  debug("get component suites", Object.keys(tests).length, suites.length);
  return suites;
}

/**
 * Run all the given suites, updating the testcase objects in-place
 * with .passed and .error states as tests are run.
 * @param {Runner} runner Runner to run with
 * @param {import("./testsuite.js").Suite[]} suites Suites to run
 * @param {(suites: import("./testsuite.js").Suite[]) => void} [updateCallback] Called when test state is updated
 * @returns {Promise<void>} Resolves when all suites have run
 */
export async function runAll(runner, suites, updateCallback = () => {}) {
  debug(
    "running suites",
    suites.map((s) => s.name),
  );

  /**
   * Run and check a single testcase, storing the result on the testcase.
   * @param {import("./testsuite.js").Testcase} testcase Testcase to run
   * @returns {Promise<void>}
   */
  async function runTest(testcase) {
    const results = await runTestAndCheck(runner, testcase);
    // ignore error to not bail out early
    const resultRecord = /** @type {Record<string, *>} */ (results);
    for (const key of Object.keys(resultRecord)) {
      testcase[key] = resultRecord[key];
    }
    if (testcase.error instanceof Error) {
      testcase.error = testcase.error.message;
    }
    debug(`ran test "${testcase.name}"`, testcase.passed);
    updateCallback(suites);
  }

  for (const suite of suites) {
    try {
      await runSuite(runner, suite, runTest); // eslint-disable-line no-await-in-loop
    } catch (err) {
      debug("suite failed", err);
    }
  }
}
