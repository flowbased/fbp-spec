# FBP protocol dependent code

common = require './common'
debug = require('debug')('fbp-spec:protocol')

exports.sendGraph = (runtime, graph , callback) ->
  main = false # this is a component?
  return callback new Error "Graph not defined" if not graph

  graphId = graph.name or graph.properties.id
  graphId = "fixture.#{common.randomString(10)}" if not graphId

  pendingPorts =
    in: []
    out: []

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
    if connection.src?
      debug 'connecting edge', connection
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
      iip = connection
      debug 'adding IIP', iip
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
      debug 'exporting inport', pub
      runtime.sendGraph 'addinport',
        public: pub
        node: priv.process
        port: priv.port
        graph: graphId
      pendingPorts.in.push pub
  if graph.outports
    for pub, priv of graph.outports
      debug 'exporting outport', pub
      runtime.sendGraph 'addoutport',
        public: pub
        node: priv.process
        port: priv.port
        graph: graphId
      pendingPorts.out.push pub

  waitForPorts = ({command, payload}) ->
    return unless command in ['addinport', 'addoutport']
    debug 'received port', payload.public
    if command is 'addinport'
      collection = pendingPorts.in
    else
      collection = pendingPorts.out
    if collection.indexOf(payload.public) is -1
      debug 'received unknown port', payload.public
      return
    collection.splice collection.indexOf(payload.public), 1
    return if pendingPorts.in.length or pendingPorts.out.length
    runtime.removeListener 'graph', waitForPorts
    return callback null, graphId

  debug 'sendGraph waiting for updated exported ports'
  runtime.on 'graph', waitForPorts

exports.startNetwork = (runtime, graphId, callback) ->
  debug 'startnetwork', graphId

  waitForStarted = (status) ->
    debug 'start: runtime status change', status
    if status.started
      runtime.removeListener 'execution', waitForStarted
      return callback null
  
  runtime.on 'execution', waitForStarted

  runtime.sendNetwork 'start',
    graph: graphId

exports.stopNetwork = (runtime, graphId, callback) ->
  debug 'stopnetwork', graphId

  waitForStopped = (status) ->
    debug 'stop: runtime status change', status
    if not status.running
      runtime.removeListener 'execution', waitForStopped
      return callback null
  runtime.on 'execution', waitForStopped

  runtime.sendNetwork 'stop',
    graph: graphId

exports.sendPackets = (client, graphId, packets, callback) ->
  debug 'sendpackets', graphId, packets

  for port, payload of packets
    client.sendRuntime 'packet',
      event: 'data'
      port: port
      payload: payload
      graph: graphId

  return callback null

exports.getComponents = getComponents = (client, callback) ->
  debug 'get components'  

  components = {}
  gotComponent = (msg) ->
    { command, payload } = msg
    debug 'got component?', command
    if command == 'component'
      components[payload.name] = payload
    else if command == 'componentsready'
      client.removeListener 'component', gotComponent
      return callback null, components

  client.on 'component', gotComponent
  client.sendComponent 'list', {}

exports.getCapabilities = (client, callback) ->
  def = client.definition
  return callback null, def.capabilities if def?.capabilities?.length
  onCapabilities = (capabilities) ->
    client.removeListener 'capabilities', onCapabilities
    return callback null, capabilities, def
  client.on 'capabilities', onCapabilities

exports.getComponentTests = (client, callback) ->
  debug 'get component tests'

  responses = 0
  expectResponses = 0
  tests = {}
  gotComponent = (msg) ->
    { command, payload } = msg
    responses += 1
    debug 'got component source?', command, payload.name, payload.tests?, responses, expectResponses
    return if command != 'source'

    tests[payload.name] = payload.tests if payload.tests? # not all components have tests
    if responses == expectResponses
      debug 'got all component sources', Object.keys(tests).length
      return complete null, tests

  complete = (err, tests) ->
    client.removeListener 'component', gotComponent
    return callback err, tests

  getComponents client, (err, components) ->
    return complete err if err

    componentNames = Object.keys components
    expectResponses = componentNames.length
    return complete null, tests if expectResponses == 0

    debug 'retrieving sources for', expectResponses

    client.on 'component', gotComponent
    for name in componentNames
      client.sendComponent 'getsource',
        name: name

