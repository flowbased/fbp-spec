# FBP protocol dependent code

fbpGraph = require 'fbp-graph'
common = require './common'
debug = require('debug')('fbp-spec:protocol')

exports.sendGraph = (client, graph , callback) ->
  main = false # this is a component?
  return callback new Error "Graph not defined" if not graph

  graphId = graph.name or graph.properties.id
  graphId = "fixture.#{common.randomString(10)}" if not graphId
  graph.name = graphId

  unless graph instanceof fbpGraph.Graph
    # fbp-client operates on fbp-graph instances
    fbpGraph.graph.loadJSON graph, (err, g) ->
      return callback err if err
      exports.sendGraph client, g, callback
    return

  debug 'sendgraph', graphId

  client.protocol.graph.send(graph, main)
    .then((() -> callback(null, graphId)), callback)
  return

exports.startNetwork = (client, graphId, callback) ->
  debug 'startnetwork', graphId

  client.protocol.network.start(
    graph: graphId
  )
    .then((() -> callback()), callback)
  return

exports.stopNetwork = (client, graphId, callback) ->
  debug 'stopnetwork', graphId

  client.protocol.network.start(
    graph: graphId
  )
    .then((() -> callback()), callback)
  return

exports.sendPackets = (client, graphId, packets, callback) ->
  debug 'sendpackets', graphId, packets

  Promise.all(Object.keys(packets).map((port) ->
    return client.protocol.runtime.packet
      event: 'data'
      port: port
      payload: packets[port]
      graph: graphId
  ))
    .then((() -> callback()), callback)
  return

exports.getComponents = getComponents = (client, callback) ->
  debug 'get components'

  client.protocol.component.list()
    .then(((componentList) ->
      components = {}
      for component in componentList
        components[component.name] = component
      callback null, components
    ), callback)
  return

exports.getCapabilities = (client, callback) ->
  def = client.definition
  return callback null, def.capabilities if def?.capabilities?.length
  client.protocol.runtime.getruntime()
    .then(((definition) ->
      callback null, definition.capabilities
    ), callback)
  return

exports.getComponentTests = (client, callback) ->
  debug 'get component tests'

  client.protocol.component.list()
    .then((components) ->
      return Promise.all(components.map((component) ->
        client.protocol.component.getsource
          name: component.name
      ))
    )
    .then((sources) ->
      tests = {}
      for source in sources
        continue unless payload.tests
        name = if source.library then "#{source.library}/#{source.name}" else source.name
        tests[name] = payload.tests
      return tests
    )
    .then(((tests) -> callback(null, tests)), callback)
  return
