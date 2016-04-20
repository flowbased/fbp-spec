
# 0.1.8 - released 20.04.2016

* `testsuite.validate()`: Fix not catching invalid files, due to wrong schema lookup
* Add support for sequences of inputs/expect. Allows testing stateful components/graphs/systems.

# 0.1.7 - released 17.04.2016

* Make `fixture` optional. If not specified, will be auto-created from component/graph in `topic`

# 0.1.6 - released 14.04.2016

* Some improvements to experimental `fbp-spec-mocha`

# 0.1.4 - released 07.05.2016

* Send `network:output` FBP messages to `console.log()`, for easier debugging of problems on runtime side.
* Added experimental `fbp-spec-mocha` tool, for running Mocha tests over fbp-spec protocol.

# 0.1.3 - released 27.08.2015

First useful release

* Initial YAML testformat fully defined
* Tested with NoFlo, MicroFlo and Python example runtimes
* `fbp-spec` commandline tool for running
* `fbpspec.mocha.run` for integration in a Mocha testsuite
* Simple set of UI widgets, with experimental integration in noflo-ui

# 0.0.1 - released 17.04.2015

Proof of concept

* Could run a MicroFlo testcase by talking over FBP runtime protocol
