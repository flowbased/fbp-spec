
# DOM helpers
id = (name) ->
  document.getElementById name
fromProto = (name) ->
  proto = id "proto-#{name}"
  element = proto.cloneNode true
  element.removeAttribute 'id' # make sure not tied to prototype
  return element

# fbp-spec UI library
renderTestListing = (suites) ->
  listview = document.createElement 'div'
  listview.setAttribute 'class', 'horizontal-list'

  for suite in suites
    item = fromProto 'suite-header'
    # FIXME: set properties
    listview.appendChild item

    for testcase in suite.cases
      item = fromProto 'testcase-listing'
      # FIXME: set properties from data
      listview.appendChild item

  return listview

# Main
main = () ->
  console.log 'main'

  fixture = id('fixture-suite-simple-passing').innerHTML
  suite = fbpspec.testsuite.loadYAML fixture
 
  testListing = renderTestListing [suite]
  console.log 'rendered'
  id('main').appendChild testListing

main()
