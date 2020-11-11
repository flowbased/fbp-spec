const program = require('commander');
const debug = require('debug')('fbp-spec:cli');
const { stat, mkdir, writeFile } = require('fs');
const { resolve, relative } = require('path');
const slug = require('slug');
const testsuite = require('./testsuite');
const runner = require('./runner');
const subprocess = require('./subprocess');

const traces = [];

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
    .option('--component-tests', 'Load component tests from runtime')
    .option('--trace', 'Store a replayable Flowtrace for each test run')
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

function ensureTracedir(options, callback) {
  if (!options.trace) {
    callback(null);
    return;
  }
  const tracePath = resolve(process.cwd(), './.flowtrace');
  stat(tracePath, (err) => {
    if (!err) {
      callback(null);
      return;
    }
    mkdir(tracePath, callback);
  });
}

function storeTrace(options, traceId, testcaseName, trace) {
  if (!options.trace) {
    return;
  }
  const date = new Date().toISOString().substr(0, 10);
  const fileName = slug(`${date}-${traceId}-${testcaseName}`);
  const tracePath = resolve(process.cwd(), `./.flowtrace/${fileName}.json`);
  writeFile(tracePath, JSON.stringify(trace, null, 2), (err) => {
    if (err) {
      console.error(err);
    }
    traces.push(tracePath);
  });
}

function runOptions(options, onUpdate, callback) {
  let child = null;
  let allSuites = [];

  function cleanReturn(err) {
    if (child) {
      child.kill();
    }
    callback(err, allSuites);
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

  if (options.trace) {
    runnerOptions.traceCallback = (graphId, testcaseName, trace) => {
      storeTrace(options, graphId, testcaseName, trace);
    };
  }

  const ru = new runner.Runner(def, runnerOptions);
  ensureTracedir(options, (dirErr) => {
    if (dirErr) {
      cleanReturn(dirErr);
      return;
    }

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

        testsuite.getSuites(options.suites, (getSuitesErr, suites) => {
          if (getSuitesErr) {
            cleanReturn(getSuitesErr);
            return;
          }
          allSuites = allSuites.concat(suites);

          if (options.componentTests) {
            // TODO: move this into runAll??
            runner.getComponentSuites(ru, (getComponentSuitesErr, componentSuites) => {
              if (getComponentSuitesErr) {
                cleanReturn(getComponentSuitesErr);
                return;
              }
              allSuites = allSuites.concat(componentSuites);
              runner.runAll(ru, allSuites, onUpdate, (runErr) => {
                if (runErr) {
                  cleanReturn(runErr);
                  return;
                }
                ru.disconnect((disconnectErr) => cleanReturn(disconnectErr));
              });
            });
            return;
          }
          runner.runAll(ru, allSuites, onUpdate, (runErr) => {
            if (runErr) {
              cleanReturn(runErr);
              return;
            }
            ru.disconnect((disconnectErr) => cleanReturn(disconnectErr));
          });
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

    if (traces.length) {
      console.log('\nFlowtraces produced:');
      traces.forEach((tracePath) => {
        console.log(`- ${relative(process.cwd(), tracePath)}`);
      });
    }

    const exitStatus = hasErrors(suites) ? 2 : 0;
    process.exit(exitStatus);
  });
}

exports.main = main;
