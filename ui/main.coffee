
if not fbpspec
  # built with component.io
  fbpspec = require 'fbp-spec/src/index'
widgets = fbpspec.ui.widgets

# DOM helpers
id = (name) ->
  document.getElementById name

# Main
main = () ->
  console.log 'main'

  suiteA = fbpspec.testsuite.loadYAML id('fixture-suite-simple-passing').innerHTML
  suiteB = fbpspec.testsuite.loadYAML id('fixture-suite-simple-failing').innerHTML
  suites = [suiteA, suiteB]   

  onTestsChanged = () ->
    React.render (widgets.TestsListing {suites: suites}), id('listing')
    React.render (widgets.TestStatus {suites: suites}), id('status')
    console.log 'rendered'
  onTestsChanged()

  rt = {
    "protocol": "websocket",
    "address": "ws://localhost:3569",
    "command": "python2 protocol-examples/python/runtime.py" # need to start manually!
  }

  id('runButton').onclick = () ->
    runner = new fbpspec.runner.Runner rt
    runner.connect (err) ->
      console.log 'connected', err

      fbpspec.runner.runAll runner, suites, onTestsChanged, (err) ->
        console.log 'test run done'

        runner.disconnect (err) ->
          console.log 'disconnected'

main()
