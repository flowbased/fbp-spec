
common = require './common'
protocol = require './protocol'
testsuite = require './testsuite'

fbp = require 'fbp'
fbpClient = require 'fbp-protocol-client'

debug = common.debug

class Runner
  constructor: (@client) ->
    if @client.protocol? and @client.id?
      # is a runtime definition
      Transport = fbpClient.getTransport @client.protocol
      @client = new Transport @client
    @currentGraphId = null

  # TODO: check the runtime capabilities before continuing
  connect: (callback) ->
    debug 'connect'
    onStatus = (status) =>
      err = if status.online then null else new Error 'Runtime not online after connect()'
      @client.removeListener 'status', onStatus
      debug 'connected', err
      return callback err
    @client.on 'status', onStatus
    @client.connect()

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
    # FIXME: implement
    return callback null

  runTest: (testcase, callback) ->
    debug 'runtest', "\"#{testcase.name}\""

    received = {}
    onReceived = (port, data) =>
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

# will update each of the testcases in @suites
# with .passed and .error states as tests are ran
runAll = (runner, suites, updateCallback, doneCallback) ->

  runTest = (testcase, callback) ->
    done = (error) ->
      updateCallback()
      callback error

    runner.runTest testcase, (err, actual) ->
      error = null
      try
        chai.expect(actual).to.eql
      catch e
        error = e
      testcase.passed = not error
      testcase.error = error?.message
      debug 'ran test', testcase.name, testcase.passed, error
      return done error

  # FIXME: run all suites not just first
  runner.setupSuite suites[0], (err) ->
    debug 'setup suite', err
    return doneCallback err, suites if err

    common.asyncSeries suites[0].cases, runTest, (err) ->
      debug 'testrun complete', err

      runner.teardownSuite suites[0], (err) ->
        debug 'teardown suite', err
        return doneCallback err, suites

main = () ->
  subprocess = require './subprocess'

  runSuite = (runner, suite) ->
    chai = require 'chai'

    runner.setupSuite suite, (err) ->
      return err if err

      testcase = suite.cases[0]
      runner.runTest testcase, (err, received) ->
        return err if err

        console.log "  #{testcase.name}"
        err = null
        try
          chai.expect(received).to.eql testcase.expect
        catch e
          err = e
        console.log "    #{testcase.assertion}:", if not e then '✓' else "✗\n #{e.message}"

        runner.teardownSuite suite, (err) ->
          return err if err

  suites = testsuite.getSuitesSync './spec/fixtures/ToggleAnimation.yaml'
  suite = suites[0]

  # FIXME: accept commandline arguments for this information
  # - runtime definition. As .json file? Put command in the file too?
  # - list of files with test suites to run. Enumeration of files, or directory?

  # TODO: add options for collecting test suites from FBP protocol component listing

  def =
    label: "MicroFlo Simulator"
    description: "The first component in the world"
    type: "microflo"
    protocol: "websocket"
    address: "ws://localhost:3333"
    secret: "microflo32"
    id: "2ef763ff-1f28-49b8-b58f-5c6a5c23af2d"
    user: "3f3a8187-0931-4611-8963-239c0dff1931"

  command = '../microflo/microflo.js runtime --port 3333 --file ../microflo/build/emscripten/microflo-runtime.js'
  options = {}
  subprocess.start command, options, (err) ->
    debug 'started', command, err

    runner = new Runner def
    runner.connect (err) ->
      throw err if err

      runSuite runner, suite, (err) ->
          throw err if err

          runner.disconnect (err) ->
            throw err if err


exports.main = main
exports.Runner = Runner
exports.runAll = runAll
