
fbp-spec [![Build Status](https://secure.travis-ci.org/flowbased/fbp-spec.png?branch=master)](http://travis-ci.org/flowbased/fbp-spec)
=========

A runtime-independent test framework for Flow Based Programming (FBP) component and graphs,
using data-driven testing.

One can use fbp-spec to do testing at multiple levels,
each approximately corresponding to the different architectural levels
of Flow Based Programming:

* Unit (FBP component/subgraph)
* Integration (FBP graph)
* System (FBP runtime)

Out-of-scope:

* Testing conformance with the FBP protocol,
instead use [fbp-protocol](https://github.com/flowbased/fbp-protocol)
* Testing the FBP runtime/engine itself,
instead use a testing framework tailored for your particular runtime language/environment

Status:
-------
**Minimally useful**, one can create tests and run them.

* Tested with several FBP runtimes: [NoFlo](https://noflojs.org), [MicroFlo](https://microflo.org)
* Runners availalble for contious integration (CLI, Mocha) and interactively (in [Flowhub](https://flowhub.org))


Test format
-----------

fbp-spec defines a dataformat for tests, see [schemata/](./schemata/).
The tests can be written by hand in human-friendly YAML or be created using programmatic tools.

Each declared test suite loads an FBP component (or graph) fixture,
and runs a set of test cases by sending a set of input data
to input ports and verifying the output data against the expected results.

One can use testing-specific components in the fixture, to simplify
driving the unit under test with complex inputs and performing complex assertions.


Test runners
------------

The tests are driven using the
[FBP runtime protocol](http://noflojs.org/documentation/protocol/).

fbp-spec provides a reference test runner as a commandline tool `fbp-spec`,
which is suitable for use in continious integration systems.

Other test runners can be implemented by reusing the dataformat and the protocol.
Since August 2015, Flowhub IDE has an integrated editor and runner for fbp-spec tests.


Usage
======

TODO: document
