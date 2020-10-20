/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

//# Run Mocha testcases using fbp-spec as a runner/frontend
//# Intended to allow existing Mocha testcases to be seen and executed
//# from a FBP protocol client like Flowhub, without requiring them
//# to be rewritten as fbp-spec tests
//# This is especially useful to allow partial and gradual migration of existing test suites
//# See also ./mocha.coffee, which can be used in combination

// Partially based on example code from https://github.com/mochajs/mocha/wiki/Third-party-UIs

let main, setup;
const fs = require('fs');
const path = require('path');
const http = require('http');
const websocket = require('./websocket'); // FIXME: split out transport interface of noflo-runtime-*, use that directly
const Mocha = require('mocha');

const debug = require('debug')('fbp-spec:mochacompat');
const testsuite = require('./testsuite');

const loadTests = function(files) {
  const options = {};
  const mocha = new Mocha(options);

  for (let f of Array.from(files)) {
    const resolved = require.resolve(f);
    delete require.cache[resolved]; // clear module cache
    mocha.addFile(f);
  }
  mocha.loadFiles();
  return mocha;
};

// similar to mocha.run(), but files must be loaded beforehand
const runTests = function(mocha, progress, callback) {

  const {
    suite
  } = mocha;
  const {
    options
  } = mocha;
  options.files = mocha.files;
  const runner = new Mocha.Runner(suite, options.delay);
  const registerReporter = function(r) {
    runner.on('pass', test => progress(null, test));
    return runner.on('fail', (test, err) => progress(err, test));
  };

  mocha.reporter(registerReporter, {});
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
    mocha._growl(runner, reporter);
  }
  if (options.useColors != null) {
    Mocha.reporters.Base.useColors = options.useColors;
  }
  Mocha.reporters.Base.inlineDiffs = options.useInlineDiffs;

  const done = function(failures) {
    if (reporter.done) {
      return reporter.done(failures, callback);
    } else {
      return callback && callback(failures);
    }
  };

  return runner.run(done);
};

const testId = function(fullname) {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(fullname);
  return hash.digest('hex').substr(0, 10);
};

var loadSuite = function(fbpSuite, suite) {

  for (let testcase of Array.from(suite.tests)) {
    //console.log 't', testcase

    const fullName = fbpSuite.name + testcase.parent.title + testcase.title; // FIXME: make the full name recursive
    const id = testId(fullName); // FIXME: salt so it does not collide
    testcase._fbpid = id;
    const fbpCase = {
      name: testcase.parent.title,
      assertion: testcase.title,
      _id: id,
      inputs: {
        test: id
      },
      expect: {
        error: {
          noterror: null
        }
      }
    };

    fbpSuite.cases.push(fbpCase);
  }

  // load recursively
  return Array.from(suite.suites).map((sub) =>
    loadSuite(fbpSuite, sub));
};

const buildFbpSpecs = function(mocha) {
  const specs = [];

  const top = mocha.suite;
  for (let suite of Array.from(top.suites)) {
    //console.log 's', suite

    const fbpSuite = testsuite.create({
      name: `${suite.title} (Mocha tests)`,
      fixture: {
        type: 'fbp',
        data: `\
# @runtime fbp-spec-mocha

INPORT=runTest.IN:TEST
OUTPORT=runTest.ERROR:ERROR

runTest(mocha/LoadTestCase) OUT -> IN verifyResult(mocha/CheckResults)\
`
      }
    });

    loadSuite(fbpSuite, suite);
    specs.push(fbpSuite);
  }

  return specs;
};

const dumpSpecs = function(suites) {
  let jsyaml;
  if ((typeof window !== 'undefined' && window !== null ? window.jsyaml : undefined) != null) { ({
    jsyaml
  } = window); }
  if (!jsyaml) { jsyaml = require('js-yaml'); }

  let str = "";
  const delimiter = '---\n';
  for (let s of Array.from(suites)) {
    str += `${jsyaml.safeDump(s)}`;
    if (suites.length > 1) { str += delimiter; }
  }

  return str;
};

