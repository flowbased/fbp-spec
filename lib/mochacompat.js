/* eslint-env browser, node */
// # Run Mocha testcases using fbp-spec as a runner/frontend
// # Intended to allow existing Mocha testcases to be seen and executed
// # from a FBP protocol client like Flowhub, without requiring them
// # to be rewritten as fbp-spec tests
// # This is especially useful to allow partial and gradual migration of existing test suites
// # See also ./mocha.coffee, which can be used in combination

// Partially based on example code from https://github.com/mochajs/mocha/wiki/Third-party-UIs

const http = require('http');
const Mocha = require('mocha');
const crypto = require('crypto');
const debug = require('debug')('fbp-spec:mochacompat');

// FIXME: split out transport interface of noflo-runtime-*, use that directly
const websocket = require('./websocket');

const testsuite = require('./testsuite');

function loadTests(files) {
  const options = {};
  const mocha = new Mocha(options);

  files.forEach((f) => {
    const resolved = require.resolve(f);
    delete require.cache[resolved]; // clear module cache
    mocha.addFile(f);
  });
  mocha.loadFiles();
  return mocha;
}

// similar to mocha.run(), but files must be loaded beforehand
function runTests(mocha, progress, callback) {
  const {
    suite,
  } = mocha;
  const {
    options,
  } = mocha;
  options.files = mocha.files;
  const runner = new Mocha.Runner(suite, options.delay);
  function registerReporter() {
    runner.on('pass', (test) => progress(null, test));
    runner.on('fail', (test, err) => progress(err, test));
  }

  mocha.reporter(registerReporter, {});
  // eslint-disable-next-line no-underscore-dangle
  const reporter = new mocha._reporter(runner, options);

  runner.ignoreLeaks = options.ignoreLeaks !== false;
  runner.fullStackTrace = options.fullStackTrace;
  runner.asyncOnly = options.asyncOnly;
  runner.allowUncaught = options.allowUncaught;
  if (options.grep) {
    runner.grep(options.grep, options.invert);
  }
  if (options.globals) {
    runner.globals(options.globals);
  }
  if (options.growl) {
    // eslint-disable-next-line no-underscore-dangle
    mocha._growl(runner, reporter);
  }
  if (options.useColors != null) {
    Mocha.reporters.Base.useColors = options.useColors;
  }
  Mocha.reporters.Base.inlineDiffs = options.useInlineDiffs;

  function done(failures) {
    if (reporter.done) {
      reporter.done(failures, callback);
      return;
    }
    callback(failures);
  }

  runner.run(done);
}

function testId(fullname) {
  const hash = crypto.createHash('sha256');
  hash.update(fullname);
  return hash.digest('hex').substr(0, 10);
}

function loadSuite(fbpSuite, suite) {
  suite.tests.forEach((testcase) => {
    // FIXME: make the full name recursive
    const fullName = fbpSuite.name + testcase.parent.title + testcase.title;
    // FIXME: salt so it does not collide
    const id = testId(fullName);
    const c = testcase;
    // eslint-disable-next-line no-underscore-dangle
    c._fbpid = id;
    const fbpCase = {
      name: testcase.parent.title,
      assertion: testcase.title,
      _id: id,
      inputs: {
        test: id,
      },
      expect: {
        error: {
          noterror: null,
        },
      },
    };

    fbpSuite.cases.push(fbpCase);
  });

  // load recursively
  suite.suites.forEach((sub) => {
    loadSuite(fbpSuite, sub);
  });
}

function buildFbpSpecs(mocha) {
  const specs = [];

  const top = mocha.suite;
  top.suites.forEach((suite) => {
    // console.log 's', suite

    const fbpSuite = testsuite.create({
      name: `${suite.title} (Mocha tests)`,
      fixture: {
        type: 'fbp',
        data: `\
# @runtime fbp-spec-mocha

INPORT=runTest.IN:TEST
OUTPORT=runTest.ERROR:ERROR

runTest(mocha/LoadTestCase) OUT -> IN verifyResult(mocha/CheckResults)\
`,
      },
    });

    loadSuite(fbpSuite, suite);
    specs.push(fbpSuite);
  });

  return specs;
}

