import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  asyncSeries,
  isArray,
  isBrowser,
  randomString,
  retryUntil,
  startsWith,
} from "../lib/common.js";

describe("common", () => {
  describe("isBrowser", () => {
    it("should detect Node.js", () => {
      assert.equal(isBrowser(), false);
    });
  });

  describe("randomString", () => {
    it("should generate string of requested length", () => {
      assert.equal(randomString(10).length, 10);
      assert.equal(randomString(0).length, 0);
    });
    it("should only contain ASCII alphanumerics", () => {
      assert.match(randomString(100), /^[A-Za-z0-9]+$/);
    });
    it("should produce different strings", () => {
      assert.notEqual(randomString(20), randomString(20));
    });
  });

  describe("asyncSeries", () => {
    it("should run items in order and collect results", async () => {
      /** @type {number[]} */
      const order = [];
      const results = await asyncSeries([1, 2, 3], async (item) => {
        order.push(item);
        return item * 2;
      });
      assert.deepEqual(order, [1, 2, 3]);
      assert.deepEqual(results, [2, 4, 6]);
    });
    it("should reject on first error", async () => {
      await assert.rejects(
        asyncSeries([1, 2, 3], async (item) => {
          if (item === 2) {
            throw new Error("boom");
          }
          return item;
        }),
        /boom/,
      );
    });
  });

  describe("isArray", () => {
    it("should detect arrays", () => {
      assert.equal(isArray([]), true);
      assert.equal(isArray([1, 2]), true);
      assert.equal(isArray({}), false);
      assert.equal(isArray("string"), false);
      assert.equal(isArray(null), false);
    });
  });

  describe("startsWith", () => {
    it("should check string prefixes", () => {
      assert.equal(startsWith("foobar", "foo"), true);
      assert.equal(startsWith("foobar", "bar"), false);
      assert.equal(startsWith("foobar", "foobar"), true);
      assert.equal(startsWith("", "x"), false);
    });
  });

  describe("retryUntil", () => {
    it("should return first passing result", async () => {
      let attempts = 0;
      const result = await retryUntil(
        async () => {
          attempts += 1;
          return attempts;
        },
        async (value) => {
          if (value < 3) {
            throw new Error("not yet");
          }
        },
        1,
        5,
      );
      assert.equal(result, 3);
    });
    it("should reject after max attempts", async () => {
      await assert.rejects(
        retryUntil(
          async () => false,
          async () => {
            throw new Error("nope");
          },
          1,
          2,
        ),
        /nope/,
      );
    });
  });
});
