
# DOM helpers
id = (name) ->
  document.getElementById name
fromProto = (name) ->
  proto = id "proto-#{name}"
  element = proto.cloneNode true
  element.removeAttribute 'id' # make sure not tied to prototype
  return element

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


# Main
main = () ->
  console.log 'main'

  suiteA = fbpspec.testsuite.loadYAML id('fixture-microflo-toggleanimation').innerHTML
  suiteB = fbpspec.testsuite.loadYAML id('fixture-suite-simple-passing').innerHTML
   
  React.render (TestsListing {suites: [suiteA, suiteB]}), document.body
  console.log 'rendered'

main()
