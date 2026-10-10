/**
 * A library of standard expectation operators, used to check actual output data.
 * Throws an Error when an expectation is violated, with details about the issue.
 * @module lib/expectation
 */

import assert from "node:assert";
import debugLib from "debug";
import JSONPath from "jsonpath";

import { isArray } from "./common.js";

const debug = debugLib("fbp-spec:expectation");

/**
 * Produce an AssertionError-compatible error with a message.
 * @param {string} message Description of the violated expectation
 * @returns {Error} The error to throw
 */
function fail(message) {
  return new assert.AssertionError({
    message,
    actual: "",
    expected: "",
    operator: "==",
  });
}

/**
 * The library of standard expectation operators.
 * Each operator takes the actual value and the expected value,
 * and throws an Error if the expectation is violated.
 * @type {Record<string, (actual: any, expected?: any) => void>}
 */
const operators = {
  /**
   * Check the type of the actual value.
   * @param {*} actual The received value
   * @param {string} expected Expected type name
   * @returns {void}
   */
  type(actual, expected) {
    assert.equal(
      typeof actual,
      expected,
      `expected ${JSON.stringify(actual)} to be of type ${expected}`,
    );
  },
  /**
   * Deep equality check.
   * @param {*} actual The received value
   * @param {*} expected The expected value
   * @returns {void}
   */
  equals(actual, expected) {
    if (!deepEqual(actual, expected)) {
      throw fail(
        `expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`,
      );
    }
  },
  /**
   * Check that actual is above (greater than) expected.
   * @param {number} actual The received value
   * @param {number} expected The value to be above
   * @returns {void}
   */
  above(actual, expected) {
    if (!(actual > expected)) {
      throw fail(`expected ${actual} to be above ${expected}`);
    }
  },
  /**
   * Check that actual is below (less than) expected.
   * @param {number} actual The received value
   * @param {number} expected The value to be below
   * @returns {void}
   */
  below(actual, expected) {
    if (!(actual < expected)) {
      throw fail(`expected ${actual} to be below ${expected}`);
    }
  },
  /**
   * Check that the actual object has exactly the given keys.
   * @param {*} actual The received value
   * @param {string[]} expected Key names to expect
   * @returns {void}
   */
  haveKeys(actual, expected) {
    const keys = Object.keys(actual ?? {}).sort();
    const wanted = [...expected].sort();
    if (JSON.stringify(keys) !== JSON.stringify(wanted)) {
      throw fail(
        `expected ${JSON.stringify(actual)} to have keys ${JSON.stringify(wanted)}, got ${JSON.stringify(keys)}`,
      );
    }
  },
  /**
   * Check that the actual object includes the given keys.
   * @param {*} actual The received value
   * @param {string[]} expected Key names to expect to be present
   * @returns {void}
   */
  includeKeys(actual, expected) {
    const keys = Object.keys(actual ?? {});
    for (const key of expected) {
      if (!keys.includes(key)) {
        throw fail(`expected ${JSON.stringify(actual)} to include key ${key}`);
      }
    }
  },
  /**
   * Check that the actual value contains the expected value.
   * For strings checks substring, for arrays checks for a deep-equal member,
   * for objects checks for a deep-equal subset.
   * @param {*} actual The received value
   * @param {*} expected Value expected to be contained
   * @returns {void}
   */
  contains(actual, expected) {
    if (typeof actual === "string") {
      if (!actual.includes(expected)) {
        throw fail(`expected '${actual}' to contain '${expected}'`);
      }
      return;
    }
    if (isArray(actual)) {
      const list = /** @type {*[]} */ (actual);
      if (!list.some((member) => deepEqual(member, expected))) {
        throw fail(
          `expected ${JSON.stringify(actual)} to contain ${JSON.stringify(expected)}`,
        );
      }
      return;
    }
    if (actual != null && typeof actual === "object") {
      const obj = /** @type {Record<string, *>} */ (actual);
      for (const key of Object.keys(expected)) {
        if (!deepEqual(obj[key], expected[key])) {
          throw fail(
            `expected ${JSON.stringify(actual)} to contain { '${key}': ${JSON.stringify(expected[key])} }`,
          );
        }
      }
      return;
    }
    throw fail(`cannot check contains on ${JSON.stringify(actual)}`);
  },
  /**
   * Check that the actual value is not an error-like object.
   * @param {*} actual The received value
   * @returns {void}
   */
  noterror(actual) {
    if (actual?.message) {
      throw actual;
    }
  },
};

/**
 * Structurally compare two values for equality.
 * @param {*} a First value
 * @param {*} b Second value
 * @returns {boolean} True if the values are deeply equal
 */
function deepEqual(a, b) {
  try {
    assert.deepStrictEqual(a, b);
    return true;
  } catch {
    return false;
  }
}

/**
 * Find the expectation operator referenced in an expectation object,
 * and return it wrapped in a predicate function.
 * @param {Record<string, *>} expectation Expectation object, like { equals: true } or { path, equals }
 * @returns {(data: *) => void} Predicate function, throws on violated expectation
 */
function findOperator(expectation) {
  const ops = Object.keys(expectation);
  for (const opname of ops) {
    const expectValue = expectation[opname];
    if (opname !== "path") {
      const op = operators[opname];
      if (op) {
        const predicate = /** @type {(data: *) => void} */ (
          (data) => op(data, expectValue)
        );
        predicate.toString = () => `${opname} ${expectValue}`;
        return predicate;
      }
    }
  }

  throw new Error(
    `fbp-spec: No operator matching ${Object.keys(expectation)}. Available: ${Object.keys(operators)}`,
  );
}

/**
 * Extract the data values the expectation applies to.
 * Uses the JSONPath in expectation.path when present, otherwise the data itself.
 * @param {Record<string, *>} expectation Expectation object, possibly with a .path JSONPath
 * @param {*} data The data to match against
 * @returns {*[]} Matching data values
 */
function extractMatches(expectation, data) {
  let matches;
  if (expectation.path) {
    debug("extracting JSONPath from", expectation.path, data);
    matches = JSONPath.query(data, expectation.path);
    if (!matches.length) {
      throw new Error(
        `expected JSONPath '${expectation.path}' to match data in ${JSON.stringify(data)}`,
      );
    }
  } else {
    matches = [data];
  }
  debug("matching against", matches);
  return matches;
}

/**
 * Check actual output data against a set of expectations.
 * Throws an Error on the first violated expectation.
 * @param {*|Array<Record<string, *>>} expects One expectation, or a sequence of expectations
 * @param {Record<string, *>} portsdata Data received on the outports, keyed by port name
 * @returns {void}
 */
export function expect(expects, portsdata) {
  // can have one or more set of expectations of messages
  const expectationSets = isArray(expects) ? expects : [expects];

  for (const e of expectationSets) {
    // each message expectation can match on ports
    for (const port of Object.keys(e)) {
      // for each matching port, there can be one or more assertions on the value
      const expectations = isArray(e[port]) ? e[port] : [e[port]];
      for (const expectation of expectations) {
        debug("checking port for expectation", port, expectation);
        const data = portsdata[port];
        if (typeof data === "undefined") {
          throw new Error(`No data received on port ${port}`);
        }
        const predicate = findOperator(expectation);
        const matches = extractMatches(expectation, data);
        for (const match of matches) {
          debug("checking against predicate", match, predicate.toString());
          predicate(match);
        }
      }
    }
  }
}

/**
 * Assert that the given value is not an error.
 * @param {*} maybeErr Value that should not be an error
 * @returns {void}
 */
export function noError(maybeErr) {
  if (maybeErr != null) {
    throw maybeErr;
  }
}
