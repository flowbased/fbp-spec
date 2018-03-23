common = require './common'
protocol = require './protocol'
testsuite = require './testsuite'
expectation = require './expectation'

fbp = require 'fbp'
fbpClient = require 'fbp-client'
debug = require('debug')('fbp-spec:runner')
Promise = require 'bluebird'

debugReceivedMessages = (client) ->
  debugReceived = require('debug')('fbp-spec:runner:received')
  client.on 'signal', ({protocol, command, payload}) ->
    debugReceived protocol, command, payload

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
    return

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
      catch e
        return callback e

      graph.properties = {} if not graph.properties
      return callback null, graph
    else
      return callback new Error "Unknown fixture type #{suite.fixture.type}"
  return

sendMessageAndWait = (client, currentGraph, inputData, expectData, callback) ->
  observer = client.observe (s) -> s.protocol is 'runtime' and s.command is 'packet' and s.payload.graph is currentGraph

  signalsToReceived = (signals) ->
    received = {}
    for signal in signals
      received[signal.payload.port] = signal.payload.payload
    return received

  checkSuccess = (s) ->
    debug 'runtest got output on', s.payload.port
    received = signalsToReceived observer.signals
    result = (Object.keys(received).length == Object.keys(expectData).length)
    return result
  checkFailure = (s) ->
    if s.protocol is 'network' and s.command is 'error'
      # network:error should imply failed test
      return false if s.payload.graph and s.payload.graph isnt currentGraph
      return true
    if s.protocol is 'network' and s.command is 'processerror'
      # network:processerror should imply failed test
      return false if s.payload.graph and s.payload.graph isnt currentGraph
      return true
    if s.protocol is 'runtime' and s.command is 'packet'
      # Output packet, see if it is an unexpected error
      # Check that is for the current graph under test
      return false unless s.payload.graph is currentGraph
      # We only care for packets to error port
      return false unless s.payload.port is 'error'
      # We only care if spec isn't expecting errors
      return false unless typeof expectData.error is 'undefined'
      return true

    false

  # send input packets
  sendPackets = Promise.promisify protocol.sendPackets
  Promise.resolve()
    .then(() -> sendPackets client, currentGraph, inputData)
    .then(() -> observer.until(checkSuccess, checkFailure))
    .then((signals) -> signalsToReceived(signals))
    .nodeify(callback)
  return

needsSetup = (suite) ->
  notSkipped = suite.cases.filter((c) -> not c.skip)
  return notSkipped.length > 0

class Runner
  constructor: (@client, options={}) ->
    @currentGraphId = null
    @components = {}
    @parentElement = null
    @options = options
    @options.connectTimeout = 5*1000 if not @options.connectTimeout?

  prepareClient: (callback) ->
    if @client.protocol? and @client.address?
      # is a runtime definition
      Promise.resolve()
        .then(() => fbpClient(@client))
        .then((client) =>
          @client = client

          if @parentElement and client.definition.protocol is 'iframe'
            # We need to set up the parent element in this case
            client.transport.setParentElement @parentElement

          return client
        )
        .nodeify(callback)
      return
    # This is a client instance
    callback null, @client
    return

  # TODO: check the runtime capabilities before continuing
  connect: (callback) ->
    debug 'connect'

    @prepareClient (err) =>
      return callback err if err

      debugReceivedMessages @client
      @client.on 'network', ({command, payload}) ->
        console.log payload.message if command is 'output' and payload.message

      timeBetweenAttempts = 500
      attempts = Math.floor(@options.connectTimeout / timeBetweenAttempts)
      isOnline = () =>
        connected = @client.isConnected()
        return if connected then Promise.resolve() else Promise.reject new Error 'Not connected to runtime'
      tryConnect = () =>
        debug 'trying to connect'
        return @client.connect()
      common.retryUntil(tryConnect, isOnline, timeBetweenAttempts, attempts)
        .then(() => @checkCapabilities(['protocol:graph', 'protocol:network', 'protocol:runtime']))
        .nodeify(callback)
    return

  disconnect: (callback) ->
    debug 'disconnect'

    return callback() unless @client?.isConnected()

    Promise.resolve()
      .then(() => @client.disconnect())
      .nodeify(callback)
    return

  checkCapabilities: (capabilities) ->
    unless @client.isConnected()
      return Promise.reject new Error 'Not connected to runtime'
    unless @client.definition?.capabilities?.length
      return Promise.reject new Error 'Runtime provides no capabilities'
    for capability in capabilities
      if @client.definition.capabilities.indexOf(capability) is -1
        return Promise.reject new Error "Runtime doesn't provide #{capability}"
    return Promise.resolve()

  setupSuite: (suite, callback) ->
    debug 'setup suite', "\"#{suite.name}\""
    return callback null if not needsSetup suite

    unless @client.isConnected()
      return callback new Error 'Disconnected from runtime'

    getFixtureGraph this, suite, (err, graph) =>
      return callback err if err
      protocol.sendGraph @client, graph, (err, graphId) =>
        @currentGraphId = graphId
        return callback err if err
        protocol.startNetwork @client, graphId, callback
      return
    return

  teardownSuite: (suite, callback) ->
    debug 'teardown suite', "\"#{suite.name}\""
    return callback null if not needsSetup suite

    unless @client.isConnected()
      return callback new Error 'Disconnected from runtime'

    # FIXME: also remove the graph. Ideally using a 'destroy' message in FBP protocol
    protocol.stopNetwork @client, @currentGraphId, callback
    return

  runTest: (testcase, callback) ->
    debug 'runtest', "\"#{testcase.name}\""

    unless @client.isConnected()
      return callback new Error 'Disconnected from runtime'

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
    return

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
  return

runSuite = (runner, suite, runTest, callback) ->
  return callback null, suite if suite.skip
  # TODO: pass some skipped state? its indirectly in .skip though

  runner.setupSuite suite, (err) ->
    debug 'setup suite', err
    return callback err, suite if err

    common.asyncSeries suite.cases, runTest, (err) ->
      debug 'testrun complete', err

      runner.teardownSuite suite, (err) ->
        debug 'teardown suite', err
        return callback err, suite
  return


exports.getComponentSuites = (runner, callback) ->
  protocol.getCapabilities runner.client, (err, caps) ->
    return callback err if err
    return callback null, [] unless 'component:getsource' in caps

    protocol.getComponentTests runner.client, (err, tests) ->
      return callback err if err
      suites = loadComponentSuites tests
      debug 'get component suites', tests.length, suites.length
      return callback null, suites
  return

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

  return

exports.Runner = Runner
exports.runAll = runAll
exports.runTestAndCheck = runTestAndCheck
