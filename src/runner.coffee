
common = require './common'
protocol = require './protocol'
testsuite = require './testsuite'

fbp = require 'fbp'
fbpClient = require 'fbp-protocol-client'
chai = require 'chai'

debug = common.debug

class Runner
  constructor: (@client) ->
    if @client.protocol? and @client.address?
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
      updateCallback suites
      callback error

    runner.runTest testcase, (err, actual) ->
      error = null
      try
        chai.expect(actual).to.eql testcase.expect
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

## Main
parse = (args) ->
  program = require 'commander'

  program
    .arguments('<suites>')
    .action( (suites) -> program.suites = suites )
    .option('--address <URL>', 'Address of runtime to connect to', Number, 'ws://localhost:3569')
    .option('--secret <secret>', 'Runtime secret', String, null)
    .option('--command <command>', 'Command to launch runtime under test', String, null)
    .parse(process.argv)

  return program

# TODO: add options for collecting test suites from FBP protocol component listing

startRuntime = (options, callback) ->
  subprocess = require './subprocess'

  if not options.command # we're not responsible for starting it
    callback null
    return null
  subprocessOptions = {}
  return subprocess.start options.command, subprocessOptions, callback

hasErrors = (suites) ->
  failures = 0
  for s in suites
    for c in s.cases
      failures += 1 if c.error
  return failures > 0

runOptions = (options, onUpdate, callback) ->
  suites = testsuite.getSuitesSync options.suites
  child = null

  cleanReturn = (err) ->
    child.kill() if child
    return callback err, suites

  def =
    protocol: 'websocket'
    address: options.address
    secret: options.secret

  runner = new Runner def
  child = startRuntime options, (err) ->
    cleanReturn err if err

    runner.connect (err) ->
      cleanReturn err if err

      runAll runner, suites, onUpdate, (err) ->
        cleanReturn err if err

        runner.disconnect (err) ->
          cleanReturn err

testStatusText = (suites) ->
  results = []
  for s in suites
    for c in s.cases
      continue if not c.passed? or c.shown
      c.shown = true # bit hacky, mutates suites
      res = if c.passed then '✓' else "✗ Error: #{c.error}"
      results.push "#{c.name}\n\t#{c.assertion}: #{res}"
  return results

main = () ->
  options = parse process.argv

  onUpdate = (suites) ->
    r = testStatusText suites
    console.log r.join('\n')

  runOptions options, onUpdate, (err, suites) ->
    throw err if err
    exitStatus = if hasErrors suites then 2 else 0
    process.exit exitStatus

exports.main = main
exports.Runner = Runner
exports.runAll = runAll
