/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const testsuite = require('./testsuite');
const runner = require('./runner');
const subprocess = require('./subprocess');

const debug = require('debug')('fbp-spec:cli');

//# Main
const parse = function(args) {
  const program = require('commander');

  const actionHandler = (suites, opts) => opts.suites = suites;

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
    .parse(process.argv);

  return program;
};


const startRuntime = function(options, callback) {

  if (!options.command) { // we're not responsible for starting it
    callback(null);
    return null;
  }
  const subprocessOptions = {};
  return subprocess.start(options.command, subprocessOptions, callback);
};

const hasErrors = function(suites) {
  let failures = 0;
  for (let s of Array.from(suites)) {
    for (let c of Array.from(s.cases)) {
      if (c.error) { failures += 1; }
    }
  }
  return failures > 0;
};

const runOptions = function(options, onUpdate, callback) {
  let suites = [];
  if (options.suites) { suites = testsuite.getSuitesSync(options.suites); }
  let child = null;

  const cleanReturn = function(err) {
    if (child) { child.kill(); }
    return callback(err, suites);
  };

  const def = {
    protocol: 'websocket',
    address: options.address,
    secret: options.secret || ''
  };

  debug('runtime info', def);

  const runnerOptions = {
    connectTimeout: options.startTimeout*1000,
    commandTimeout: options.commandTimeout*1000
  };

  const ru = new runner.Runner(def, runnerOptions);
  return child = startRuntime(options, function(err) {
    if (err) { cleanReturn(err); }

    return ru.connect(function(err) {
      if (err) { cleanReturn(err); }

      // TODO: move this into runAll??
      return runner.getComponentSuites(ru, function(err, componentSuites) {
          if (err) { cleanReturn(err); }
          suites = suites.concat(componentSuites);

          return runner.runAll(ru, suites, onUpdate, function(err) {
            if (err) { cleanReturn(err); }

            return ru.disconnect(err => cleanReturn(err));
          });
      });
    });
  });
};

const testStatusText = function(suites) {
  const results = [];
  const ident = '  ';
  for (let s of Array.from(suites)) {
    for (let c of Array.from(s.cases)) {
      if ((c.passed == null) || c.shown) { continue; }
      if (!s.titleshown) { results.push(`${s.name}`); }
      s.titleshown = true;
      c.shown = true; // bit hacky, mutates suites
      let res = c.passed ? '✓' : `✗ Error: ${c.error}`;
      if (c.skip) { res = `SKIP: ${c.skip}`; }
      results.push(`${ident}${c.name}\n${ident+ident}${c.assertion}: ${res}`);
    }
  }
  return results;
};

const main = function() {
  const cmd = parse(process.argv);
  const options = cmd.opts();

  const onUpdate = function(suites) {
    const r = testStatusText(suites);
    return console.log(r.join('\n'));
  };

  return runOptions(options, onUpdate, function(err, suites) {
    if (err) { throw err; }
    const exitStatus = hasErrors(suites) ? 2 : 0;
    return process.exit(exitStatus);
  });
};


exports.main = main;
