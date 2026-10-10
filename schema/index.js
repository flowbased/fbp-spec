/**
 * JSON Schema definitions for the fbp-spec data format.
 * Built from the YAML sources in `schemata/` by `npm run build`.
 * @module schema/index
 */

/**
 * JSON Schema definition for fbp-spec data.
 * @typedef {{ id: string, title?: string, description?: string, [key: string]: * }} Schema
 */

import schemas from "./schemas.js";

/** @type {Record<string, Schema>} */
const allSchemas = schemas;
export default allSchemas;
export const {
  base,
  testcase,
  testsuite,
  testsuites,
  expectations,
  testsfile,
} = allSchemas;

/**
 * Get a single schema by name.
 * @param {string} name Schema name, with or without `.json` suffix
 * @returns {Schema|undefined} The schema, if found
 */
export function getSchema(name) {
  const schemaId = name.replace(".json", "");
  return allSchemas[schemaId];
}
