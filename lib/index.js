/**
 * Public API of fbp-spec.
 * @module lib/index
 */

import * as schema from "../schema/index.js";
import { getSchema } from "../schema/index.js";
import * as runner from "./runner.js";
import * as subprocess from "./subprocess.js";
import * as testsuite from "./testsuite.js";

export { getSchema, runner, schema, subprocess, testsuite };
