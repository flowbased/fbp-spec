/**
 * Loading, normalizing and validating of fbp-spec testsuites.
 * @module lib/testsuite
 */

import { extname, join } from "node:path";
import debugLib from "debug";
import { loadAll } from "js-yaml";
import tv4 from "tv4";

import schemas from "../schema/index.js";
import { isArray, startsWith } from "./common.js";

const debug = debugLib("fbp-spec:testsuite");

/**
 * A single test case within a testsuite.
 * @typedef {object} TestcaseProps
 * @property {string} [name] Name of this testcase
 * @property {string} [assertion] Description of what this testcase asserts
 * @property {Record<string, *>|Array<Record<string, *>>} [inputs] Inputs sent to fixture inports, or a sequence of such
 * @property {Record<string, *>|Array<Record<string, *>>} [expect] Expected data on outports, or a sequence of such
 * @property {string} [skip] Reason to skip this testcase
 * @property {number} [timeout] Maximum time to run this testcase for, in milliseconds
 * @property {boolean} [passed] Set to the test result by the runner
 * @property {string|Error} [error] Set to the test error message, if the test failed
 * @property {boolean} [shown] Internal: whether testcase result has been shown in CLI output
 * @property {*} [actual] Set to the actual output data by the runner
 */

/**
 * A testcase, with free-form additional properties from the YAML source.
 * @typedef {TestcaseProps & Record<string, *>} Testcase
 */

/**
 * A fbp-spec testsuite: a fixture plus a set of testcases.
 * @typedef {object} SuiteProps
 * @property {string} [name] Name of the suite; defaults to the topic
 * @property {string} [topic] Name of the component or graph under test
 * @property {{ type: string, data: string }} [fixture] Fixture graph definition
 * @property {Testcase[]} [cases] Testcases to run against the fixture
 * @property {string} [skip] Reason to skip the whole suite
 * @property {number} [timeout] Maximum time to run the suite for, in milliseconds
 * @property {boolean} [titleshown] Internal: whether suite title has been shown in CLI output
 */

/**
 * A testsuite, with free-form additional properties from the YAML source.
 * @typedef {SuiteProps & Record<string, *>} Suite
 */

/**
 * JSON Schema definition for fbp-spec data.
 * @typedef {{ id: string, title?: string, description?: string, [key: string]: * }} Schema
 */

/**
 * Validate an fbp-spec object against the fbp-spec schemas.
 * @param {*} obj Object to validate, typically a testsuite or testsfile structure
 * @returns {{ passed: boolean, errors: object[], missing: string[], valid: boolean }} Validation results
 */
export function validate(obj) {
  tv4.reset();
  for (const name of Object.keys(schemas)) {
    const schema = schemas[name];
    tv4.addSchema(schema.id, schema);
  }

  const results = tv4.validateMultiple(obj, "testsfile.json");
  results.passed = results.valid && results.missing.length === 0;
  return results;
}

/**
 * Apply defaults to a testsuite object.
 * Defaults name to the topic, and cases to an empty list.
 * @param {Suite} base Testsuite definition, as parsed from YAML
 * @returns {Suite} Normalized testsuite
 */
export function create(base) {
  const suite = base;
  if (!suite.name) {
    suite.name = suite.topic;
  }
  if (!suite.cases) {
    suite.cases = [];
  }
  return suite;
}

/**
 * Parse YAML containing one or more testsuites.
 * @param {string} data YAML source
 * @returns {Suite[]} Normalized testsuites
 */
export function loadYAML(data) {
  const docs = /** @type {Suite[]} */ (loadAll(data));
  return docs.map((doc) => create(doc));
}

/**
 * Read testsuites from YAML files, directories of YAML files, or HTTP URLs.
 * @param {string|string[]} tests File or directory path, or HTTP(S) URL, or a list of such
 * @returns {Promise<Suite[]>} Normalized testsuites
 */
export async function getSuites(tests) {
  const list = /** @type {string[]} */ (isArray(tests) ? tests : [tests]);
  const suitesList = [];
  for (const test of list) {
    suitesList.push(await loadLocation(test)); // eslint-disable-line no-await-in-loop
  }
  return suitesList.reduce((a, b) => a.concat(b), []);
}

/**
 * Load suites from a single file path, directory, or URL.
 * @param {string} test Location to load from
 * @returns {Promise<Suite[]>} Normalized testsuites
 */
async function loadLocation(test) {
  if (startsWith(test, "http://") || startsWith(test, "https://")) {
    return loadHTTP(test);
  }
  return getFile(test);
}

/**
 * Fetch a YAML testsfile over HTTP(S), and parse it.
 * @param {string} url URL to fetch from
 * @returns {Promise<Suite[]>} Normalized testsuites
 */
async function loadHTTP(url) {
  debug("loading suites from", url);
  const res = await fetch(url);
  const source = await res.text();
  return loadYAML(source);
}

/**
 * Read a testsfile from disk.
 * Directories are scanned for `.yaml` files.
 * Uses a dynamic import so that this module can also be bundled for browsers.
 * @param {string} test File or directory path
 * @returns {Promise<Suite[]>} Normalized testsuites
 */
async function getFile(test) {
  const fs = await import("node:fs");
  const info = await fs.promises.stat(test);
  if (info.isDirectory()) {
    const files = await fs.promises.readdir(test);
    const filePaths = files
      .filter((f) => extname(f) === ".yaml")
      .map((f) => join(test, f));
    return getSuites(filePaths);
  }
  const yaml = await fs.promises.readFile(test, "utf-8");
  return loadYAML(yaml);
}
