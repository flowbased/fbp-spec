import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import tv4 from "tv4";

import schemas from "../schema/index.js";

const metaSchema = JSON.parse(
  readFileSync(new URL("./json-schema.json", import.meta.url), "utf-8"),
);

describe("Schema meta validation", () => {
  for (const name of Object.keys(schemas)) {
    const schema = schemas[name];
    describe(`${name}.json (${schema.title || schema.description})`, () => {
      it("should validate against JSON meta schema", () => {
        tv4.reset();
        tv4.addSchema("http://json-schema.org/draft-04/schema", metaSchema);
        tv4.addSchema(schema.id, schema);
        const result = tv4.validateResult(
          schema,
          "http://json-schema.org/draft-04/schema",
        );
        assert.equal(result.valid, true, JSON.stringify(result.errors));
      });
    });
  }
});

describe("Schema module", () => {
  it("should provide getSchema lookup", async () => {
    const { getSchema } = await import("../schema/index.js");
    const schema = getSchema("testcase.json");
    assert.ok(schema, "expected testcase schema");
    assert.equal(schema.id, "testcase.json");
    assert.equal(getSchema("testcase")?.id, "testcase.json");
    assert.equal(getSchema("nonexistent.json"), undefined);
  });
});
