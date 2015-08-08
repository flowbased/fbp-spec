
#fbpspec = require 'fbp-spec/src/index'
widgets = fbpspec.ui.widgets

# DOM helpers
id = (name) ->
  document.getElementById name

# Main
main = () ->
  console.log 'main'

  suiteA = fbpspec.testsuite.loadYAML id('fixture-microflo-toggleanimation').innerHTML
  suiteB = fbpspec.testsuite.loadYAML id('fixture-suite-simple-passing').innerHTML
  suites = [suiteA, suiteB]   

  onTestsChanged = () ->
    React.render (widgets.TestsListing {suites: suites}), id('listing')
    React.render (widgets.TestStatus {suites: suites}), id('status')
    console.log 'rendered'
  onTestsChanged()

  rt = {
    "label": "MicroFlo Simulator",
    "description": "The first component in the world",
    "type": "microflo",
    "protocol": "websocket",
    "address": "ws://localhost:3333",
    "secret": "microflo32",
    "id": "2ef763ff-1f28-49b8-b58f-5c6a5c23af2d",
    "command": "microflo runtime --port 3333 --file build/emscripten/microflo-runtime.js"
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
