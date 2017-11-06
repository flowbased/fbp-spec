
common = require './common'
protocol = require './protocol'
testsuite = require './testsuite'
expectation = require './expectation'

fbp = require 'fbp'
fbpClient = require 'fbp-protocol-client'
debug = require('debug')('fbp-spec:runner')
Promise = require 'bluebird'

debugReceivedMessages = (client) ->
  debugReceived = require('debug')('fbp-spec:runner:received')
  client.on 'graph', ({command, payload}) ->
    debugReceived 'graph', command, payload
  client.on 'network', ({command, payload}) ->
    debugReceived 'network', command, payload
  client.on 'runtime', ({command, payload}) ->
    debugReceived 'runtime', command, payload
  client.on 'component', ({command, payload}) ->
    debugReceived 'component', command, payload
  client.on 'execution', (status) ->
    debugReceived 'execution', status

synthesizeTopicFixture = (topic, components, callback) ->
    debug 'synthesizing fixture', topic
    # export each of the ports for topic component
    # return a FBP graph?
    component = components[topic]
    return callback new Error "Could not find component for topic: #{topic}" if not component

    graph =
      properties: {}
      inports: {}
      outports: {}
      processes: {}
      connections: []

    processName = 'testee'
    graph.processes[processName] =
      component: topic

    for port in component.inPorts
      portName = port.id
      graph.inports[portName] =
        process: processName
        port: portName
    for port in component.outPorts
      portName = port.id
      graph.outports[portName] =
        process: processName
        port: portName

    # Sanity checking if this is usable as a fixture
    if Object.keys(graph.outports) < 1
      return callback new Error "Component '#{topic}' used as fixture has no outports"
    if Object.keys(graph.inports) < 1
      return callback new Error "Component '#{topic}' used as fixture has no inports"

    return callback null, graph
    

# @context should have .components = {} property
getFixtureGraph = (context, suite, callback) ->
  # TODO: follow runtime for component changes

  hasComponents = (s) ->
    return s.components? and typeof s.components == 'object' and Object.keys(s.components).length

  updateComponents = (cb) ->
    return cb null if hasComponents context
    protocol.getComponents context.client, (err, components) ->
      return cb err if err
      context.components = components
      return cb null

  updateComponents (err) ->
    return callback err if err

    if not suite.fixture?
      return synthesizeTopicFixture suite.topic, context.components, callback
    else if suite.fixture.type == 'json'
      try
        graph = JSON.parse suite.fixture.data
      catch e
        return callback e
      return callback null, graph
    else if suite.fixture.type == 'fbp'
      try
        graph = fbp.parse suite.fixture.data
      catch
        return callback e
      graph.properties = {} if not graph.properties
      return callback null, graph
    else
      return callback new Error "Unknown fixture type #{suite.fixture.type}"


sendMessageAndWait = (client, currentGraph, inputData, expectData, callback) ->
  received = {}
  onReceived = (port, data) =>
    debug 'runtest got output on', port
    received[port] = data
    nExpected = Object.keys(expectData).length
    if Object.keys(received).length == nExpected
      client.removeListener 'runtime', checkPacket
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
  client.on 'runtime', checkPacket

  # send input packets
  protocol.sendPackets client, currentGraph, inputData, (err) =>
    return callback err if err



class Runner
  constructor: (@client, options={}) ->
    if @client.protocol? and @client.address?
      # is a runtime definition
      Transport = fbpClient.getTransport @client.protocol
      @client = new Transport @client
    @currentGraphId = null
    @components = {}
    @options = options
    @options.connectTimeout = 5*1000 if not @options.connectTimeout?

  # TODO: check the runtime capabilities before continuing
  connect: (callback) ->
    debug 'connect'

    debugReceivedMessages @client
    @client.on 'network', ({command, payload}) ->
      console.log payload.message if command is 'output' and payload.message

    @client.on 'error', (err) ->
      debug 'connection failed', err

    timeBetweenAttempts = 500
    attempts = Math.floor(@options.connectTimeout / timeBetweenAttempts)
    isOnline = () =>
      connected = @client.connection and @client.connecting == false
      return if connected then Promise.resolve() else Promise.reject new Error 'Not connected to runtime'
    tryConnect = () =>
      debug 'trying to connect'
      @client.connect() # does not always emit an event, so we don't bother checking any
      return Promise.resolve()
    return common.retryUntil(tryConnect, isOnline, timeBetweenAttempts, attempts).asCallback callback

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

    getFixtureGraph this, suite, (err, graph) =>
      return callback err if err
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

    # XXX: normalize and validate in testsuite.coffee instead?
    inputs = if common.isArray(testcase.inputs) then testcase.inputs else [ testcase.inputs ]
    expects = if common.isArray(testcase.expect) then testcase.expect else [ testcase.expect ]
    sequence = []
    for i in [0...inputs.length]
      sequence.push
        inputs: inputs[i]
        expect: expects[i]

    sendWait = (data, cb) =>
      sendMessageAndWait @client, @currentGraphId, data.inputs, data.expect, cb
    common.asyncSeries sequence, sendWait, (err, actuals) ->
      actuals.forEach (r, idx) ->
        sequence[idx].actual = r
      return callback err, sequence

# TODO: should this go into expectation?
checkResults = (results) ->
  actuals = results.filter (r) -> r.actual?
  expects = results.filter (r) -> r.expect?
  if actuals.length < expects.length
    return callback null,
      passed: false
      error: new Error "Only got #{actual.length} output messages out of #{expect.length}"

  results = results.map (res) ->
    res.error = null
    try
      expectation.expect res.expect, res.actual
    catch e
      # FIXME: only catch actual AssertionErrors
      res.error = e
    return res

  failures = results.filter (r) -> r.error
  if failures.length == 0
    result =
      passed: true
  else
    if expects.length == 1
      result =
        error: failures[0].error
    else if expects.length > 1 and failures.length == 1
      index = results.findIndex (r) -> r.error
      failed = results[index]
      result =
        error: new Error "Expectation #{index} of sequence failed: #{failed.error.message}"
    else
      errors = results.map (r) -> r.error?.message or ''
      result =
        error: new Error "Multiple failures in sequence: #{errors}"

  return result

runTestAndCheck = (runner, testcase, callback) ->
  return callback null, { passed: true } if testcase.skip
    # TODO: pass some skipped state? its indirectly in .skip though

  # XXX: normalize and validate in testsuite.coffee instead?
  inputs = if common.isArray(testcase.inputs) then testcase.inputs else [ testcase.inputs ]
  expects = if common.isArray(testcase.expect) then testcase.expect else [ testcase.expect ]
  if inputs.length != expects.length
    return callback null,
      passed: false
      error: new Error "Test sequence length mismatch. Got #{inputs.length} inputs and #{expects.length} expectations"

  runner.runTest testcase, (err, results) ->
    return callback err, null if err
    result = checkResults results
    if result.error
      result.passed = false
    return callback null, result

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
      testcase.error = testcase.error.message if testcase.error
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
