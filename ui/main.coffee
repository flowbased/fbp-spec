fbpspec = require 'fbp-spec/src/index' if not fbpspec
widgets = fbpspec.ui.widgets

# DOM helpers
id = (name) ->
  document.getElementById name

parseQuery = (querystring) ->
  querystring = querystring.substring(querystring.indexOf('?')+1).split('&')
  params = {}
  for i in [querystring.length-1..0] by -1
    pair = querystring[i].split '='
    k = decodeURIComponent pair[0]
    v = decodeURIComponent pair[1]
    params[k] = v
  return params

getOptions = (query) ->
  query = window.location.toString() if not query
  options =
    secret: null
    protocol: 'websocket'
    port: null
    host: 'localhost'
    scheme: null
  # TODO: also allow to specify host/port instead of address?
  params = parseQuery query
  for k, v of params
    options[k] = v

  if options.protocol == 'websocket'
    options.port = 3569 if not options.port
    options.scheme = 'ws' if not options.scheme
    options.address = "#{options.scheme}://#{options.host}:#{options.port}"

  options.port = 80 if not options.port

  return options

# Main
main = () ->
  console.log 'main'

  onTestsChanged = (suites) ->
    React.render (widgets.TestsListing {suites: suites}), id('listing')
    React.render (widgets.TestStatus {suites: suites}), id('status')
    console.log 'rendered'

  # Runtime should be started in advance. Normally done by Grunt
  options = getOptions()
  base = window.location.origin
  testfiles = [
    "#{base}/examples/simple-failing.yaml"
    "#{base}/examples/simple-passing.yaml"
  ]

  runTests = () ->
    runner = new fbpspec.runner.Runner options
    runner.client.setParentElement id('runtime') if runner.client.setParentElement # iframe support

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
