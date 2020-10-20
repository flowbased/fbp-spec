/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const WebSocketServer = require('websocket').server;

// XXX: Copied from https://github.com/noflo/noflo-runtime-websocket/blob/master/runtime/network.js
// should probably reuse it as-is

class WebSocketRuntime {
  constructor(options) {
    if (options == null) { options = {}; }
    this.options = options;
    this.connections = [];
  }

  send(protocol, topic, payload, context) {
    if (!context.connection || !context.connection.connected) {
      return;
    }
    if ((topic === 'error') && payload instanceof Error) {
      payload = {
        message: payload.message,
        stack: payload.stack
      };
    }
    context.connection.sendUTF(JSON.stringify({
      protocol,
      command: topic,
      payload})
    );
  }

  sendAll(protocol, topic, payload, context) {
    if ((topic === 'error') && payload instanceof Error) {
      payload = {
        message: payload.message,
        stack: payload.stack
      };
    }
    this.connections.forEach(function(connection) {
      connection.sendUTF(JSON.stringify({
        protocol,
        command: topic,
        payload})
      );
    });
  }
}

module.exports = function(httpServer, options) {
  const wsServer = new WebSocketServer({httpServer});
  const runtime = new WebSocketRuntime(options);

  const handleMessage = function(message, connection) {
    if (message.type === 'utf8') {
      let contents = undefined;
      try {
        contents = JSON.parse(message.utf8Data);
      } catch (e) {
        if (e.stack) {
          console.error(e.stack);
        } else {
          console.error('Error: ' + e.toString());
        }
        return;
      }
      return runtime.receive(contents.protocol, contents.command, contents.payload, {connection});
    }
  };

  wsServer.on('request', function(request) {
    const subProtocol = request.requestedProtocols.indexOf('noflo') !== -1 ? 'noflo' : null;
    const connection = request.accept(subProtocol, request.origin);
    runtime.connections.push(connection);
    connection.on('message', message => handleMessage(message, connection));
    return connection.on('close', function() {
      if (runtime.connections.indexOf(connection) === -1) { return; }
      return runtime.connections.splice(runtime.connections.indexOf(connection), 1);
    });
  });

  return runtime;
};


