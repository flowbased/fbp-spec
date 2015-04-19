
chai = require 'chai'
fbp = require 'fbp'
fbpClient = require 'fbp-protocol-client'

debug = console.log

randomString = (n) ->
  text = "";
  possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for i in [0...n]
    idx = Math.floor Math.random()*possible.length
    text += possible.charAt idx
  return text

sendGraph = (runtime, graph , callback) ->
  main = false # this is a component?

  graphId = graph.name or graph.properties.id
  graphId = "fixture.#{randomString(10)}" if not graphId

  runtime.sendGraph 'clear',
    id: graphId
    name: graph.name
    main: main
    library: graph.properties.project or ''
    icon: graph.properties.icon or ''
    description: graph.properties.description or ''
  for name, process of graph.processes
    debug 'adding node', name, process.component
    runtime.sendGraph 'addnode',
      id: name
      component: process.component
      metadata: process.metadata
      graph: graphId
  for connection in graph.connections
    debug 'connecting edge', connection
    if connection.src?
      runtime.sendGraph 'addedge',
        src:
          node: connection.src.process
          port: connection.src.port
        tgt:
          node: connection.tgt.process
          port: connection.tgt.port
        metadata: connection.metadata?
        graph: graphId
    else
      runtime.sendGraph 'addinitial',
        src:
          data: iip.data
        tgt:
          node: iip.tgt.process
          port: iip.tgt.port
      metadata: iip.metadata
      graph: graphId
  if graph.inports
    for pub, priv of graph.inports
      runtime.sendGraph 'addinport',
        public: pub
        node: priv.process
        port: priv.port
        graph: graphId
  if graph.outports
    for pub, priv of graph.outports
      runtime.sendGraph 'addoutport',
        public: pub
        node: priv.process
        port: priv.port
        graph: graphId

  # FIXME: wait for responses. Maybe until "ports" message matches our setup?
  return callback null, graphId

sendPackets = (client, graphId, packets, callback) ->
  debug 'sendpackets', graphId, packets

  for port, payload of packets
    client.sendRuntime 'packet',
      event: 'data'
      port: port
      payload: payload
      graph: graphId

  return callback null



class Runner
  constructor: (@rt) ->
    Transport = fbpClient.getTransport @rt.protocol
    @client = new Transport @rt
    @currentGraphId = null

  # TODO: check the runtime capabilities before continuing
  connect: (callback) ->
    onStatus = (status) =>
      err = if status.online then null else new Error 'Runtime not online after connect()'
      @client.removeListener 'status', onStatus
      debug 'connected', err
      return callback err
    @client.on 'status', onStatus
    @client.connect()

  disconnect: (callback) ->
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
    sendGraph @client, graph, (err, graphId) =>
      @currentGraphId = graphId
      return callback err

  teardownSuite: (suite, callback) ->
    debug 'teardown suite', "\"#{suite.name}\""
    # FIXME: implement
    return callback null

  runTest: (testcase, callback) ->
    debug 'runtest', "\"#{testcase.name}\""

    received = {}
    onReceived = (port, data) ->
        received[port] = data
        nExpected = Object.keys(tcase.expect).length
        if Object.keys(received).length == nExpected
          @client.removeListener 'runtime', checkPacket
          return callback null, received

    checkPacket = (msg) ->
      d = msg.payload
      if msg.command == 'packet' and d.event == 'data' and d.graph == @currentGraphId
        onReceived d.port, d.payload
      else
        debug 'recv network', msg

    @client.on 'runtime', checkPacket

    # send input packets
    sendPackets @client, @currentGraphId, testcase.inputs, (err) =>
      @client.removeListener 'runtime', checkPacket
      return callback err if err


normalizeSuite = (suite) ->
  # Default name to topic
  suite.name = suite.topic if not suite.name

  return suite

# Uses mocha

# Connects to a remote FBP runtime,
# enumerate the available test suites
# Runs the testcases
main = () ->
  fs = require 'fs'
  c = fs.readFileSync './spec/fixtures/ToggleAnimation.yaml'
  suite = require('js-yaml').safeLoad c

  suite = normalizeSuite suite

  def =
    label: "MicroFlo Simulator"
    description: "The first component in the world"
    type: "microflo"
    protocol: "websocket"
    address: "ws://localhost:3333"
    secret: "microflo32"
    id: "2ef763ff-1f28-49b8-b58f-5c6a5c23af2d"
    user: "3f3a8187-0931-4611-8963-239c0dff1931"
  runner = new Runner def
  runner.connect (err) ->
    throw err if err

    runner.setupSuite suite, (err) ->
      throw err if err

      runner.runTest suite.cases[0], (err, received) ->
        throw err if err

        chai.expect(received).to.eql suite.cases[0].expect

        runner.teardownSuite suite, (err) ->
          throw err if err

          runner.disconnect (err) ->
            throw err if err

exports.main = main
