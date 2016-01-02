WebSocketServer = require('websocket').server

# XXX: Copied from https://github.com/noflo/noflo-runtime-websocket/blob/master/runtime/network.js
# should probably reuse it as-is

class WebSocketRuntime
  constructor: (@options = {}) ->
    @connections = []

  send: (protocol, topic, payload, context) ->
    if !context.connection or !context.connection.connected
      return
    if topic == 'error' and payload instanceof Error
      payload =
        message: payload.message
        stack: payload.stack
    context.connection.sendUTF JSON.stringify(
      protocol: protocol
      command: topic
      payload: payload)
    return

  sendAll: (protocol, topic, payload, context) ->
    if topic == 'error' and payload instanceof Error
      payload =
        message: payload.message
        stack: payload.stack
    @connections.forEach (connection) ->
      connection.sendUTF JSON.stringify(
        protocol: protocol
        command: topic
        payload: payload)
      return
    return

module.exports = (httpServer, options) ->
  wsServer = new WebSocketServer(httpServer: httpServer)
  runtime = new WebSocketRuntime(options)

  handleMessage = (message, connection) ->
    if message.type == 'utf8'
      contents = undefined
      try
        contents = JSON.parse(message.utf8Data)
      catch e
        if e.stack
          console.error e.stack
        else
          console.error 'Error: ' + e.toString()
        return
      runtime.receive contents.protocol, contents.command, contents.payload, connection: connection

  wsServer.on 'request', (request) ->
    subProtocol = if request.requestedProtocols.indexOf('noflo') != -1 then 'noflo' else null
    connection = request.accept(subProtocol, request.origin)
    runtime.connections.push connection
    connection.on 'message', (message) ->
      handleMessage message, connection
    connection.on 'close', ->
      return if runtime.connections.indexOf(connection) == -1
      runtime.connections.splice runtime.connections.indexOf(connection), 1

  return runtime


