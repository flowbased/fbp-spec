
fbpspec = require 'fbp-spec/src/index'

# DOM helpers
id = (name) ->
  document.getElementById name

# fbp-spec UI library
# List of tests
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

# Project wide test status
countCases = (suites, predicate) ->
  count = 0
  for suite in suites
    for testcase in suite.cases
      count += 1 if predicate testcase, suite
  return count
      
class TestStatusClass
  render: () ->
    total = countCases @props.suites, () -> return true
    passing = countCases @props.suites, (c) -> return c.passed? and c.passed
    failing = countCases @props.suites, (c) -> return c.passed? and not c.passed
    skipped = countCases @props.suites, (c, s) -> return c.skip? or s.skip?
    # TODO: also consider pending
    # TODO: visualize running / not-running
    # FIXME: visualize overall pass/fail
    (ul {className: 'test-status'}, [
      (li {className: 'pass'}, passing)
      (li {className: 'fail'}, failing)
      (li {className: 'skip'}, skipped)
      (li {}, total)
    ])

TestStatus = React.createFactory TestStatusClass

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
    done = (error) ->
      updateCallback()
      callback error

    
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
      return done error

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
    React.render (TestStatus {suites: suites}), id('status')
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
