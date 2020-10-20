/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const common = require('./common');
const debug = require('debug')('fbp-spec:subprocess');

exports.start = function(command, options, callback) {
  let child_process;
  try {
    child_process = require('child_process');
  } catch (error) {
    const err = error;
    return callback(err);
  }

  if ((options.timeout == null)) { options.timeout = 300; }

  let started = false;
  let stderr = "";
  let stdout = "";

  // FIXME: using sh to interpret command will Unix-specific
  const prog = 'sh';
  const args = [ '-c', command ];
  const child = child_process.spawn(prog, args);

  debug('spawned', `'${prog} ${args.join(' ')}'`);
  debug('waiting for output');

  child.on('error', err => callback(err));

  child.stdout.on('data', function(data) {
    data = data.toString();
    stdout += data;
    debug('sub stdout', data);
    if (!started) {
      debug('got output, transitioning to started');
      started = true;
      // give process some time to open port
      return setTimeout(callback, 100);
    }
  });

  child.stderr.on('data', function(data) {
    data = data.toString();
    stderr += data;
    debug('sub stderr', data);
    if (!started) {
      debug('got stderr, failing');
      started = true;
      return callback(new Error(`Subprocess wrote on stderr: '${stderr}'`));
    }
  });

  setTimeout(function() {
    if (!started) {
      debug('timeout waiting for output, assuming started');
      started = true;
      return callback(null);
    }
  }
  , options.timeout);

  return child;
};