function dumpSpecs(suites) {
  // eslint-disable-next-line global-require
  const yaml = window.jsyaml ? window.jsyaml : require('js-yaml');

  let str = '';
  const delimiter = '---\n';
  suites.forEach((s) => {
    str += `${yaml.safeDump(s)}`;
    if (suites.length > 1) { str += delimiter; }
  });

  return str;
}

function discoverHost(preferredIface) {
  // eslint-disable-next-line global-require
  const os = require('os'); // node.js only

  const ifaces = os.networkInterfaces();
  let address;
  let intAddress;

  function filter(connection) {
    if (connection.family !== 'IPv4') {
      return;
    }
    if (connection.internal) {
      intAddress = connection.address;
    } else {
      ({
        address,
      } = connection);
    }
  }

  if ((typeof preferredIface === 'string') && Array.from(ifaces).includes(preferredIface)) {
    ifaces[preferredIface].forEach(filter);
  } else {
    Object.keys(ifaces).forEach((device) => {
      ifaces[device].forEach(filter);
    });
  }
  return address || intAddress;
}

const knownUnsupportedCommands = () => false;

function fbpComponentName(s) {
  // TODO: use topic/filename?
  return `fbp-spec-mocha/${s.name}`;
}

function fbpComponentFromSpec(s) {
  // component:component
  return {
    name: fbpComponentName(s),
    subgraph: false,
    inPorts: [],
    outPorts: [],
  };
}

function fbpSourceFromSpec(s) {
  // component:source message, :getsource response
  const serialized = dumpSpecs([s]);
  return {
    name: fbpComponentName(s),
    code: '',
    language: 'whitespace',
    tests: serialized,
  };
}

function handleFbpCommand(
  originalState,
  runtime,
  mocha,
  specs,
  protocol,
  command,
  payload,
  context,
) {
  const state = originalState;
  function updateStatus(news, event) {
    if (news.started != null) { state.started = news.started; }
    if (news.running != null) { state.running = news.running; }
    const runtimeState = { started: state.started, running: state.running, graph: payload.graph };
    debug('update status', runtimeState);
    runtime.send('network', event, runtimeState, context);
  }

  // sendEvent = (e) ->
  //  runtime.send e.protocol, e.command, e.payload, context
  function ackMessage() {
    // reply with same message as we got in
    runtime.send(protocol, command, payload, context);
  }

  function checkSendCurrentTest() {
    const completed = state.completedTests[state.currentTest];
    debug('checking for', state.currentTest, (completed != null));
    if (completed) {
      const m = {
        graph: state.graph,
        event: 'data',
        port: 'error',
        payload: completed.err,
      };
      runtime.send('runtime', 'packet', m, context);
      delete state.completedTests[state.currentTest];
    }
  }

  // collect results of completed tests
  function testDone(err, test) {
    // eslint-disable-next-line no-underscore-dangle
    debug('test completed', test._fbpid, err, Object.keys(state.completedTests).length);
    // eslint-disable-next-line no-underscore-dangle
    state.completedTests[test._fbpid] = { test, err };
    checkSendCurrentTest();
  }

  // # Runtime
  if ((protocol === 'runtime') && (command === 'getruntime')) {
    const capabilities = [
      'protocol:graph', // read-only from client
      'protocol:component', // read-only from client
      'protocol:network',
      'protocol:runtime',
      'component:getsource',
    ];
    const info = {
      type: 'fbp-spec-mocha',
      version: '0.5',
      capabilities,
      allCapabilities: capabilities,
      graph: 'default/main', // HACK, so Flowhub will ask for our graph
    };
    runtime.send('runtime', 'runtime', info, context);
    // sendGraphs mytrace, send, (err) -> # XXX: right place?
    // ignored
  } if ((protocol === 'runtime') && (command === 'packet')) {
    debug('test message', payload, state.running);

    if ((payload.port !== 'test') || (payload.event !== 'data')) {
      debug('unexpected test message format');
      return;
    }

    state.currentTest = payload.payload;

    checkSendCurrentTest(); // we might have completed it already

    if (!state.running) {
      runTests(mocha, testDone, () => updateStatus({ running: false }, 'status'));

      updateStatus({ running: true }, 'status');
    }

  // # Graph
  } else if ((protocol === 'graph') && (command === 'addnode')) {
    ackMessage();
  } else if ((protocol === 'graph') && (command === 'addedge')) {
    ackMessage();
  } else if ((protocol === 'graph') && (command === 'addinport')) {
    ackMessage();
  } else if ((protocol === 'graph') && (command === 'addoutport')) {
    ackMessage();
  } else if ((protocol === 'graph') && (command === 'clear')) {
    state.graph = payload.id;
    debug('new graph', state.graph);
    ackMessage();

  // # Network
  } else if ((protocol === 'network') && (command === 'getstatus')) {
    runtime.send('network', 'status', state, context);
  } else if ((protocol === 'network') && (command === 'start')) {
    debug('FBP network start');
    updateStatus({ started: true, running: false, graph: payload.graph }, 'started');
  } else if ((protocol === 'network') && (command === 'stop')) {
    debug('FBP network stop');
    updateStatus({ started: false, running: false, graph: payload.graph }, 'stopped');

  // # Component
  } else if ((protocol === 'component') && (command === 'list')) {
    // one fake component per Mocha suite
    specs.forEach((s) => {
      runtime.send('component', 'component', fbpComponentFromSpec(s), context);
    });
    runtime.send('component', 'componentsready', specs.length, context);
  } else if ((protocol === 'component') && (command === 'getsource')) {
    // one fake component per Mocha suite
    let found = null;
    specs.forEach((s) => {
      const componentName = fbpComponentName(s);
      if (componentName === payload.name) {
        found = s;
      }
    });
    debug('component getsource', `'${payload.name}'`, found != null ? found.name : undefined);
    if (found) {
      runtime.send('component', 'source', fbpSourceFromSpec(found), context);
    }
  } else if (knownUnsupportedCommands(protocol, command)) {
    // ignored
  } else {
    debug('Warning: Unknown FBP protocol message', protocol, command);
  }
}

