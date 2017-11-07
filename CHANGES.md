# 0.4.1 - released 07.11.2017

Breaking changes

* Require ES6 support. Node.js 6+ or a modern browser.
If support for older environments are needed, use Babel to transpile.

Internal changes

* Now using CoffeeScript 2

# 0.3.0 - released 06.11.2017

* Updated to fbp-protocol-client 0.2.x, without support for MicroFlo transport

# 0.2.3 - released 04.10.2017

Bugfixes

* Fixed triggering Mocha error in start/stop due to returning Promise. Regression since 0.2.2.

# 0.2.2 - released 03.10.2017

* Automatically retry connection while during setup until `startTimeout`

# 0.2.0 - released 19.02.2017

* Updated to Mocha 3.x.
Can break tests in some cases where Promise is returned and callback is used at same time.

Internal changes

* Updated all dependencies to latest version

# 0.1.16 - released 11.10.2016

Features

* Several conveniences added in .fbp DSL from `fbp 1.5`

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
