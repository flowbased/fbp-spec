
fbp-spec
=========

A runtime-independent test framework for FBP component and graphs,
using data-driven testing.

One can use fbp-spec to do testing at unit- (component), integration- and system-level (graphs).

fbp-spec defines a dataformat for tests, see [schemata/](./schemata/).
Each declared test suite loads an FBP component (or graph),
and runs a set of test cases by sending a set of input data
to input ports and verifying the output data against the expected results.

The tests are driven using the
[FBP runtime protocol](https://github.com/flowbased/fbp-protocol).

fbp-spec tests can be returned by a runtime in the `component:getsource` message,
and will then be automatically picked up.
Such tests can be seen as example usage of a component.


fbp-spec provides a reference test runner as a commandline tool `fbp-spec`,
which is suitable for use in continious integration systems.

Other test runners can be implemented by reusing the dataformat and the protocol.
Integrating a fbp-spec test runner in Flowhub IDE is planned.


Out-of-scope:

* Testing conformance with the FBP protocol,
use [fbp-protocol](https://github.com/flowbased/fbp-protocol)
* Testing the FBP runtime/engine itself,
use a testing framework tailored for your particular runtime language/environment


Usage
======

TODO: document