const discoverHost = function(preferred_iface) {
  const os = require('os'); // node.js only

  const ifaces = os.networkInterfaces();
  let address = undefined;
  let int_address = undefined;

  const filter = function(connection) {
    if (connection.family !== 'IPv4') {
      return;
    }
    if (connection.internal) {
      int_address = connection.address;
    } else {
      ({
        address
      } = connection);
    }
  };

  if ((typeof preferred_iface === 'string') && Array.from(ifaces).includes(preferred_iface)) {
    ifaces[preferred_iface].forEach(filter);
  } else {
    for (let device in ifaces) {
      ifaces[device].forEach(filter);
    }
  }
  return address || int_address;
};

const knownUnsupportedCommands = (p, c) => false;

const fbpComponentName = s => // TODO: use topic/filename?
`fbp-spec-mocha/${s.name}`;

const fbpComponentFromSpec = function(s) {
  // component:component
  let p;
  return p = {
    name: fbpComponentName(s),
    subgraph: false,
    inPorts: [],
    outPorts: []
  };
};

const fbpSourceFromSpec = function(s) {
  // component:source message, :getsource response
  let p;
  const serialized = dumpSpecs([s]);
  return p = {
    name: fbpComponentName(s),
    code: '',
    language: 'whitespace',
    tests: serialized
  };
};

const handleFbpCommand = function(state, runtime, mocha, specs, protocol, command, payload, context) {

  let s;
  const updateStatus = function(news, event) {
    if (news.started != null) { state.started = news.started; }
    if (news.running != null) { state.running = news.running; }
    const runtimeState = { started: state.started, running: state.running, graph: payload.graph };
    debug('update status', runtimeState);
    return runtime.send('network', event, runtimeState, context);
  };

  //sendEvent = (e) ->
  //  runtime.send e.protocol, e.command, e.payload, context
  const ackMessage = () => // reply with same message as we got in
  runtime.send(protocol, command, payload, context);

  //# Runtime
  if ((protocol === 'runtime') && (command === 'getruntime')) {
    const capabilities = [
      'protocol:graph', // read-only from client
      'protocol:component', // read-only from client
      'protocol:network',
      'protocol:runtime',
      'component:getsource'
    ];
    const info = {
      type: 'fbp-spec-mocha',
      version: '0.5',
      capabilities,
      allCapabilities: capabilities,
      graph: 'default/main' // HACK, so Flowhub will ask for our graph
    };
    return runtime.send('runtime', 'runtime', info, context);
    //sendGraphs mytrace, send, (err) -> # XXX: right place?
      // ignored

  } else if ((protocol === 'runtime') && (command === 'packet')) {
    debug('test message', payload, state.running);

    if ((payload.port !== 'test') || (payload.event !== 'data')) {
      debug('unexpected test message format');
      return;
    }

    state.currentTest = payload.payload;

    // collect results of completed tests
    const testDone = function(err, test) {
      debug('test completed', test._fbpid, err, Object.keys(state.completedTests).length);
      state.completedTests[test._fbpid] = { test, err };
      return checkSendCurrentTest();
    };

    var checkSendCurrentTest = function() {
      const completed = state.completedTests[state.currentTest];
      debug('checking for', state.currentTest, (completed != null));
      if (completed) {
        const m = {
          graph: state.graph,
          event: 'data',
          port: 'error',
          payload: completed.err
        };
        runtime.send('runtime', 'packet', m, context);
        return delete state.completedTests[state.currentTest];
      }
    };

    checkSendCurrentTest(); // we might have completed it already

    if (!state.running) {
      runTests(mocha, testDone, f => updateStatus({ running: false }, 'status'));

      return updateStatus({ running: true }, 'status');
    }

  //# Graph
  } else if ((protocol === 'graph') && (command === 'addnode')) {
    return ackMessage();
  } else if ((protocol === 'graph') && (command === 'addedge')) {
    return ackMessage();
  } else if ((protocol === 'graph') && (command === 'addinport')) {
    return ackMessage();
  } else if ((protocol === 'graph') && (command === 'addoutport')) {
    return ackMessage();
  } else if ((protocol === 'graph') && (command === 'clear')) {
    state.graph = payload.id;
    debug('new graph', state.graph);
    return ackMessage();

  //# Network
  } else if ((protocol === 'network') && (command === 'getstatus')) {
    return runtime.send('network', 'status', state, context);

  } else if ((protocol === 'network') && (command === 'start')) {
    debug('FBP network start');
    return updateStatus({ started: true, running: false, graph: payload.graph }, 'started');
  } else if ((protocol === 'network') && (command === 'stop')) {
    debug('FBP network stop');
    return updateStatus({ started: false, running: false, graph: payload.graph }, 'stopped');

  //# Component
  } else if ((protocol === 'component') && (command === 'list')) {
    // one fake component per Mocha suite
    for (s of Array.from(specs)) {
      runtime.send('component', 'component', fbpComponentFromSpec(s), context);
    }
    return runtime.send('component', 'componentsready', specs.length, context);

  } else if ((protocol === 'component') && (command === 'getsource')) {
    // one fake component per Mocha suite
    let found = null;
    for (s of Array.from(specs)) {
      const componentName = fbpComponentName(s);
      if (componentName === payload.name) {
        found = s;
      }
    }
    debug('component getsource', `'${payload.name}'`, found != null ? found.name : undefined);
    if (found) {
      return runtime.send('component', 'source', fbpSourceFromSpec(found), context);
    }

  } else if (knownUnsupportedCommands(protocol, command)) {
    // ignored
  } else {
    return debug('Warning: Unknown FBP protocol message', protocol, command);
  }
};

