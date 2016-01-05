
## Run Mocha testcases using fbp-spec as a runner/frontend
## Intended to allow existing Mocha testcases to be seen and executed
## from a FBP protocol client like Flowhub, without requiring them
## to be rewritten as fbp-spec tests
## This is especially useful to allow partial and gradual migration of existing test suites
## See also ./mocha.coffee, which can be used in combination

# Partially based on example code from https://github.com/mochajs/mocha/wiki/Third-party-UIs

Mocha = require 'mocha'

fs = require 'fs'
path = require 'path'
http = require 'http'
websocket = require './websocket' # FIXME: split out transport interface of noflo-runtime-*, use that directly

debug = require('debug')('fbp-spec:mochacompat')
testsuite = require './testsuite'

loadTests = (files) ->
  options = {}
  mocha = new Mocha options

  for f in files
    mocha.addFile f
  mocha.loadFiles()
  return mocha

# similar to mocha.run(), but files must be loaded beforehand
runTests = (mocha, progress, callback) ->

  suite = mocha.suite
  options = mocha.options
  options.files = mocha.files
  runner = new Mocha.Runner suite, options.delay
  registerReporter = (r) ->
    runner.on 'pass', (test) ->
      progress null, test
    runner.on 'fail', (test, err) ->
      progress err, test

  mocha.reporter registerReporter, {}
  reporter = new mocha._reporter runner, options

  runner.ignoreLeaks = options.ignoreLeaks != false
  runner.fullStackTrace = options.fullStackTrace
  runner.asyncOnly = options.asyncOnly
  runner.allowUncaught = options.allowUncaught
  if options.grep
    runner.grep options.grep, options.invert
  if options.globals
    runner.globals options.globals
  if options.growl
    mocha._growl runner, reporter
  if options.useColors?
    Mocha.reporters.Base.useColors = options.useColors
  Mocha.reporters.Base.inlineDiffs = options.useInlineDiffs

  done = (failures) ->
    if reporter.done
      reporter.done failures, callback
    else
      callback && callback failures

  return runner.run done

testFilesInDirectory = (testDir) ->

  files = fs.readdirSync(testDir)
  .filter (filename) ->
    isJs = filename.substr(-3) == '.js';
    isCoffee = filename.substr(-7) == '.coffee';
    return isJs or isCoffee
  .map (filename) ->
    return path.join testDir, filename

  return files

testId = (fullname) ->
  crypto = require 'crypto'
  hash = crypto.createHash 'sha256'
  hash.update fullname
  return hash.digest('hex').substr(0, 10)

loadSuite = (fbpSuite, suite) ->

  for testcase in suite.tests
    #console.log 't', testcase

    fullName = fbpSuite.name + testcase.parent.title + testcase.title
    id = testId fullName
    testcase._fbpid = id
    fbpCase =
      name: testcase.parent.title
      assertion: testcase.title
      _id: id
      inputs:
        test: id
      expect:
        error:
          noterror: null

    fbpSuite.cases.push fbpCase

  # load recursively
  for sub in suite.suites
    loadSuite fbpSuite, sub

buildFbpSpecs = (mocha) ->
  specs = []

  top = mocha.suite
  for suite in top.suites
    #console.log 's', suite

    fbpSuite = testsuite.create
      name: "#{suite.title} (Mocha tests)"
      fixture:
        type: 'fbp'
        data: """
        # @runtime fbp-spec-mocha

        INPORT=run.IN:TEST
        OUTPORT=run.ERROR:ERROR

        runTest(mocha/LoadTestCase) OUT -> IN verifyResult(mocha/CheckResults)
        """

    loadSuite fbpSuite, suite
    specs.push fbpSuite

  return specs

dumpSpecs = (suites) ->
  jsyaml = window.jsyaml if window?.jsyaml?
  jsyaml = require 'js-yaml' if not jsyaml

  str = ""
  for s in suites   
    str += "---\n#{jsyaml.safeDump s}"

  return str

discoverHost = (preferred_iface) ->
  os = require 'os' # node.js only

  ifaces = os.networkInterfaces()
  address = undefined
  int_address = undefined

  filter = (connection) ->
    if connection.family != 'IPv4'
      return
    if connection.internal
      int_address = connection.address
    else
      address = connection.address
    return

  if typeof preferred_iface == 'string' and preferred_iface in ifaces
    ifaces[preferred_iface].forEach filter
  else
    for device of ifaces
      ifaces[device].forEach filter
  address or int_address

knownUnsupportedCommands = (p, c) ->
  return false

