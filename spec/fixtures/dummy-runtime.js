/**
 * A minimal in-process FBP runtime, speaking the FBP runtime protocol over WebSocket.
 * Mirrors the behaviour of protocol-examples/python/runtime.py (the 'python-example'
 * runtime used by the fbp-spec examples): it echoes any input packet back on the
 * 'out' port, and exposes a single DummyComponent.
 *
 * Used by the test suite so that end-to-end tests can run without Python.
 * @module spec/fixtures/dummy-runtime
 */

import http from "node:http";
import { fileURLToPath } from "node:url";
import { server as WebSocketServer } from "websocket";

/** YAML testsuite attached to DummyComponent, served via component:getsource. */
export const DUMMY_COMPONENT_TESTS = `
name: DummyComponent tests
topic: DummyComponent
cases:
-
  name: 'sending a boolean'
  assertion: 'should repeat the same'
  inputs:
    in: true
  expect:
    out:
      equals: true
`;

/** @type {Record<string, { name: string, description?: string, subgraph?: boolean, inPorts: object[], outPorts: object[] }>} */
const components = {
  DummyComponent: {
    name: "DummyComponent",
    description: "An example component which does exactly nothing",
    subgraph: false,
    inPorts: [
      {
        id: "portA",
        type: "boolean",
        description: "A boolean port",
        addressable: false,
        required: true,
      },
      { id: "portB", type: "any" },
    ],
    outPorts: [{ id: "out1", type: "string" }],
  },
};

/**
 * Start a dummy FBP runtime listening on a port.
 * @param {{ secret?: string, port?: number }} [options] Optional secret the runtime requires, and port (0 = ephemeral)
 * @returns {Promise<{ address: string, port: number, close: () => Promise<void>, httpServer: import('node:http').Server }>} Handle to the runtime
 */
export function startDummyRuntime(options = {}) {
  const httpServer = http.createServer((_req, res) => {
    res.writeHead(404);
    res.end();
  });
  const wsServer = new WebSocketServer({ httpServer });

  wsServer.on("request", (request) => {
    const subProtocol =
      request.requestedProtocols.indexOf("noflo") !== -1 ? "noflo" : null;
    const connection = request.accept(subProtocol, request.origin);

    /**
     * Send an FBP message to the client, stripping any runtime secret.
     * @param {string} protocol FBP protocol name
     * @param {string} command FBP command name
     * @param {*} payload Message payload
     * @returns {void}
     */
    function send(protocol, command, payload) {
      if (payload && typeof payload === "object" && "secret" in payload) {
        const { secret, ...rest } = payload; // eslint-disable-line no-unused-vars
        payload = rest;
      }
      connection.sendUTF(JSON.stringify({ protocol, command, payload }));
    }

    /**
     * Acknowledge a graph protocol message by echoing it back.
     * @param {string} command FBP command name
     * @param {object} payload Message payload
     * @returns {void}
     */
    /**
     * @param {string} command FBP command name
     * @param {Record<string, *>} payload Message payload
     * @returns {void}
     */
    function handleGraph(command, payload) {
      send("graph", command, payload);
    }

    /**
     * Handle a network protocol message.
     * @param {string} command FBP command name
     * @param {object} payload Message payload
     * @returns {void}
     */
    /**
     * @param {string} command FBP command name
     * @param {Record<string, *>} payload Message payload
     * @returns {void}
     */
    function handleNetwork(command, payload) {
      const graph = payload?.graph ?? null;
      if (command === "getstatus") {
        send("network", "status", { graph, started: false, running: false });
        return;
      }
      if (command === "start") {
        send("network", "started", { graph, started: true, running: true });
        return;
      }
      if (command === "stop") {
        send("network", "stopped", { graph, started: false, running: false });
        return;
      }
      console.warn(`Unknown network command ${command}`);
    }

    /**
     * Handle a runtime protocol message.
     * @param {string} command FBP command name
     * @param {object} payload Message payload
     * @returns {void}
     */
    /**
     * @param {string} command FBP command name
     * @param {Record<string, *>} payload Message payload
     * @returns {void}
     */
    function handleRuntime(command, payload) {
      if (command === "getruntime") {
        if (options.secret && payload.secret !== options.secret) {
          send("runtime", "error", { message: "Invalid secret" });
          return;
        }
        send("runtime", "runtime", {
          type: "fbp-js-dummy",
          version: "0.7",
          capabilities: [
            "protocol:graph",
            "protocol:component",
            "protocol:network",
            "protocol:runtime",
            "component:getsource",
          ],
        });
        return;
      }
      if (command === "packet") {
        // We don't actually run anything, just echo input back on 'out'
        send("runtime", "packetsent", payload);
        send("runtime", "packet", { ...payload, port: "out" });
        return;
      }
      console.warn(`Unknown runtime command ${command}`);
    }

    /**
     * Handle a component protocol message.
     * @param {string} command FBP command name
     * @param {object} payload Message payload
     * @returns {void}
     */
    /**
     * @param {string} command FBP command name
     * @param {Record<string, *>} payload Message payload
     * @returns {void}
     */
    function handleComponent(command, payload) {
      if (command === "list") {
        for (const component of Object.values(components)) {
          send("component", "component", component);
        }
        send("component", "componentsready", Object.keys(components).length);
        return;
      }
      if (command === "getsource") {
        const component = components[payload.name];
        if (!component) {
          send("component", "error", {
            message: `Component not found: ${payload.name}`,
          });
          return;
        }
        send("component", "source", {
          name: component.name,
          code: "",
          language: "whitespace",
          tests: DUMMY_COMPONENT_TESTS,
        });
        return;
      }
      console.warn(`Unknown component command ${command}`);
    }

    connection.on("message", (message) => {
      if (message.type !== "utf8") {
        return;
      }
      let contents;
      try {
        contents = JSON.parse(message.utf8Data);
      } catch (e) {
        const err = /** @type {Error} */ (e);
        console.error(`Error: ${err.toString()}`);
        return;
      }
      switch (contents.protocol) {
        case "runtime":
          handleRuntime(contents.command, contents.payload);
          break;
        case "component":
          handleComponent(contents.command, contents.payload);
          break;
        case "graph":
          handleGraph(contents.command, contents.payload);
          break;
        case "network":
          handleNetwork(contents.command, contents.payload);
          break;
        default:
          console.warn(`Unknown protocol ${contents.protocol}`);
      }
    });
  });

  return new Promise((resolve) => {
    httpServer.listen(options.port ?? 0, "127.0.0.1", () => {
      const addr = httpServer.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({
        address: `ws://127.0.0.1:${port}`,
        port,
        httpServer,
        close: () =>
          new Promise((res) => {
            wsServer.shutDown();
            httpServer.close(() => res());
          }),
      });
    });
  });
}

// Allow running standalone, for use as a runtime-under-test via the CLI --command option
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.argv[2] ?? process.env.PORT ?? 3569);
  await startDummyRuntime({ port });
  console.log(`INFO: Dummy runtime listening on port ${port}`);
}
