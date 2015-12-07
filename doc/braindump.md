

## Testing non-FBP programs

fbp-spec requires that the *tests* are expressed as FBP programs,
however the program-under-test can be anything - as long as it can be accessed
from a FBP runtime.
For instance, one could have a test fixture which excersises
a commandline-program, an HTTP service, a library API (possibly using FFI),
or even some hardware device.

NoFlo is general purpose, and would be suitable for writing such tests.

TODO: write a simple example testing a non-FBP program

## From failure to regression-test

Many issues are found underway during development, or after a version of the software is in use in production.
To get to high-quality software fast, we'd like to minimize the time spent on going from a failure to fixed software,
including a testcase which ensures the problem is, and continues to be, fixed.

Process:

* Spot the problem. Can be manual or automated, by monitoring services/tools.
* Get the input data that triggered it. Can for instance come from a Flowtrace.
* Create a testcase for this. fbp-spec in our case
* Verify testcase reproduces problem
* Create a minimal testcase from original

References:

> The DeltaDebugging algorithm generalizes and simplifies some failing test case
> to a minimal test case that still produces the failure;
> it also isolates the difference between a passing and a failing test case.
[Simplifying and isolating failure-inducing input](https://www.st.cs.uni-saarland.de/papers/tse2002/tse2002.pdf)


## Generative testing

### Fuzzing of input data

Desired features:

* Start with a reference object, mutate until test fails.
* Generate objects from scratch.
* Use JSON schema as basis for understanding valid/invalid

Existing:

* [JsonGen](http://stolksdorf.github.io/JsonGen): JavaScript, uses DSL embedded in strings for variation.
* [popcorn](https://github.com/asmyczek/popcorn): Embedded DSL in JavaScript, pluggable generators. Not changed since 2010
* [fuzzer](https://www.npmjs.com/package/fuzzer): JavaScript NPM package, mutates JS objects. Tailored for HTTP API fuzzing
* [hotfuzz](https://www.npmjs.com/package/hotfuzz): JavaScript, for testing Jade templates. Mutates ref object
* [json-fuzz-generator](https://github.com/deme0607/json-fuzz-generator): Ruby gem, generates valid or invalid data from JSON schema.
* [Peach JSON tutorial](http://www.rockfishsec.com/2014/01/fuzzing-vulnserver-with-peach-3.html): Peach is generic with protocols/format described in XML


## Invariant-based testing

An invariant is something that should hold true always (or for a wide set of inputs).
Unlike a testcase they are not tested explicity with assertion on a particular output.
Instead it should be possible to describe invariants, and attach something that validates
them when running all the regular testcases.
This would be especially important in combination with fuzzing, since can then
generate and validate large sets of testcases.

Examples:

* Output is always valid according to a JSON schema
* One part of object always has same relation to another. Larger than, equal, not-equal
* Output always obeys some constraint beyond that of schema. Number always multiple of 10

Related:

* [Agree](https://github.com/jonnor/agree), contracts-programming for JavaScript, allows expressing invariants


## Related

* https://github.com/microflo/microflo/blob/master/doc/braindump.md#correctness-testing

