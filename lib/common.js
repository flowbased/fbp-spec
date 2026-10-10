/**
 * General-purpose helpers used across fbp-spec.
 * @module lib/common
 */

/**
 * Whether we are running in a browser-like environment (no Node.js process).
 * @returns {boolean} True if running in a browser
 */
export function isBrowser() {
  if (
    typeof process !== "undefined" &&
    process.execPath &&
    process.execPath.match(/node|iojs/)
  ) {
    return false;
  }
  return true;
}

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generate a random ASCII string, using Web Crypto when available.
 * @param {number} n Number of characters to generate
 * @returns {string} Random string of length n
 */
export function randomString(n) {
  const bytes = new Uint8Array(n);
  globalThis.crypto.getRandomValues(bytes);
  let text = "";
  for (let i = 0; i < n; i += 1) {
    text += ALPHABET.charAt(bytes[i] % ALPHABET.length);
  }
  return text;
}

/**
 * Run an async function over items sequentially, collecting results.
 * The first failure aborts the sequence and rejects.
 * @template T, R
 * @param {T[]} items Items to process
 * @param {(item: T) => Promise<R>} func Async function applied to each item
 * @returns {Promise<R[]>} Results in the same order as the items
 */
export async function asyncSeries(items, func) {
  const results = [];
  for (const item of items) {
    results.push(await func(item)); // eslint-disable-line no-await-in-loop
  }
  return results;
}

/**
 * Whether the given value is an Array.
 * @param {*} value Value to check
 * @returns {boolean} True if value is an array
 */
export function isArray(value) {
  return Array.isArray(value);
}

/**
 * Whether the given string starts with the given substring.
 * @param {string} str String to check
 * @param {string} sub Expected prefix
 * @returns {boolean} True if str starts with sub
 */
export function startsWith(str, sub) {
  return str.indexOf(sub) === 0;
}

/**
 * Wait for the given number of milliseconds.
 * @param {number} delay Delay in milliseconds
 * @returns {Promise<void>} Resolves after the delay
 */
function delayPromise(delay) {
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}

/**
 * Repeatedly call attempt, until the test() predicate on its result passes.
 * @template T
 * @param {() => Promise<T>} attempt Async function producing a value
 * @param {(value: T) => Promise<void>} test Async predicate; should reject on the value if not acceptable yet
 * @param {number} [delay=500] Time to wait between attempts, in milliseconds
 * @param {number} [max=5] Maximum number of attempts
 * @returns {Promise<T>} The first result that passes the test
 */
export async function retryUntil(attempt, test, delay = 500, max = 5) {
  let lastError = null;
  for (let i = 0; i <= max; i += 1) {
    try {
      const result = await attempt();
      await test(result);
      return result;
    } catch (error) {
      lastError = error;
    }
    if (i < max) {
      await delayPromise(delay);
    }
  }
  throw lastError;
}
