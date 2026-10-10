import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { expect, noError } from "../lib/expectation.js";

describe("expectation", () => {
  describe("expect", () => {
    it("should pass on matching expectations", () => {
      expect({ out: { equals: 42 } }, { out: 42 });
      expect({ out: { equals: { a: 1 } } }, { out: { a: 1 } });
      expect({ out: { type: "number" } }, { out: 42 });
    });
    it("should throw on non-matching expectations", () => {
      assert.throws(
        () => expect({ out: { equals: 42 } }, { out: 41 }),
        /expected 41 to equal 42/,
      );
    });
    it("should throw when no data received on port", () => {
      assert.throws(
        () => expect({ out: { equals: 42 } }, {}),
        /No data received on port out/,
      );
    });
    it("should throw on unknown operator", () => {
      assert.throws(
        () => expect({ out: { unknownop: 42 } }, { out: 42 }),
        /No operator matching/,
      );
    });
    it("should support sequences of expectations", () => {
      expect([{ out: { equals: 1 } }, { out: { equals: 1 } }], { out: 1 });
    });
    it("should support arrays of expectations on one port", () => {
      expect(
        { out: [{ type: "object" }, { haveKeys: ["a"] }] },
        { out: { a: 1 } },
      );
      assert.throws(
        () =>
          expect(
            { out: [{ type: "object" }, { haveKeys: ["b"] }] },
            { out: { a: 1 } },
          ),
        /have keys/,
      );
    });

    describe("operators", () => {
      it("type", () => {
        expect({ out: { type: "object" } }, { out: {} });
        expect({ out: { type: "string" } }, { out: "hello" });
        expect({ out: { type: "array" } }, { out: [1, 2] });
        expect({ out: { type: "null" } }, { out: null });
        expect({ out: { type: "date" } }, { out: new Date() });
        expect({ out: { type: "regexp" } }, { out: /fbp/ });
        assert.throws(
          () => expect({ out: { type: "string" } }, { out: 42 }),
          /to be of type string/,
        );
        // chai a() semantics: arrays and nulls are not 'object'
        assert.throws(
          () => expect({ out: { type: "object" } }, { out: [1] }),
          /to be of type object/,
        );
        assert.throws(
          () => expect({ out: { type: "object" } }, { out: null }),
          /to be of type object/,
        );
      });
      it("above and below", () => {
        expect({ out: { above: 41 } }, { out: 42 });
        expect({ out: { below: 43 } }, { out: 42 });
        assert.throws(
          () => expect({ out: { above: 42 } }, { out: 42 }),
          /to be above 42/,
        );
        assert.throws(
          () => expect({ out: { below: 42 } }, { out: 42 }),
          /to be below 42/,
        );
      });
      it("haveKeys", () => {
        expect({ out: { haveKeys: ["a", "b"] } }, { out: { a: 1, b: 2 } });
        assert.throws(
          () => expect({ out: { haveKeys: ["a"] } }, { out: { a: 1, b: 2 } }),
          /have keys/,
        );
      });
      it("includeKeys", () => {
        expect({ out: { includeKeys: ["a"] } }, { out: { a: 1, b: 2 } });
        assert.throws(
          () => expect({ out: { includeKeys: ["c"] } }, { out: { a: 1 } }),
          /include key c/,
        );
      });
      it("contains on strings", () => {
        expect(
          { out: { contains: "sub" } },
          { out: "a string with substring" },
        );
        assert.throws(
          () => expect({ out: { contains: "nope" } }, { out: "string" }),
          /to contain 'nope'/,
        );
      });
      it("contains on arrays", () => {
        expect({ out: { contains: { a: 1 } } }, { out: [{ a: 1 }, { b: 2 }] });
        assert.throws(
          () => expect({ out: { contains: 3 } }, { out: [1, 2] }),
          /to contain 3/,
        );
      });
      it("contains on objects", () => {
        expect({ out: { contains: { a: 1 } } }, { out: { a: 1, b: 2 } });
        assert.throws(
          () => expect({ out: { contains: { c: 3 } } }, { out: { a: 1 } }),
          /to contain/,
        );
      });
      it("noterror", () => {
        expect({ out: { noterror: null } }, { out: "value" });
        assert.throws(
          () =>
            expect({ out: { noterror: null } }, { out: new Error("broken") }),
          /broken/,
        );
      });
    });

    describe("JSONPath", () => {
      it("should extract and match values", () => {
        expect(
          { out: { path: "$.outer.inner.foo", equals: "bar" } },
          { out: { outer: { inner: { foo: "bar" } } } },
        );
      });
      it("should match multiple values", () => {
        expect(
          { out: { path: "$.outer.*.foo", equals: "bar" } },
          { out: { outer: { first: { foo: "bar" }, second: { foo: "bar" } } } },
        );
      });
      it("should fail when path does not match", () => {
        assert.throws(
          () =>
            expect(
              { out: { path: "$.outer.nonexist", equals: "bar" } },
              { out: { outer: { inner: { foo: "bar" } } } },
            ),
          /to match data/,
        );
      });
      it("should fail when a match violates the expectation", () => {
        assert.throws(
          () =>
            expect(
              { out: { path: "$.outer.*.foo", equals: "bar" } },
              {
                out: {
                  outer: { first: { foo: "bar" }, second: { foo: "bazz" } },
                },
              },
            ),
          /expected "bazz" to equal "bar"/,
        );
      });
    });
  });

  describe("noError", () => {
    it("should pass on nullish values", () => {
      noError(null);
      noError(undefined);
    });
    it("should throw the error itself", () => {
      const err = new Error("failure");
      assert.throws(
        () => noError(err),
        (e) => e === err,
      );
    });
    it("should throw on other defined values", () => {
      assert.throws(() => noError("value"), /value/);
    });
  });
});
