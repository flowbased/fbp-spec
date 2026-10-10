# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Changed

- Converted the codebase to ECMAScript Modules (ESM), with `"type": "module"` and an explicit `"exports"` map in `package.json`
- Scoped all Node.js standard library imports with the `node:` prefix, and made Node-specific imports lazy so the library can still be bundled for browsers
- Converted all callback-style and Bluebird-based asynchronous APIs to native Promises with async/await. `Runner` methods (`connect`, `disconnect`, `setupSuite`, `teardownSuite`, `runTest`), `runAll`, `runTestAndCheck`, `getComponentSuites`, `subprocess.start` and `testsuite.getSuites` now return Promises
- Replaced Bluebird with native Promises, `isomorphic-fetch` with the native `fetch` API, and `commander`/`slug` with `node:util` `parseArgs` and a local slugifier
- Replaced the Chai-based expectation operators with implementations built on `node:assert`, keeping the `type` operator's chai `a()` type-name semantics (`array`, `null`, `date`, `regexp`)
- Added comprehensive JSDoc type annotations, verified with TypeScript in `checkJs` mode (`npm run typecheck`)
- Switched linting and formatting to Biome, configured via `.editorconfig`
- Replaced the grunt-yaml schema build step with `scripts/build-schemas.js`, which also emits a browser-loadable `schema/schemas.js` module
- Updated the test suite to the native `node:test` runner with `node:assert`, and added a JavaScript mock FBP runtime so end-to-end tests no longer require the Python example runtime
- Updated GitHub Actions workflows to test against Node.js 20 and 22, and to publish to npm via OpenID Connect (OIDC) with provenance

### Removed

- Removed the Mocha runner integrations: running fbp-spec suites inside external Mocha suites (`fbp-spec.mocha.run`), and the `fbp-spec-mocha` compatibility runtime exposing Mocha tests over the FBP protocol
- Removed the browser build: Webpack, Babel, Karma configurations and the gh-pages deployment
- Removed the deprecated Mocha, Chai, Bluebird, Commander, isomorphic-fetch, slug, tv4-in-browser and Grunt dependencies
- Removed Dependabot auto-merge workflow configuration

## 0.8.0 - 2020-11-11

### Added

- Added a `--trace` command-line flag to capture Flowtraces for fbp-spec runs. The Flowtraces will be stored into a `.flowtrace` folder under the project

## 0.7.1 - 2020-10-22

### Fixed

- Fixed issue with loading spec files

## 0.7.0 - 2020-10-22

### Added

- Added a `--component-tests` command-line flag to control whether fbp-spec loads additional component tests from the runtime

### Changed

- Ported from CoffeeScript to modern JavaScript

## 0.6.8 - 2020-09-09

### Fixed

- Made fbp-spec ignore failing getSource requests
- If network setup fails, teardown for the network will also be skipped

## 0.6.7 - 2020-09-01

### Changed

- Updated dependencies to include latest FBP Protocol Client and Schemas
- Updated browser build to use a modern Babel version

## 0.6.2 - 2018-03-31

### Fixed

- Fixed a race condition with synchronous networks where we expect multiple output packets

## 0.6.1 - 2018-03-31

### Fixed

- Fixed issue where received bracket IPs were causing fbp-spec to not see the actual data packet

## 0.6.0 - 2018-03-30

### Changed

- Switched FBP Protocol communications with the runtime to use the new [fbp-client](https://github.com/flowbased/fbp-client) library
- All messages to and from runtime are now validated against the FBP Protocol schema
- Permissions are now validated against capabilities advertised by the runtime
- Tests now fail if runtime breaks the connection (for example, if runtime crashes mid-run)
- Tests now fail if runtime sends a `network:error` message
- Tests now fail if runtime sends a `network:processerror` message
- Tests now fail if runtime sends a message to an exported `error` outport if message to that port was expected
- All FBP Protocol operations now time out if there is no response

## 0.5.0 - 2017-11-17

### Changed

- Updated to fbp parser 1.7 which introduces consistency validations for graphs. This can cause some tests to break due to them having incorrectly defined nodes in them

### Fixed

- We actually catch and show FBP parsing errors now

## 0.4.1 - 2017-11-07

### Changed

- Require ES6 support. Node.js 6+ or a modern browser. If support for older environments are needed, use Babel to transpile
- Now using CoffeeScript 2

## 0.3.0 - 2017-11-06

### Changed

- Updated to fbp-protocol-client 0.2.x, without support for MicroFlo transport

## 0.2.3 - 2017-10-04

### Fixed

- Fixed triggering Mocha error in start/stop due to returning Promise. Regression since 0.2.2

## 0.2.2 - 2017-10-03

### Added

- Automatically retry connection while during setup until `startTimeout`

## 0.2.0 - 2017-02-19

### Changed

- Updated to Mocha 3.x. Can break tests in some cases where Promise is returned and callback is used at same time
- Updated all dependencies to latest version

## 0.1.16 - 2016-10-11

### Added

- Several conveniences added in .fbp DSL from `fbp 1.5`

## 0.1.8 - 2016-04-20

### Fixed

- `testsuite.validate()`: Fix not catching invalid files, due to wrong schema lookup

### Added

- Add support for sequences of inputs/expect. Allows testing stateful components/graphs/systems

## 0.1.7 - 2016-04-17

### Added

- Make `fixture` optional. If not specified, will be auto-created from component/graph in `topic`

## 0.1.6 - 2016-04-14

### Changed

- Some improvements to experimental `fbp-spec-mocha`

## 0.1.4 - 2016-05-07

### Added

- Send `network:output` FBP messages to `console.log()`, for easier debugging of problems on runtime side
- Added experimental `fbp-spec-mocha` tool, for running Mocha tests over fbp-spec protocol

## 0.1.3 - 2015-08-27

First useful release

### Added

- Initial YAML testformat fully defined
- Tested with NoFlo, MicroFlo and Python example runtimes
- `fbp-spec` commandline tool for running
- `fbpspec.mocha.run` for integration in a Mocha testsuite
- Simple set of UI widgets, with experimental integration in noflo-ui

## 0.0.1 - 2015-04-17

Proof of concept

### Added

- Could run a MicroFlo testcase by talking over FBP runtime protocol
