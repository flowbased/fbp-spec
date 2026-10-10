import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { checkResults, Runner, runTestAndCheck } from "../lib/runner.js";

describe("runner", () => {
  describe("checkResults", () => {
    it("should pass when actual matches expect", () => {
      const result = checkResults([
        {
          inputs: { in: 1 },
          expect: { out: { equals: 1 } },
          actual: { out: 1 },
        },
      ]);
      assert.deepEqual(result, { passed: true });
    });
    it("should fail when actual does not match expect", () => {
      const result = checkResults([
        {
          inputs: { in: 1 },
          expect: { out: { equals: 2 } },
          actual: { out: 1 },
        },
      ]);
      assert.equal(result.passed, false);
      assert.ok(result.error instanceof Error);
      assert.match(result.error.message, /to equal/);
    });
    it("should fail when not enough outputs received", () => {
      const result = checkResults([
        { inputs: { in: 1 }, expect: { out: { equals: 1 } } },
      ]);
      assert.ok(result.error instanceof Error);
      assert.match(result.error.message, /Only got 0 output messages out of 1/);
    });
    it("should report sequence position of failures", () => {
      const result = checkResults([
        {
          inputs: { in: 1 },
          expect: { out: { equals: 1 } },
          actual: { out: 1 },
        },
        {
          inputs: { in: 2 },
          expect: { out: { equals: 2 } },
          actual: { out: 3 },
        },
      ]);
      assert.ok(result.error instanceof Error);
      assert.match(result.error.message, /Expectation 1 of sequence failed/);
    });
    it("should report multiple failures", () => {
      const result = checkResults([
        {
          inputs: { in: 1 },
          expect: { out: { equals: 2 } },
          actual: { out: 1 },
        },
        {
          inputs: { in: 2 },
          expect: { out: { equals: 3 } },
          actual: { out: 2 },
        },
      ]);
      assert.ok(result.error instanceof Error);
      assert.match(result.error.message, /Multiple failures in sequence/);
    });
    it("should not fail when actual is null but expects are empty", () => {
      const result = checkResults([
        { inputs: { in: 1 }, expect: {}, actual: { out: 1 } },
      ]);
      assert.deepEqual(result, { passed: true });
    });
  });

  describe("runTestAndCheck", () => {
    /**
     * A Runner stand-in with canned results.
     * @param {import("../lib/runner.js").RunnerLike["runTest"]} runTest Implementation of runTest
     * @returns {import("../lib/runner.js").RunnerLike} Fake runner
     */
    function fakeRunner(runTest) {
      return { runTest };
    }

    it("should pass skipped testcases without running them", async () => {
      let ran = false;
      const result = await runTestAndCheck(
        fakeRunner(async () => {
          ran = true;
          return [];
        }),
        { skip: "not now" },
      );
      assert.deepEqual(result, { passed: true });
      assert.equal(ran, false);
    });
    it("should fail on inputs/expect length mismatch", async () => {
      const result = await runTestAndCheck(
        fakeRunner(async () => []),
        {
          inputs: [{ in: 1 }],
          expect: [{ out: { equals: 1 } }, { out: { equals: 2 } }],
        },
      );
      assert.equal(result.passed, false);
      assert.ok(result.error instanceof Error);
      assert.match(result.error.message, /sequence length mismatch/);
    });
    it("should map runner errors to test failures", async () => {
      const result = await runTestAndCheck(
        fakeRunner(async () => {
          throw new Error("runtime went away");
        }),
        { inputs: { in: 1 }, expect: { out: { equals: 1 } } },
      );
      assert.equal(result.passed, false);
      assert.ok(result.error instanceof Error);
      assert.match(result.error.message, /runtime went away/);
    });
    it("should pass on matching results", async () => {
      const result = await runTestAndCheck(
        fakeRunner(async (testcase) => [
          {
            inputs: /** @type {Record<string, *>} */ (testcase).inputs,
            expect: /** @type {Record<string, *>} */ (testcase).expect,
            actual: { out: 42 },
          },
        ]),
        { inputs: { in: 1 }, expect: { out: { equals: 42 } } },
      );
      assert.deepEqual(result, { passed: true });
    });
    it("should stringify errors into testcase results", async () => {
      const testcase = { inputs: { in: 1 }, expect: { out: { equals: 2 } } };
      const runner = fakeRunner(async () => [
        {
          inputs: testcase.inputs,
          expect: testcase.expect,
          actual: { out: 1 },
        },
      ]);
      const result = await runTestAndCheck(runner, testcase);
      assert.equal(result.passed, false);
    });
  });

  describe("Runner", () => {
    it("should default options", () => {
      const runner = new Runner({});
      assert.equal(runner.options.connectTimeout, 5000);
      assert.equal(runner.options.commandTimeout, 3000);
    });

    it("should fail to connect to an unavailable runtime", async () => {
      const runner = new Runner(
        { protocol: "websocket", address: "ws://127.0.0.1:1" },
        { connectTimeout: 1500 },
      );
      await assert.rejects(() => runner.connect(), Error);
    });
  });
});
