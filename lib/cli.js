/**
 * Command-line interface for running fbp-spec testsuites against an FBP runtime.
 * @module lib/cli
 */

import { mkdir, stat, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import debugLib from "debug";

import { getComponentSuites, Runner, runAll } from "./runner.js";
import { start } from "./subprocess.js";
import { getSuites } from "./testsuite.js";

const debug = debugLib("fbp-spec:cli");

/** @typedef {import("./testsuite.js").Suite} Suite */

/** @type {string[]} */
const traces = [];

const usage = `Usage: fbp-spec [options] <suites...>

Run fbp-spec testsuites against an FBP runtime.

Options:
  --address <URL>              Address of runtime to connect to (default: ws://localhost:3569)
  --secret <secret>            Runtime secret
  --command <command>          Command to launch runtime under test
  --start-timeout <seconds>    Time to wait for runtime to start (default: 10)
  --command-timeout <seconds>  Max time for a FBP command (default: 3)
  --component-tests            Load component tests from runtime
  --trace                      Store a replayable Flowtrace for each test run
  --help                       Show this help
`;

/**
 * Parse command-line arguments into runner options.
 * @param {string[]} [args] Arguments to parse, defaults to process.argv
 * @returns {{ options: { address: string, secret?: string, command?: string, startTimeout: number, commandTimeout: number, componentTests: boolean, trace: boolean, suites: string[] }, help: boolean }} Parsed options
 */
export function parse(args = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs({
      args,
      options: {
        address: { type: "string", default: "ws://localhost:3569" },
        secret: { type: "string" },
        command: { type: "string" },
        "start-timeout": { type: "string", default: "10" },
        "command-timeout": { type: "string", default: "3" },
        "component-tests": { type: "boolean", default: false },
        trace: { type: "boolean", default: false },
        help: { type: "boolean", default: false },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`${message}\n\n${usage}`);
  }

  const { values, positionals } = parsed;
  const options = {
    address: values.address,
    secret: values.secret,
    command: values.command,
    startTimeout: Number(values["start-timeout"]),
    commandTimeout: Number(values["command-timeout"]),
    componentTests: values["component-tests"],
    trace: values.trace,
    suites: positionals,
  };
  return { options, help: values.help };
}

/**
 * Start the runtime-under-test as a subprocess, if requested.
 * @param {{ command?: string }} options Parsed options
 * @returns {Promise<import('node:child_process').ChildProcess|null>} The child process, or null
 */
async function startRuntime(options) {
  if (!options.command) {
    // we're not responsible for starting it
    return null;
  }
  return start(options.command, {});
}

/**
 * Whether any of the testcases have errors.
 * @param {Suite[]} suites Suites to check
 * @returns {boolean} True if there are failures
 */
export function hasErrors(suites) {
  let failures = 0;
  for (const s of suites) {
    for (const c of s.cases ?? []) {
      if (c.error) {
        failures += 1;
      }
    }
  }
  return failures > 0;
}

/**
 * Ensure the .flowtrace directory exists, if tracing is enabled.
 * @param {{ trace: boolean }} options Parsed options
 * @returns {Promise<void>}
 */
async function ensureTracedir(options) {
  if (!options.trace) {
    return;
  }
  const tracePath = resolve(process.cwd(), "./.flowtrace");
  try {
    await stat(tracePath);
  } catch {
    await mkdir(tracePath);
  }
}

/**
 * Store a Flowtrace on disk, and remember its path for the summary output.
 * @param {{ trace: boolean }} options Parsed options
 * @param {string} traceId ID of the graph the trace was recorded for
 * @param {string} testcaseName Name of the testcase the trace was recorded for
 * @param {object} trace The Flowtrace contents
 * @returns {Promise<void>}
 */
async function storeTrace(options, traceId, testcaseName, trace) {
  if (!options.trace) {
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${date}-${traceId}-${testcaseName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const tracePath = resolve(process.cwd(), `./.flowtrace/${fileName}.json`);
  await writeFile(tracePath, JSON.stringify(trace, null, 2));
  traces.push(tracePath);
}

/**
 * Run the given suites against the runtime, starting and stopping it as needed.
 * @param {{ address: string, secret?: string, command?: string, startTimeout: number, commandTimeout: number, componentTests: boolean, trace: boolean, suites: string[] }} options Parsed options
 * @param {(suites: Suite[]) => void} [onUpdate] Called when test state is updated
 * @returns {Promise<Suite[]>} All run suites, with results filled in
 */
export async function runOptions(options, onUpdate = () => {}) {
  const def = {
    protocol: "websocket",
    address: options.address,
    secret: options.secret || "",
  };

  debug("runtime info", def);

  const runnerOptions = /** @type {import("./runner.js").RunnerOptions} */ ({
    connectTimeout: options.startTimeout * 1000,
    commandTimeout: options.commandTimeout * 1000,
  });

  if (options.trace) {
    runnerOptions.traceCallback = (graphId, testcaseName, trace) =>
      storeTrace(options, graphId, testcaseName, trace);
  }

  const ru = new Runner(def, runnerOptions);
  await ensureTracedir(options);

  let child = null;
  try {
    child = await startRuntime(options);
    await ru.connect();

    let suites = await getSuites(options.suites);
    if (options.componentTests) {
      // TODO: move this into runAll??
      suites = suites.concat(await getComponentSuites(ru));
    }
    await runAll(ru, suites, onUpdate);
    await ru.disconnect();
    return suites;
  } finally {
    child?.kill();
  }
}

/**
 * Produce human-readable status text for the suites.
 * @param {Suite[]} suites Suites with results
 * @returns {string[]} Lines of status text
 */
export function testStatusText(suites) {
  const results = [];
  const ident = "  ";
  for (const s of suites) {
    for (const c of s.cases ?? []) {
      if (c.passed == null || c.shown) {
        continue;
      }
      if (!s.titleshown) {
        results.push(`${s.name}`);
      }

      // bit hacky, mutates suites
      const suite = s;
      const testCase = c;
      suite.titleshown = true;
      testCase.shown = true;

      const res = c.passed ? "✓" : `✗ Error: ${c.error}`;
      results.push(`${ident}${c.name}\n${ident + ident}${c.assertion}: ${res}`);
    }
  }
  return results;
}

/**
 * Main entry point of the fbp-spec command-line tool.
 * @returns {Promise<void>} Exits the process with status 0 or 2
 */
export async function main() {
  let options;
  let help;
  try {
    const parsed = parse();
    ({ options, help } = parsed);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 2;
    return;
  }
  if (help) {
    console.log(usage);
    return;
  }
  if (!options.suites.length) {
    console.error("Error: no suites specified\n");
    console.log(usage);
    process.exitCode = 2;
    return;
  }

  /**
   * Print incremental test results.
   * @param {Suite[]} suites Suites with results
   * @returns {void}
   */
  function onUpdate(suites) {
    const r = testStatusText(suites);
    console.log(r.join("\n"));
  }

  let suites;
  try {
    suites = await runOptions(options, onUpdate);
  } catch (err) {
    console.error(err);
    process.exitCode = 2;
    return;
  }

  if (traces.length) {
    console.log("\nFlowtraces produced:");
    for (const tracePath of traces) {
      console.log(`- ${relative(process.cwd(), tracePath)}`);
    }
  }

  process.exitCode = hasErrors(suites) ? 2 : 0;
}
