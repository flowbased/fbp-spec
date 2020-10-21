const debug = require('debug')('fbp-spec:subprocess');

exports.start = function start(command, options, callback) {
  let childProcess;
  try {
    // eslint-disable-next-line global-require
    childProcess = require('child_process');
  } catch (error) {
    callback(error);
    return null;
  }

  if ((options.timeout == null)) {
    const opts = options;
    opts.timeout = 300;
  }

  let started = false;
  let stderr = '';

  // FIXME: using sh to interpret command will Unix-specific
  const prog = 'sh';
  const args = ['-c', command];
  const child = childProcess.spawn(prog, args);

  debug('spawned', `'${prog} ${args.join(' ')}'`);
  debug('waiting for output');

  child.on('error', (err) => callback(err));

  child.stdout.on('data', (data) => {
    const dataString = data.toString();
    debug('sub stdout', dataString);
    if (!started) {
      debug('got output, transitioning to started');
      started = true;
      // give process some time to open port
      setTimeout(callback, 100);
    }
  });

  child.stderr.on('data', (data) => {
    const dataString = data.toString();
    stderr += dataString;
    debug('sub stderr', dataString);
    if (!started) {
      debug('got stderr, failing');
      started = true;
      callback(new Error(`Subprocess wrote on stderr: '${stderr}'`));
    }
  });

  setTimeout(() => {
    if (!started) {
      debug('timeout waiting for output, assuming started');
      started = true;
      callback(null);
    }
  },
  options.timeout);

  return child;
};
