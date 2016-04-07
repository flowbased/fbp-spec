
common = require './common'
protocol = require './protocol'
testsuite = require './testsuite'
expectation = require './expectation'

fbp = require 'fbp'
fbpClient = require 'fbp-protocol-client'
debug = require('debug')('fbp-spec:runner')


debugReceivedMessages = (client) ->
  client.on 'graph', ({command, payload}) ->
    debug 'recv graph', command, payload
  client.on 'network', ({command, payload}) ->
    debug 'recv network', command, payload
  client.on 'runtime', ({command, payload}) ->
    debug 'recv runtime', command, payload
  client.on 'component', ({command, payload}) ->
    debug 'recv component', command, payload
  client.on 'execution', (status) ->
    debug 'recv execution', status

class Runner
  constructor: (@client) ->
    if @client.protocol? and @client.address?
      # is a runtime definition
      Transport = fbpClient.getTransport @client.protocol
      @client = new Transport @client
    @currentGraphId = null

  # TODO: check the runtime capabilities before continuing
  # TODO: have a timeout
  connect: (callback) ->
    debug 'connect'
    onStatus = (status) =>
      return if not status.online # ignore, might get false before getting a true

      @client.removeListener 'status', onStatus
      debug 'connected', status
      return callback null
    @client.on 'status', onStatus
    @client.connect()

    @client.on 'network', ({command, payload}) ->
      console.log payload.message if command is 'output' and payload.message

    debugReceivedMessages @client


  disconnect: (callback) ->
    debug 'disconnect'
    onStatus = (status) =>
      err = if not status.online then null else new Error 'Runtime online after disconnect()'
      @client.removeListener 'status', onStatus
      debug 'disconnected', err
      return callback err
    @client.on 'status', onStatus
    @client.disconnect()

  setupSuite: (suite, callback) ->
    debug 'setup suite', "\"#{suite.name}\""
    if suite.fixture.type == 'json'
      graph = JSON.parse suite.fixture.data
    else if suite.fixture.type == 'fbp'
      graph = fbp.parse suite.fixture.data
      graph.properties = {} if not graph.properties
    else
      graph = null
    protocol.sendGraph @client, graph, (err, graphId) =>
      @currentGraphId = graphId
      return callback err if err
      protocol.startNetwork @client, graphId, (err) =>
        return callback err

  teardownSuite: (suite, callback) ->
    debug 'teardown suite', "\"#{suite.name}\""
    # FIXME: also remove the graph. Ideally using a 'destroy' message in FBP protocol
    protocol.stopNetwork @client, @currentGraphId, (err) =>
      return callback err

  runTest: (testcase, callback) ->
    debug 'runtest', "\"#{testcase.name}\""

    received = {}
    onReceived = (port, data) =>
      debug 'runtest got output on', port
      received[port] = data
      nExpected = Object.keys(testcase.expect).length
      if Object.keys(received).length == nExpected
        @client.removeListener 'runtime', checkPacket
        return callback null, received

    checkPacket = (msg) =>
      d = msg.payload
      # FIXME: also check # and d.graph == @currentGraphId
      if msg.command == 'packet' and d.event == 'data'
        onReceived d.port, d.payload
      else if msg.command == 'packet' and ['begingroup', 'endgroup', 'connect', 'disconnect'].indexOf(d.event) != -1
        # ignored
      else
        debug 'unknown runtime message', msg
    @client.on 'runtime', checkPacket

    # send input packets
    protocol.sendPackets @client, @currentGraphId, testcase.inputs, (err) =>
      return callback err if err

runTestAndCheck = (runner, testcase, callback) ->
  runner.runTest testcase, (err, actual) ->
    error = null
    if testcase.skip
      results =
        passed: false
      # TODO: pass some skipped state? its indirectly in .skip though
    else
      try
        expectation.expect testcase, actual
      catch e
        error = e
        # FIXME: only catch actual AssertionErrors
      results =
        passed: not error
        error: error?.message

    return callback err, results

runSuite = (runner, suite, runTest, callback) ->

  runner.setupSuite suite, (err) ->
    debug 'setup suite', err
    return callback err, suite if err

    common.asyncSeries suite.cases, runTest, (err) ->
      debug 'testrun complete', err

      runner.teardownSuite suite, (err) ->
        debug 'teardown suite', err
        return callback err, suite


exports.getComponentSuites = (runner, callback) ->
  protocol.getCapabilities runner.client, (err, caps) ->
    return callback err if err
    return callback null, [] unless 'component:getsource' in caps

    protocol.getComponentTests runner.client, (err, tests) ->
      return callback err if err
      suites = loadComponentSuites tests
      debug 'get component suites', tests.length, suites.length
      return callback null, suites

loadComponentSuites = (componentTests) ->
  suites = []
  for name, tests of componentTests
    try
      ss = testsuite.loadYAML tests
      suites = suites.concat ss
    catch e
      # ignore, could be non fbp-spec test
      # TODO: include tests type in FBP protocol, so we know whether this is error or legit
      continue
  return suites

# will update each of the testcases in @suites
# with .passed and .error states as tests are ran
runAll = (runner, suites, updateCallback, doneCallback) ->

  runTest = (testcase, callback) ->
    done = (error) ->
      updateCallback suites
      callback error

    runTestAndCheck runner, testcase, (err, results) ->
      for key, val of results
        testcase[key] = val
      debug 'ran test', '"testcase.name"', testcase.passed, err
      return done null # ignore error to not bail out early

  runOneSuite = (suite, cb) ->
    runSuite runner, suite, runTest, cb

  debug 'running suites', (s.name for s in suites)
  common.asyncSeries suites, runOneSuite, (err) ->
    return doneCallback err

exports.Runner = Runner
exports.runAll = runAll
exports.runTestAndCheck = runTestAndCheck
