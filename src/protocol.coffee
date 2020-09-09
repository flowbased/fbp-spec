# FBP protocol dependent code

fbpGraph = require 'fbp-graph'
common = require './common'
debug = require('debug')('fbp-spec:protocol')
Promise = require 'bluebird'

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

  Promise.resolve()
    .then(() -> client.protocol.graph.send(graph, main))
    .then(() -> graphId)
    .nodeify(callback)
  return

exports.startNetwork = (client, graphId, callback) ->
  debug 'startnetwork', graphId

  Promise.resolve()
    .then(() -> client.protocol.network.start(
      graph: graphId
    ))
    .nodeify(callback)
  return

exports.stopNetwork = (client, graphId, callback) ->
  debug 'stopnetwork', graphId

  Promise.resolve()
    .then(() -> client.protocol.network.stop(
      graph: graphId
    ))
    .nodeify(callback)
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
    .nodeify(callback)
  return

exports.getComponents = getComponents = (client, callback) ->
  debug 'get components'

  Promise.resolve()
    .then(() -> client.protocol.component.list())
    .then((componentList) ->
      components = {}
      for component in componentList
        components[component.name] = component
      return components
    )
    .nodeify(callback)
  return

exports.getCapabilities = (client, callback) ->
  def = client.definition
  return callback null, def.capabilities if def?.capabilities?.length
  Promise.resolve()
    .then(() -> client.protocol.runtime.getruntime())
    .then((definition) -> definition.capabilities)
    .nodeify(callback)
  return

exports.getComponentTests = (client, callback) ->
  debug 'get component tests'

  Promise.resolve()
    .then(() -> client.protocol.component.list())
    .then((components) ->
      return Promise.all(components.map((component) ->
        client.protocol.component.getsource(
          name: component.name
        ).then(
          (source) -> source
          (err) -> {
            tests: null
          }
        )
      ))
    )
    .then((sources) ->
      tests = {}
      for source in sources
        continue unless source.tests
        name = if source.library then "#{source.library}/#{source.name}" else source.name
        tests[name] = source.tests
      return tests
    )
    .nodeify(callback)
  return
