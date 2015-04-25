
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
      label {}, @props.component
    ])
SuiteHeader = React.createFactory SuiteHeaderClass

# TODO: inject inline <span>✔</span> depending on @props.passed
class TestCaseListingClass
  render: () ->
    (div {className: "testcase-header"}, [
      (label {}, @props.name)
      (label {}, @props.assertion)
      (label {}, @props.passed)
    ])
TestCaseListing = React.createFactory TestCaseListingClass

{ ul, li } = React.DOM
class TestsListingClass
  render: () ->
    createItem = (testcase) ->
      (li {}, [TestCaseListing testcase])
    (ul {className: 'horizontal-list'}, [
      @props.cases.map createItem
    ])
TestsListing = React.createFactory TestsListingClass
# TODO: take the suites instead of cases as props


# Main
main = () ->
  console.log 'main'

  fixture = id('fixture-suite-simple-passing').innerHTML
  suite = fbpspec.testsuite.loadYAML fixture
 
#  React.render (SuiteHeader {name: 'Suite of tests', component: 'ComponentName' }), document.body
  
  React.render (TestsListing {cases: suite.cases}), document.body
  console.log 'rendered'

main()
