# FBP protocol dependent code

common = require './common'
debug = common.debug

exports.sendGraph = (runtime, graph , callback) ->
  main = false # this is a component?

  graphId = graph.name or graph.properties.id
  graphId = "fixture.#{common.randomString(10)}" if not graphId

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

exports.startNetwork = (runtime, graphId, callback) ->
  debug 'startnetwork', graphId

  waitForStarted = (status) ->
    debug 'runtime status change', status
    if status.started
      runtime.removeListener 'execution', waitForStarted
      return callback null
  
  runtime.on 'execution', waitForStarted

  runtime.sendNetwork 'start',
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