//# Commandline things
const normalizeOptions = function(options) {
  let match;
  if (options.host === 'autodetect') {
    options.host = discoverHost();
  } else if (match = /autodetect\(([a-z0-9]+)\)/.exec(options.host)) {
    options.host = discoverHost(match[1]);
  }

  if (!options.port) { options.port = 3333; }

  return options;
};

const parse = function(args) {
  const program = require('commander');

  const actionHandler = (suites, opts) => opts.suites = suites;

  // TODO: take list of files as input instead, to be more mocha compatible
  program
    .storeOptionsAsProperties(false)
    .passCommandToAction(false)
    .arguments('<files...>')
    .action(actionHandler)
    .option('--host <hostname>', 'Hostname we serve on, for live-url', String, 'autodetect')
    .option('--port <PORT>', 'Command to launch runtime under test', Number, 3333)
    .parse(process.argv);

  return program;
};

exports.setup = (setup = function(options, callback) {
  options = normalizeOptions(options);

  const mocha = loadTests(options.files);
  const specs = buildFbpSpecs(mocha);

  const state = {
    started: false,
    running: false,
    currentTest: null,
    graph: null,
    specs,
    completedTests: {} // 'id' -> { err: ?Error, test: MochaTest }
  };
  const httpServer = new http.Server;
  const runtime = websocket(httpServer, {});
  runtime.receive = (protocol, command, payload, context) => handleFbpCommand(state, runtime, mocha, specs, protocol, command, payload, context);

  return httpServer.listen(options.port, err => callback(err, state, httpServer));
});

exports.main = (main = function() {

  const cmd = parse(process.argv);
  const options = cmd.opts();

  return setup(options, function(err, state) {
    if (err) { throw err; }
    console.log(`fbp-spec-mocha started on ws://${options.host}:${options.port}`);
    return console.log(`found ${state.specs.length} test suites`);
  });
});

if (!module.parent) { main(); }
