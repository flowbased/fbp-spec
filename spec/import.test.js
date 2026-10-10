import assert from "node:assert/strict";
import { describe, it } from "node:test";

import * as fbpSpec from "../index.js";

describe("require('fbp-spec')", () => {
  it("should not throw", () => {
    assert.equal(typeof fbpSpec, "object");
  });

  it("should export the public API", () => {
    assert.equal(typeof fbpSpec.runner.Runner, "function");
    assert.equal(typeof fbpSpec.runner.runAll, "function");
    assert.equal(typeof fbpSpec.runner.runTestAndCheck, "function");
    assert.equal(typeof fbpSpec.subprocess.start, "function");
    assert.equal(typeof fbpSpec.testsuite.loadYAML, "function");
    assert.equal(typeof fbpSpec.testsuite.validate, "function");
    assert.equal(typeof fbpSpec.schema.testcase, "object");
    const schema = fbpSpec.getSchema("testsfile.json");
    assert.ok(schema, "expected testsfile schema");
    assert.equal(schema.id, "testsfile.json");
  });
});
