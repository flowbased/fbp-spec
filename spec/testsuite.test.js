import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { create, getSuites, loadYAML, validate } from "../lib/testsuite.js";

const MULTI_DOC_YAML = `---
name: First suite
topic: DummyComponent
cases:
-
  name: 'case one'
  assertion: 'should pass'
  inputs:
    in: true
  expect:
    out:
      equals: true
---
name: Second suite
topic: core/Repeat
cases: []
`;

const PASSING_YAML = `
name: Simple passing
topic: DummyComponent
cases:
-
  name: 'sending a boolean'
  assertion: 'should pass'
  inputs:
    in: true
  expect:
    out:
      equals: true
`;

describe("testsuite", () => {
  describe("create", () => {
    it("should default name to topic", () => {
      const suite = create({ topic: "core/Repeat" });
      assert.equal(suite.name, "core/Repeat");
      assert.deepEqual(suite.cases, []);
    });
    it("should keep existing name and cases", () => {
      const suite = create({
        name: "Mine",
        topic: "core/Repeat",
        cases: [{ name: "x" }],
      });
      assert.equal(suite.name, "Mine");
      assert.equal(suite.cases?.length, 1);
    });
  });

  describe("loadYAML", () => {
    it("should parse single-document YAML", () => {
      const suites = loadYAML(PASSING_YAML);
      assert.equal(suites.length, 1);
      assert.equal(suites[0].name, "Simple passing");
      assert.equal(suites[0].cases?.length, 1);
    });
    it("should parse multi-document YAML", () => {
      const suites = loadYAML(MULTI_DOC_YAML);
      assert.equal(suites.length, 2);
      assert.equal(suites[0].name, "First suite");
      assert.equal(suites[1].name, "Second suite");
    });
    it("should throw on invalid YAML", () => {
      assert.throws(() => loadYAML("foo: [unclosed"), Error);
    });
  });

  describe("getSuites", () => {
    /** @type {string} */
    let dir;

    before(async () => {
      dir = await mkdtemp(join(tmpdir(), "fbp-spec-test-"));
      await writeFile(join(dir, "passing.yaml"), PASSING_YAML);
      await writeFile(join(dir, "other.yaml"), MULTI_DOC_YAML);
    });

    it("should load from a single file", async () => {
      const suites = await getSuites(join(dir, "passing.yaml"));
      assert.equal(suites.length, 1);
      assert.equal(suites[0].name, "Simple passing");
    });
    it("should load from a list of files", async () => {
      const suites = await getSuites([
        join(dir, "passing.yaml"),
        join(dir, "other.yaml"),
      ]);
      assert.equal(suites.length, 3);
    });
    it("should load from a directory", async () => {
      const suites = await getSuites(dir);
      assert.equal(suites.length, 3);
    });
    it("should reject on missing files", async () => {
      await assert.rejects(getSuites(join(dir, "missing.yaml")), Error);
    });

    describe("over HTTP", () => {
      /** @type {import('node:http').Server} */
      let server;
      /** @type {string} */
      let baseUrl;

      before(async () => {
        const http = await import("node:http");
        server = http.createServer((_req, res) => {
          res.writeHead(200, { "Content-Type": "text/yaml" });
          res.end(PASSING_YAML);
        });
        /** @type {Promise<void>} */
        const listening = new Promise((resolve) => {
          server.listen({ port: 0, host: "127.0.0.1" }, resolve);
        });
        await listening;
        const addr = server.address();
        const port = typeof addr === "object" && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}/tests.yaml`;
      });
      after(
        () =>
          new Promise((resolve) => {
            server.close(resolve);
          }),
      );

      it("should load suites from a URL", async () => {
        const suites = await getSuites(baseUrl);
        assert.equal(suites.length, 1);
        assert.equal(suites[0].name, "Simple passing");
      });
    });
  });

  describe("validate", () => {
    it("should accept a valid testsfile", () => {
      const results = validate(loadYAML(MULTI_DOC_YAML));
      assert.equal(results.valid, true);
      assert.equal(results.passed, true);
      assert.deepEqual(results.errors, []);
      assert.deepEqual(results.missing, []);
    });
    it("should reject invalid testcases", () => {
      const results = validate([
        { name: "Broken suite", cases: [{ inputs: 42 }] },
      ]);
      assert.equal(results.valid, false);
      assert.ok(results.errors.length > 0);
    });
  });
});
