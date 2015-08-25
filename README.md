
fbp-spec [![Build Status](https://secure.travis-ci.org/flowbased/fbp-spec.png?branch=master)](http://travis-ci.org/flowbased/fbp-spec)
=========

A runtime-independent test framework for Flow Based Programming (FBP) component and graphs,
using declarative, data-driven testing.

One can use fbp-spec to do testing at multiple levels,
each approximately corresponding to the different architectural levels of Flow Based Programming:

* Unit (FBP component/subgraph)
* Integration (FBP graph)
* System (FBP runtime)

## Status:

**Minimally useful**, one can create tests and run them.

* Tested with several FBP runtimes: [NoFlo](https://noflojs.org), [MicroFlo](https://microflo.org), [Python example](https://github.com/flowbased/protocol-examples)
* Runners available for contious integration (CLI, Mocha) and interactively (in [Flowhub](https://flowhub.org))

## Out-of-scope

Note: `fbp-spec` is intended for use by application and component-library developers. The following is considered out-of-scope:

* Testing conformance with the FBP protocol. Instead use [fbp-protocol](https://github.com/flowbased/fbp-protocol)
* Testing an FBP runtime/engine itself. Instead use a testing framework for your particular runtime language/environment.

## License

The [MIT license](./LICENSE.md)

# Usage

## Installing

Set up fbp-spec as an NPM dependency

    npm install --save-dev fbp-spec

or, install it globally. Useful if you just want the commandline tool

    npm install -g fbp-spec

## Writing a simple test

fbp-spec defines a dataformat for tests, see [schemata/](./schemata/).

Each declared test suite loads an FBP component (or graph) fixture,
and runs a set of test cases by sending a set of input data
to input ports and verifying the output data against the expected results.

One can use testing-specific components in the fixture, to simplify
driving the unit under test with complex inputs and performing complex assertions.


## Running tests with fbp-spec commandline tool

The simplest and most universal way of running tests is with the `fbp-spec` commandline tool.

    $ fbp-spec --address ws://localhost:3333 examples/multisuite-failandpass.yaml
    MultiSuite, failing tests
      sending a boolean with wrong expect
        should fail: ✗ Error: expected true to deeply equal false
      sending a number with wrong expect
        should fail: ✗ Error: expected 1000 to deeply equal 1003
    MultiSuite, passing tests
      sending a boolean
        should repeat the same: ✓
      sending a number
        should repeat the same: ✓

The `--command` options can be used to specify a command which will start the runtime under test:

    fbp-spec --command "python2 protocol-examples/python/runtime.py

It sets the exit status to non-zero, so is suitable for integrating into a `Makefile` or similar.

## Running tests by integrating with Mocha

[Mocha](http://mochajs.org/)  is a popular test runner framework for JavaScript/CoffeeScript on browser and node.js.

You can have your fbp-spec tests run in Mocha by calling the `fbpspec.mocha.run()` function, in a file which is
executed with the standard Mocha runner. Eg. `mocha --reporter spec tests/fbpspecs.js`

    // fbpspecs.js
    fbpspec = require('fbp-spec');

    rt = {
      protocol: "websocket",
      address: "ws://localhost:3569",
      secret: "py3k", // Optional. If needed to connect/authenticate to runtime
      command: 'python2 protocol-examples/python/runtime.py' // Optional. Can be used to start runtime automatically
    };
    fbpspec.mocha.run(rt, './examples/simple-passing.yaml', { starttimeout: 1000 });

The tests can be specified as a list of files, or directories.
You can use the standard `grep` option of Mocha to run only some tests.

For CoffeScript example, see [./spec/mocha.coffee](./spec/mocha.coffee).

## Running tests interactively in Flowhub

[Flowhub](http://app.flowhub.io) IDE (version 0.11 and later) has integrated support for fbp-spec. No installation is required.

* Open existing project, or create a new one
* Add a new test by going to ``
* Ensure you have a runtime set up, and connected

When you make changes to your project (components,graphs) or tests, Flowhub will automatically re-run your tests.
You can see the status in the top-right corner. Clicking on it brings up more details.

## Generating tests programatically

The test-format defined by fbp-spec is fairly generic and versatile. It is intended primarily as
a format one directly specifies tests in, but can also be generated from other sources.

Sometimes data-driven testing, one does a large amount of very similar tests,
with multiple test-cases per set of input data.
By capturing only the unique parts of testcases in a specialied data-structure (JSON, YAML, etc),
and then transforming this into standard `fbp-spec` files with some code, adding/removing
cases becomes even easier.
For instance in `imgflo-server`, [testcases](https://github.com/jonnor/imgflo-server/blob/master/spec/graphtests.yaml)
can be defined by providing a name, an URL and a reference result (a file with naming convention based on name).

Similarly, one can generate testcases using fuzzing, schema-based, model-based or similar tools.

## Integrating test runner in an application

The test runner code is accessible as a JavaScript library,
and can be integrated into other apps (like Flowhub does).
See examples of [commandline](./src/cli.coffee) and [webappp](./ui/main.coffee) usage.

## Add supporting for a new runtime

You need to implement the [FBP network protocol](https://github.com/flowbased/fbp-protocol).
At least the `protocol:runtime`, `protocol:graph`, and `protocol:network` capabilities are required.

All transports supported by [fbp-protocol-client]((https://github.com/flowbased/fbp-protocol))
are supported by fbp-spec, including WebSocket, WebRTC, and iframe/postMessage.

fbp-spec is intended to be used with flow-based and dataflow-programming,
but might be useful also outside these programming paradigms. Try it out!

## Writing a test runner in another language

As long as you stay compatible with the [fbp-spec testformat](./schemata/)
and [FBP protocol](http://noflojs.org/documentation/protocol/),
you can implement a compatible runner in any programming language.

You can consider the fbp-spec code (in CoffeeScript) as a reference implementation.

