fbp-spec
========

A runtime-independent test framework for Flow Based Programming (FBP) components and graphs,
using declarative, data-driven testing.

One can use fbp-spec to do testing at multiple levels,
each approximately corresponding to the different architectural levels of Flow Based Programming:

* Unit (FBP component/subgraph)
* Integration (FBP graph)
* System (FBP runtime)

## Status

**In production**

* Tested with several FBP runtimes: [NoFlo](https://noflojs.org), [MicroFlo](https://microflo.org), [Python example](https://github.com/flowbased/protocol-examples), [MsgFlo](http://msgflo.org)
* Runner available for continuous integration (CLI) and as a library for building custom runners, interactive or automated

## Purpose & Scope

Note: `fbp-spec` is intended for use by application and component-library developers.

The following is considered out-of-scope:

* Testing conformance with the FBP protocol. Instead use [fbp-protocol](https://github.com/flowbased/fbp-protocol)
* Testing an FBP runtime/engine itself. Instead use a testing framework for your particular runtime language/environment.

## License

The [European Union Public Licence v1.2 (EUPL-1.2)](./LICENSE.md)

# Usage

## Installing

Requires Node.js 20 or newer. Set up fbp-spec as an npm dependency:

    npm install --save-dev fbp-spec

or, install it globally. Useful if you just want the commandline tool.

    npm install -g fbp-spec

## Writing tests

Each declared test suite loads an FBP component (or graph) fixture,
and runs a set of test cases by sending a set of input data
to input ports and verifying the output data against the expected results.

```YAML
name: "Simple example of passing tests"
topic: "core/Repeat"
fixture:
 type: 'fbp'
 data: |
  INPORT=it.IN:IN
  OUTPORT=f.OUT:OUT
  it(core/Repeat) OUT -> IN f(core/Repeat)

cases:
-
  name: 'sending a boolean'
  assertion: 'should repeat the same'
  inputs:
    in: true
  expect:
    out:
      equals: true
-
  name: 'sending a number'
  assertion: 'should repeat the same'
  inputs:
    in: 1000
  expect:
    out:
      equals: 1000
```

#### Multiple ports

You can send data to multiple inports and check expectations on multiple ports per testcase:

```YAML
-
  name: '1 active track toggled high'
  assertion: 'should give value1 color'
  inputs:
    tracks: 1
    animation: [
      0, # track idx
      "0xEE00EE", # val0
      "0xAA00AA", # val1
      200, # period
      50, # dutycycle
      0, # offset
      500 ] # duration
    clock: 250
  expect:
    clock:
     equals: 250
    value:
     equals: [0, 0x00AA] # FIXME: truncated
```

#### Sequence of packets

For testing components with state, you can sending multiple input packets
[in sequence](./examples/sequences.yaml).

```YAML
-
  name: 'sequence of data using spacy notation'
  assertion: 'should pass'
  inputs:
    -
      in: true
    -
      in: false
  expect:
    - 
      out:
        equals: true
    -
      out:
        equals: false 
```

#### Extract data using path

With `path` you can specify a [JSONPath](http://goessner.net/articles/JsonPath/)
to extract the piece(s) of data the assertions will be ran against:

```YAML
-
  name: 'select single value'
  assertion: 'should pass'
  inputs:
    in: { outer: { inner: { foo: 'bar' } } }
  expect:
    out:
      path: '$.outer.inner.foo'
      equals: 'bar'
-
  name: 'selecting many correct values'
  assertion: 'should pass'
  inputs:
    in:
      outer:
        first: { foo: 'bar' }
        second: { foo: 'bar' }
  expect:
    out:
      path: '$.outer.*.foo'
      equals: 'bar'
```

#### Skipping tests

Setting `skip` property on a testcase or suite, will cause it to not be ran.
Should contain a message of the reason for skipping.

```YAML
-
  name: 'a test that is skipped'
  assertion: 'will not be ran'
  inputs:
    in: 1000
  expect:
    out:
      equals: 1000
  skip: 'not implemented yet'
```

#### Using fixtures

One can use testing-specific components in the fixture, to simplify
driving the unit under test with complex inputs and performing complex assertions.

```YAML
fixture:
 type: 'fbp'
 data: |
  INPORT=imagename.IN:NAME
  INPORT=testee.PARAM:PARAM
  INPORT=reference.IN:REFERENCE
  OUTPORT=compare.OUT:SIMILARITY

  generate(test/GenerateTestImage) OUT -> IN testee(my/Component)
  testee OUT -> ACTUAL compare(test/CompareImage)
  reference(test/ReadReferenceImage) OUT -> REFERENCE compare
cases:
-
  name: 'testing complex data with custom components fixture'
  assertion: 'should pass'
  inputs:
    name: someimage
    param: 100
    reference: someimage-100-result
  expect:
    similarity:
      above: 0.99
```

#### Supported assertions

Instead of `equals` you can use any of the supported assertion predicates. Examples include:

    type
    above
    below
    contains
    haveKeys
    includeKeys

For a full set of assertions, see [the schema](./schemata/expectation.yaml)

#### More

A comprehensive set of examples can be found under [./examples](./examples).
For the detailed definition of the dataformat for tests, see [schemata/](./schemata/).


## Running tests with the fbp-spec commandline tool

The simplest and most universal way of running tests is with the `fbp-spec` commandline tool.

    $ fbp-spec --address ws://localhost:3333 examples/multisuite-failandpass.yaml

    MultiSuite, failing tests
      sending a boolean with wrong expect
        should fail: ✗ Error: expected true to equal false
      sending a number with wrong expect
        should fail: ✗ Error: expected 1000 to equal 1003
    MultiSuite, passing tests
      sending a boolean
        should repeat the same: ✓
      sending a number
        should repeat the same: ✓

The `--command` option can be used to specify a command which will start the runtime under test:

    fbp-spec --command "node my-runtime.js" examples/

Multiple suite files (or directories) can be given at once.
It sets the exit status to non-zero on failure, so is suitable for integrating into a `Makefile` or CI workflow.
Run `fbp-spec --help` for the full set of options.

Use the `--component-tests` option to also load fbp-spec tests
attached to components on the runtime, and `--trace` to store a replayable
[Flowtrace](https://github.com/flowbased/flowtrace) for each testcase under `.flowtrace/`.

## Running tests from a JavaScript application

The test runner is available as a zero-build ES Module,
and can be used from Node.js or bundled for the browser.

```js
import { Runner, runAll, runTestAndCheck } from 'fbp-spec';
import * as testsuite from 'fbp-spec/testsuite';

// Load suites from a file, directory or HTTP URL
const suites = await testsuite.getSuites('./examples/simple-passing.yaml');
// Or parse a YAML string directly, for example fetched from a project store:
// const suites = testsuite.loadYAML(yamlSource);

// Either pass a runtime definition (fbp-spec will connect), or an
// already-connected fbp-client instance
const runner = new Runner({
  protocol: 'websocket',
  address: 'ws://localhost:3569',
  secret: '', // optional. If needed to connect/authenticate to runtime
});

await runner.connect();
await runAll(runner, suites, (updated) => {
  // Called as test results come in; testcase objects get
  // .passed and .error set in-place, suitable for rendering progress
  ui.renderProgress(updated);
});
await runner.disconnect();
```

For finer-grained control, set up a suite and run individual testcases:

```js
await runner.setupSuite(suite);
const result = await runTestAndCheck(runner, testcase);
// result: { passed: true } or { passed: false, error: Error }
await runner.teardownSuite(suite);
```

Test suites can be validated against the fbp-spec schemas:

```js
import { validate } from 'fbp-spec/testsuite';
const results = validate(suites);
// results: { valid, passed, errors, missing }
```

## Generating tests programatically

The test-format defined by fbp-spec is fairly generic and versatile. It is intended primarily as
a format one directly specifies tests in, but can also be generated from other sources.

Sometimes data-driven testing, one does a large amount of very similar tests,
with multiple test-cases per set of input data.
By capturing only the unique parts of testcases in a specialized data-structure (JSON, YAML, etc),
and then transforming this into standard `fbp-spec` files with some code, adding/removing
cases becomes even easier.
For instance in `imgflo-server`, [testcases](https://github.com/jonnor/imgflo-server/blob/master/spec/graphtests.yaml)
can be defined by providing a name, an URL and a reference result (a file with naming convention based on name).

Similarly, one can generate testcases using fuzzing, schema-based, model-based or similar tools.

## Add support for a new runtime

You need to implement the [FBP network protocol](https://github.com/flowbased/fbp-protocol).
At least the `protocol:runtime`, `protocol:graph`, and `protocol:network` capabilities are required.

All transports supported by [fbp-protocol-client](https://github.com/flowbased/fbp-protocol-client)
are supported by fbp-spec, including WebSocket, WebRTC, and iframe/postMessage.

fbp-spec is intended to be used with flow-based and dataflow-programming,
but might be useful also outside these programming paradigms. Try it out!

## Writing a test runner in another language

As long as you stay compatible with the [fbp-spec testformat](./schemata/)
and [FBP protocol](http://noflojs.org/documentation/protocol/),
you can implement a compatible runner in any programming language.

You can consider the fbp-spec code (in JavaScript) as a reference implementation.
