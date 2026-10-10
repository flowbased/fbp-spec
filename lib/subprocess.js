/**
 * Start runtimes-under-test as subprocesses.
 * @module lib/subprocess
 */

import debugLib from "debug";

const debug = debugLib("fbp-spec:subprocess");

/**
 * Start a runtime as a subprocess, using sh to interpret the command.
 * Considers the process started once it produces output, or after a timeout.
 * Uses a dynamic import so that this module can also be bundled for browsers.
 * @param {string} command Shell command to launch the runtime
 * @param {{ timeout?: number }} [options] Options; timeout in ms before assuming startup succeeded
 * @returns {Promise<import('node:child_process').ChildProcess>} The spawned child process
 */
export async function start(command, options = {}) {
  const timeout = options.timeout ?? 300;
  const childProcess = await import("node:child_process");

  return new Promise((resolve, reject) => {
    // FIXME: using sh to interpret command will Unix-specific
    const prog = "sh";
    const args = ["-c", command];
    const child = childProcess.spawn(prog, args);

    debug("spawned", `'${prog} ${args.join(" ")}'`);
    debug("waiting for output");

    let started = false;
    let stderr = "";

    child.on("error", (err) => reject(err));

    child.stdout.on("data", (data) => {
      const dataString = data.toString();
      debug("sub stdout", dataString);
      if (!started) {
        debug("got output, transitioning to started");
        started = true;
        // give process some time to open port
        setTimeout(() => resolve(child), 100);
      }
    });

    child.stderr.on("data", (data) => {
      const dataString = data.toString();
      stderr += dataString;
      debug("sub stderr", dataString);
      if (!started) {
        debug("got stderr, failing");
        started = true;
        reject(new Error(`Subprocess wrote on stderr: '${stderr}'`));
      }
    });

    setTimeout(() => {
      if (!started) {
        debug("timeout waiting for output, assuming started");
        started = true;
        resolve(child);
      }
    }, timeout);
  });
}
