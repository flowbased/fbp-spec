# 0.8.0 - released 11.11.2020

* Added a `--trace` command-line flag to capture Flowtraces for fbp-spec runs. The Flowtraces will be stored into a `.flowtrace` folder under the project

# 0.7.1 - released 22.10.2020

* Fixed issue with loading spec files

# 0.7.0 - released 22.10.2020

* Added a `--component-tests` command-line flag to control whether fbp-spec loads additional component tests from the runtime
* Ported from CoffeeScript to modern JavaScript

# 0.6.8 - released 09.09.2020

* Made fbp-spec ignore failing getSource requests
* If network setup fails, teardown for the network will also be skipped

# 0.6.7 - released 01.09.2020

* Updated dependencies to include latest FBP Protocol Client and Schemas
* Updated browser build to use a modern Babel version

# 0.6.2 - released 31.03.2018

* Fixed a race condition with synchronous networks where we expect multiple output packets

# 0.6.1 - released 31.03.2018

* Fixed issue where received bracket IPs were causing fbp-spec to not see the actual data packet

# 0.6.0 - released 30.03.2018

* Switched FBP Protocol communications with the runtime to use the new [fbp-client](https://github.com/flowbased/fbp-client) library
* All messages to and from runtime are now validated against the FBP Protocol schema
* Permissions are now validated against capabilities advertised by the runtime
* Tests now fail if runtime breaks the connection (for example, if runtime crashes mid-run)
* Tests now fail if runtime sends a `network:error` message
* Tests now fail if runtime sends a `network:processerror` message
* Tests now fail if runtime sends a message to an exported `error` outport if message to that port was expected
* All FBP Protocol operations now time out if there is no response

# 0.5.0 - released 17.11.2017

* Updated to fbp parser 1.7 which introduces consistency validations for graphs. This can cause some tests to break due to them having incorrectly defined nodes in them

Bugfixes:

* We actually catch and show FBP parsing errors now

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
