const program = require('commander');
const debug = require('debug')('fbp-spec:cli');
const testsuite = require('./testsuite');
const runner = require('./runner');
const subprocess = require('./subprocess');

// # Main
function parse(args) {
  const actionHandler = (suites, opts) => {
    const o = opts;
    o.suites = suites;
  };

  program
    .storeOptionsAsProperties(false)
    .passCommandToAction(false)
    .arguments('<suites>')
    .action(actionHandler)
    .option('--address <URL>', 'Address of runtime to connect to', String, 'ws://localhost:3569')
    .option('--secret <secret>', 'Runtime secret', String, null)
    .option('--command <command>', 'Command to launch runtime under test', String, null)
    .option('--start-timeout <seconds>', 'Time to wait for runtime to start', Number, 10)
    .option('--command-timeout <seconds>', 'Max time for a FBP command', Number, 3)
    .parse(args);

  return program;
}

function startRuntime(options, callback) {
  if (!options.command) {
    // we're not responsible for starting it
    callback(null);
    return;
  }
  const subprocessOptions = {};
  subprocess.start(options.command, subprocessOptions, callback);
}

function hasErrors(suites) {
  let failures = 0;
  suites.forEach((s) => {
    s.cases.forEach((c) => {
      if (c.error) { failures += 1; }
    });
  });
  return failures > 0;
}

function runOptions(options, onUpdate, callback) {
  let suites = [];
  if (options.suites) { suites = testsuite.getSuitesSync(options.suites); }
  let child = null;

  function cleanReturn(err) {
    if (child) {
      child.kill();
    }
    callback(err, suites);
  }

  const def = {
    protocol: 'websocket',
    address: options.address,
    secret: options.secret || '',
  };

  debug('runtime info', def);

  const runnerOptions = {
    connectTimeout: options.startTimeout * 1000,
    commandTimeout: options.commandTimeout * 1000,
  };

  const ru = new runner.Runner(def, runnerOptions);
  child = startRuntime(options, (err) => {
    if (err) {
      cleanReturn(err);
      return;
    }

    ru.connect((connectErr) => {
      if (connectErr) {
        cleanReturn(connectErr);
        return;
      }

      // TODO: move this into runAll??
      runner.getComponentSuites(ru, (getSuitesErr, componentSuites) => {
        if (getSuitesErr) {
          cleanReturn(getSuitesErr);
          return;
        }
        suites = suites.concat(componentSuites);

        runner.runAll(ru, suites, onUpdate, (runErr) => {
          if (runErr) {
            cleanReturn(runErr);
            return;
          }

          ru.disconnect((disconnectErr) => cleanReturn(disconnectErr));
        });
      });
    });
  });
}

function testStatusText(suites) {
  const results = [];
  const ident = '  ';
  suites.forEach((s) => {
    s.cases.forEach((c) => {
      if ((c.passed == null) || c.shown) { return; }
      if (!s.titleshown) { results.push(`${s.name}`); }

      // bit hacky, mutates suites
      const suite = s;
      const testCase = c;
      suite.titleshown = true;
      testCase.shown = true;

      let res = c.passed ? '✓' : `✗ Error: ${c.error}`;
      if (c.skip) { res = `SKIP: ${c.skip}`; }
      results.push(`${ident}${c.name}\n${ident + ident}${c.assertion}: ${res}`);
    });
  });
  return results;
}

function main() {
  const cmd = parse(process.argv);
  const options = cmd.opts();

  function onUpdate(suites) {
    const r = testStatusText(suites);
    console.log(r.join('\n'));
  }

  runOptions(options, onUpdate, (err, suites) => {
    if (err) { throw err; }
    const exitStatus = hasErrors(suites) ? 2 : 0;
    process.exit(exitStatus);
  });
}

exports.main = main;
