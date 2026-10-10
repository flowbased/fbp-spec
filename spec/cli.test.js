import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { hasErrors, parse, testStatusText } from "../lib/cli.js";
import { startDummyRuntime } from "./fixtures/dummy-runtime.js";

const binPath = fileURLToPath(new URL("../bin/fbp-spec", import.meta.url));
/** @param {string} name */
const examplePath = (name) =>
  fileURLToPath(new URL(`../examples/${name}`, import.meta.url));

/**
 * Run the fbp-spec CLI as a subprocess.
 * @param {string[]} args CLI arguments
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>} Process result
 */
function runCli(args) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [binPath, ...args],
      { encoding: "utf-8", timeout: 30000 },
      (err, stdout, stderr) => {
        resolve({
          code: typeof err?.code === "number" ? err.code : 0,
          stdout,
          stderr,
        });
      },
    );
  });
}

describe("CLI", () => {
  /** @type {Awaited<ReturnType<typeof startDummyRuntime>>} */
  let runtime;

  before(async () => {
    runtime = await startDummyRuntime();
  });
  after(async () => {
    await runtime.close();
  });

  describe("parse", () => {
    it("should parse options and positionals", () => {
      const { options, help } = parse([
        "--address",
        "ws://localhost:1234",
        "--secret",
        "s3cret",
        "--start-timeout",
        "2",
        "--command-timeout",
        "5",
        "--component-tests",
        "--trace",
        "examples/simple-passing.yaml",
      ]);
      assert.equal(help, false);
      assert.equal(options.address, "ws://localhost:1234");
      assert.equal(options.secret, "s3cret");
      assert.equal(options.startTimeout, 2);
      assert.equal(options.commandTimeout, 5);
      assert.equal(options.componentTests, true);
      assert.equal(options.trace, true);
      assert.deepEqual(options.suites, ["examples/simple-passing.yaml"]);
    });
    it("should apply defaults", () => {
      const { options } = parse(["suite.yaml"]);
      assert.equal(options.address, "ws://localhost:3569");
      assert.equal(options.startTimeout, 10);
      assert.equal(options.commandTimeout, 3);
      assert.equal(options.componentTests, false);
      assert.equal(options.trace, false);
      assert.deepEqual(options.suites, ["suite.yaml"]);
    });
    it("should support multiple suite files", () => {
      const { options } = parse(["a.yaml", "b.yaml"]);
      assert.deepEqual(options.suites, ["a.yaml", "b.yaml"]);
    });
    it("should reject unknown options", () => {
      assert.throws(() => parse(["--nope", "a.yaml"]), /Unknown option/);
    });
  });

  describe("hasErrors", () => {
    it("should detect failing testcases", () => {
      assert.equal(hasErrors([{ cases: [{ passed: true }, {}] }]), false);
      assert.equal(
        hasErrors([{ cases: [{ passed: true }, { error: "boom" }] }]),
        true,
      );
    });
  });

  describe("testStatusText", () => {
    it("should render testcase results", () => {
      const lines = testStatusText([
        {
          name: "My suite",
          cases: [
            { name: "case a", assertion: "should work", passed: true },
            {
              name: "case b",
              assertion: "should fail",
              passed: false,
              error: "expected 1 to equal 2",
            },
            {
              name: "case c",
              assertion: "should skip",
              passed: true,
              skip: "no runtime",
            },
          ],
        },
      ]);
      assert.equal(lines.length, 4);
      assert.match(lines[0], /My suite/);
      assert.match(lines[1], /case a/);
      assert.match(lines[1], /✓/);
      assert.match(lines[2], /case b/);
      assert.match(lines[2], /✗ Error: expected 1 to equal 2/);
    });
  });

  describe("against a runtime (end-to-end)", () => {
    it("should exit 0 for passing suites", async () => {
      const result = await runCli([
        examplePath("simple-passing.yaml"),
        "--address",
        runtime.address,
        "--start-timeout",
        "2",
      ]);
      assert.equal(result.code, 0, `stderr: ${result.stderr}`);
      assert.match(result.stdout, /should repeat the same: ✓/);
    });
    it("should exit non-zero for failing suites", async () => {
      const result = await runCli([
        examplePath("simple-failing.yaml"),
        "--address",
        runtime.address,
        "--start-timeout",
        "2",
      ]);
      assert.equal(result.code, 2, `stderr: ${result.stderr}`);
      assert.match(
        result.stdout,
        /should fail: ✗ Error: expected true to equal false/,
      );
    });
    it("should run all testcases across multiple suites", async () => {
      const result = await runCli([
        examplePath("multisuite-failandpass.yaml"),
        "--address",
        runtime.address,
        "--start-timeout",
        "2",
      ]);
      assert.equal(result.code, 2);
      assert.match(result.stdout, /sending a boolean with wrong expect/);
      assert.match(result.stdout, /should repeat the same/);
      assert.equal((result.stdout.match(/✓/g) ?? []).length, 2);
      assert.equal((result.stdout.match(/✗/g) ?? []).length, 2);
    });
    it("should load component tests with --component-tests", async () => {
      const result = await runCli([
        examplePath("simple-passing.yaml"),
        "--address",
        runtime.address,
        "--start-timeout",
        "2",
        "--component-tests",
      ]);
      assert.equal(result.code, 0, `stderr: ${result.stderr}`);
      assert.match(result.stdout, /DummyComponent tests/);
      assert.match(result.stdout, /should repeat the same: ✓/);
    });
    it("should start the runtime with --command", async () => {
      const runtimePath = fileURLToPath(
        new URL("./fixtures/dummy-runtime.js", import.meta.url),
      );
      const result = await runCli([
        examplePath("simple-passing.yaml"),
        "--command",
        `node ${runtimePath} 33577`,
        "--address",
        "ws://127.0.0.1:33577",
        "--start-timeout",
        "10",
      ]);
      assert.equal(
        result.code,
        0,
        `stdout: ${result.stdout}\nstderr: ${result.stderr}`,
      );
    });
    it("should print usage and exit non-zero without suites", async () => {
      const result = await runCli(["--address", runtime.address]);
      assert.equal(result.code, 2);
      assert.match(result.stderr, /no suites specified/);
    });
  });
});
