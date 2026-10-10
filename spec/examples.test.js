import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import {
  getComponentSuites,
  Runner,
  runAll,
  runTestAndCheck,
} from "../lib/runner.js";
import { getSuites, loadYAML, validate } from "../lib/testsuite.js";
import { startDummyRuntime } from "./fixtures/dummy-runtime.js";

describe("Examples (end-to-end with dummy runtime)", () => {
  /** @type {Awaited<ReturnType<typeof startDummyRuntime>>} */
  let runtime;
  /** @type {Runner} */
  let runner;
  /** @typedef {import("../lib/testsuite.js").Suite} Suite */

  before(async () => {
    runtime = await startDummyRuntime();
    runner = new Runner(
      { protocol: "websocket", address: runtime.address },
      { connectTimeout: 2000 },
    );
    await runner.connect();
  });
  after(async () => {
    await runner.disconnect();
    await runtime.close();
  });

  /**
   * Set up a suite, run one testcase, and tear down.
   * @param {object} suite Testsuite
   * @param {object} testcase Testcase
   * @returns {Promise<{ passed: boolean, error?: Error }>} Test result
   */
  async function setupAndRun(suite, testcase) {
    await runner.setupSuite(suite);
    try {
      return await runTestAndCheck(runner, testcase);
    } finally {
      await runner.teardownSuite(suite);
    }
  }

  const examplesDir = new URL("../examples/", import.meta.url);
  const exampleFiles = readdirSync(examplesDir).filter((f) =>
    f.endsWith(".yaml"),
  );

  for (const file of exampleFiles) {
    describe(file, () => {
      /** @type {Suite[]} */
      let suites;

      before(async () => {
        const source = await readFile(new URL(file, examplesDir), "utf-8");
        suites = loadYAML(source);
      });

      it("suites should validate against schema", () => {
        assert.equal(suites.length > 0, true);
        const results = validate(suites);
        assert.deepEqual(results.errors, []);
        assert.deepEqual(results.missing, []);
        assert.equal(results.valid, true);
      });

      it("testcases should pass or fail as declared", async () => {
        for (const suite of suites) {
          for (const testcase of suite.cases ?? []) {
            const result = await setupAndRun(suite, testcase);
            const shouldFail = testcase.assertion === "should fail";
            if (shouldFail) {
              assert.equal(
                result.passed,
                false,
                `expected fail: ${suite.name} / ${testcase.name}`,
              );
              assert.ok(
                result.error instanceof Error,
                "failing testcase should have an error",
              );
            } else {
              assert.deepEqual(
                result,
                { passed: true },
                `expected pass: ${suite.name} / ${testcase.name}`,
              );
            }
          }
        }
      });
    });
  }

  describe("runAll", () => {
    it("should fill in results on all testcases", async () => {
      const suites = await getSuites(
        new URL("multisuite-failandpass.yaml", examplesDir).pathname,
      );
      await runAll(runner, suites);
      const cases = suites.flatMap((s) => s.cases ?? []);
      assert.equal(cases.length, 4);
      assert.deepEqual(
        cases.map((c) => c.passed),
        [false, false, true, true],
      );
      for (const c of cases) {
        if (!c.passed) {
          assert.ok(typeof c.error === "string");
        }
      }
    });
  });

  describe("component tests", () => {
    it("should load and run tests attached to runtime components", async () => {
      const suites = /** @type {Suite[]} */ (await getComponentSuites(runner));
      assert.equal(suites.length, 1);
      const suite = suites[0];
      assert.ok(suite, "expected a suite");
      assert.equal(suite.name, "DummyComponent tests");
      await runAll(runner, suites);
      assert.deepEqual(
        (suite.cases ?? []).map((c) => c.passed),
        [true],
      );
    });
  });
});
