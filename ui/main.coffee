
fbpspec = require 'fbp-spec/src/index'

# DOM helpers
id = (name) ->
  document.getElementById name

# fbp-spec UI library
{ div, label, span } = React.DOM
class SuiteHeaderClass
  render: () ->
    (div {className: 'suite-header'}, [
      label {}, @props.name
      label {}, @props.component
    ])
SuiteHeader = React.createFactory SuiteHeaderClass

class SuiteHeaderClass
  render: () ->
    (div {className: 'suite-header'}, [
      label {}, @props.name
      label {}, "(#{@props.topic})" if @props.name != @props.topic
    ])
SuiteHeader = React.createFactory SuiteHeaderClass

# TODO: inject inline  depending on @props.passed
class TestCaseListingClass
  render: () ->
    passChar = if @props.passed then '✔' else '✘'
    (div {className: "testcase-header"}, [
      (label {}, @props.name)
      (label {}, [@props.assertion, (span {}, passChar)] )
    ])
TestCaseListing = React.createFactory TestCaseListingClass

{ ul, li } = React.DOM
class TestsListingClass
  render: () ->
    createSuite = (suite) ->
      items = []
      items.push (SuiteHeader suite)
      for testcase in suite.cases
        items.push (li {}, [TestCaseListing testcase])
      return items
    (ul {className: 'horizontal-list'}, [
      @props.suites.map createSuite
    ])
TestsListing = React.createFactory TestsListingClass

# Running
asyncSeries = (items, func, callback) ->
  items = items.slice 0
  results = []
  next = () ->
    if items.length == 0
      return callback null, results
    item = items.shift()
    func item, (err, result) ->
      return callback err if err
      results.unshift result
      return next()
  next()


runAllTests = (runner, suites, updateCallback, doneCallback) ->

  runTest = (testcase, callback) ->
    runner.runTest testcase, (err, actual) ->
      console.log 'test assertion', testcase.assertion, err
      error = null
      try
        chai.expect(actual).to.eql
      catch e
        error = e
      testcase.passed = not error
      testcase.error = error?.message
      console.log error, testcase.passed
      updateCallback()
      callback error

  runner.setupSuite suites[0], (err) ->
    console.log 'setup suite', err

    asyncSeries suites[0].cases, runTest, (err) ->
      console.log 'testrun complete', err

      runner.teardownSuite suites[0], (err) ->
        console.log 'teardown suite', err


# Main
main = () ->

  console.log 'main'

  suiteA = fbpspec.testsuite.loadYAML id('fixture-microflo-toggleanimation').innerHTML
  suiteB = fbpspec.testsuite.loadYAML id('fixture-suite-simple-passing').innerHTML
  suites = [suiteA, suiteB]   

  onTestsChanged = () ->
    React.render (TestsListing {suites: suites}), id('listing')
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

      runAllTests runner, suites, onTestsChanged, (err) ->
        console.log 'test run done'

        runner.disconnect (err) ->
          console.log 'disconnected'

main()
