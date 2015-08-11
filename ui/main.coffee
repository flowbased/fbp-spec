fbpspec = require 'fbp-spec/src/index' if not fbpspec
widgets = fbpspec.ui.widgets

# DOM helpers
id = (name) ->
  document.getElementById name

# Main
main = () ->
  console.log 'main'

  suites = []
  suites = suites.concat fbpspec.testsuite.loadYAML id('fixture-suite-simple-passing').innerHTML
  suites = suites.concat fbpspec.testsuite.loadYAML id('fixture-suite-simple-failing').innerHTML

  onTestsChanged = () ->
    React.render (widgets.TestsListing {suites: suites}), id('listing')
    React.render (widgets.TestStatus {suites: suites}), id('status')
    console.log 'rendered'
  onTestsChanged()

  # Runtime should be started in advance. Normally done by Grunt
  rt =
    "protocol": "websocket",
    "address": "ws://localhost:3569",
    "command": "python2 protocol-examples/python/runtime.py" # need to start manually!

  runTests = () ->
    runner = new fbpspec.runner.Runner rt
    runner.connect (err) ->
      console.log 'connected', err

      fbpspec.runner.runAll runner, suites, onTestsChanged, (err) ->
        console.log 'test run done'

        runner.disconnect (err) ->
          console.log 'disconnected'

  id('runButton').onclick = runTests
  setTimeout runTests, 100
  console.log 'main done'

main()
