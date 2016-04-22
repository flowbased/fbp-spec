fbpspec = require 'fbp-spec/src/index' if not fbpspec
widgets = fbpspec.ui.widgets

# DOM helpers
id = (name) ->
  document.getElementById name

# Main
main = () ->
  console.log 'main'

  onTestsChanged = (suites) ->
    React.render (widgets.TestsListing {suites: suites}), id('listing')
    React.render (widgets.TestStatus {suites: suites}), id('status')
    console.log 'rendered'

  # Runtime should be started in advance. Normally done by Grunt
  rt =
    protocol: "websocket"
    address: "ws://localhost:3334"
  base = window.location.origin
  testfiles = [
    "#{base}/examples/simple-failing.yaml"
    "#{base}/examples/simple-passing.yaml"
  ]

  runTests = () ->
    runner = new fbpspec.runner.Runner rt
    fbpspec.testsuite.getSuites testfiles, (err, suites) ->
      console.log 'loaded', err
      onTestsChanged suites # initial render

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