// # Commandline things
function normalizeOptions(options) {
  let match;
  let discovered;
  if (options.host === 'autodetect') {
    discovered = discoverHost();
  } else if (/autodetect\(([a-z0-9]+)\)/.exec(options.host)) {
    discovered = discoverHost(match[1]);
  }

  return {
    ...options,
    host: discovered || options.host,
    port: options.port || 3333,
  };
}

function parse(args) {
  // eslint-disable-next-line global-require
  const program = require('commander');

  const actionHandler = (suites, opts) => {
    const o = opts;
    o.suites = suites;
  };

  // TODO: take list of files as input instead, to be more mocha compatible
  program
    .storeOptionsAsProperties(false)
    .passCommandToAction(false)
    .arguments('<files...>')
    .action(actionHandler)
    .option('--host <hostname>', 'Hostname we serve on, for live-url', String, 'autodetect')
    .option('--port <PORT>', 'Command to launch runtime under test', Number, 3333)
    .parse(args);

  return program;
}

exports.setup = function setup(options, callback) {
  const opts = normalizeOptions(options);

  const mocha = loadTests(opts.files);
  const specs = buildFbpSpecs(mocha);

  const state = {
    started: false,
    running: false,
    currentTest: null,
    graph: null,
    specs,
    completedTests: {}, // 'id' -> { err: ?Error, test: MochaTest }
  };
  const httpServer = new http.Server();
  const runtime = websocket(httpServer, {});
  runtime.receive = (protocol, command, payload, context) => {
    handleFbpCommand(state, runtime, mocha, specs, protocol, command, payload, context);
  };

  httpServer.listen(options.port, (err) => callback(err, state, httpServer));
};

exports.main = function main() {
  const cmd = parse(process.argv);
  const options = cmd.opts();

  exports.setup(options, (err, state) => {
    if (err) { throw err; }
    console.log(`fbp-spec-mocha started on ws://${options.host}:${options.port}`);
    console.log(`found ${state.specs.length} test suites`);
  });
};

if (!module.parent) {
  exports.main();
}
