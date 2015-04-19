
fbp-spec
=========

A runtime-independent test framework for FBP component and graphs,
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
**Experimental**, can run simple tests


Test format
-----------

fbp-spec defines a dataformat for tests, see [schemata/](./schemata/).
The tests can be written by hand in human-friendly YAML or be created using programmatic tools.

Each declared test suite loads an FBP component (or graph) fixture,
and runs a set of test cases by sending a set of input data
to input ports and verifying the output data against the expected results.

One can use testing-specific components in the fixture, to simplify
driving the unit under test with complex inputs and performing complex assertions.


Test runner
------------

The tests are driven using the
[FBP runtime protocol](https://github.com/flowbased/fbp-protocol).

fbp-spec provides a reference test runner as a commandline tool `fbp-spec`,
which is suitable for use in continious integration systems.

Other test runners can be implemented by reusing the dataformat and the protocol.
Integrating a fbp-spec test runner in Flowhub IDE is planned.

fbp-spec tests can optionally be returned by a runtime in the `component:getsource` message,
and will then be automatically picked up by a runner.
Such tests can be seen as example usage of a component.



Usage
======

TODO: document