handleFbpCommand = (runtime, mocha, protocol, command, payload, context) ->
  state =
    started: false
    running: false
    currentTest: null
    graph: null

  updateStatus = (news, event) ->
    state.started = news.started if news.started?
    state.running = news.running if news.running?
    debug 'update status', state
    runtime.send 'network', event, state, context

  #sendEvent = (e) ->
  #  runtime.send e.protocol, e.command, e.payload, context
  ackMessage = ->
    # reply with same message as we got in
    runtime.send protocol, command, payload, context

  ## Runtime
  if protocol == 'runtime' and command == 'getruntime'
    capabilities = [
      'protocol:graph' # read-only from client
      'protocol:component' # read-only from client
      'protocol:network'
      'component:getsource'
    ]
    info =
      type: 'fbp-spec-mocha'
      version: '0.5'
      capabilities: capabilities
      allCapabilities: capabilities
      graph: 'default/main' # HACK, so Flowhub will ask for our graph
    runtime.send 'runtime', 'runtime', info, context
    #sendGraphs mytrace, send, (err) -> # XXX: right place?
      # ignored

  else if protocol == 'runtime' and command == 'packet'
    debug 'test message', payload, state.running

    if payload.port != 'test' or payload.event != 'data'
      debug 'unexpected test message format'
      return

    state.currentTest = payload.payload

    if not state.running
      testDone = (err, test) ->
        debug 'test completed', test._fbpid, state.currentTest, err
        if test._fbpid and test._fbpid == state.currentTest
          m =
            graph: state.graph
            event: 'data'
            port: 'error'
            payload: err
          runtime.send 'runtime', 'packet', m, context

      runTests mocha, testDone, (f) ->
        updateStatus { running: false }, 'status'

      updateStatus { running: true }, 'status'

  ## Graph
  else if protocol == 'graph' and command == 'addnode'
    ackMessage()
  else if protocol == 'graph' and command == 'addedge'
    ackMessage()
  else if protocol == 'graph' and command == 'addinport'
    ackMessage()
  else if protocol == 'graph' and command == 'addoutport'
    ackMessage()
  else if protocol == 'graph' and command == 'clear'
    state.graph = payload.id
    debug 'new graph', state.graph
    ackMessage()

  ## Network
  else if protocol == 'network' and command == 'getstatus'
    runtime.send 'network', 'status', state, context

  else if protocol == 'network' and command == 'start'
    debug 'FBP network start'
    updateStatus { started: true, running: false }, 'started'
  else if protocol == 'network' and command == 'stop'
    debug 'FBP network stop'
    updateStatus { started: false, running: false }, 'stopped'

  ## Component
  else if protocol == 'component' and command == 'list'
    # TODO> send dummy component listing?

  else if protocol == 'component' and command == 'getsource'
    # 

  else if knownUnsupportedCommands protocol, command
    # ignored
  else
    debug 'Warning: Unknown FBP protocol message', protocol, command

## Commandline things
normalizeOptions = (options) ->
  if options.host == 'autodetect'
    options.host = discoverHost()
  else if match = /autodetect\(([a-z0-9]+)\)/.exec(options.host)
    options.host = discoverHost(match[1])

  return options

parse = (args) ->
  program = require 'commander'

  program
    .arguments('<test directory>')
    .action( (dir) -> program.directory = dir )
    .option('--ide <URL>', 'FBP IDE to use for live-url', String, 'http://app.flowhub.io')
    .option('--host <hostname>', 'Hostname we serve on, for live-url', String, 'autodetect')
    .option('--port <PORT>', 'Command to launch runtime under test', Number, 3333)
    .parse(process.argv)

  return program

exports.main = main = () ->
  testDir = path.join __dirname, '../spec', 'fixtures/mochacases'
  files = testFilesInDirectory testDir
  
  mocha = loadTests files
  specs = buildFbpSpecs mocha

  options = parse process.argv
  options = normalizeOptions options

  state =
    started: false
    running: false

  httpServer = new http.Server
  runtime = websocket httpServer, {}
  runtime.receive = (protocol, command, payload, context) ->
    handleFbpCommand runtime, mocha, protocol, command, payload, context

  testsFile = 'debug-mytests.yaml'
  fs.writeFileSync testsFile, dumpSpecs(specs)
  console.log 'wrote fbp-specs to', testsFile

  httpServer.listen options.port, (err) ->
    throw err if err
    console.log "fbp-spec-mocha started on ws://#{options.host}:#{options.port}"

main() if not module.parent

