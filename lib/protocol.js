/**
 * FBP protocol dependent code: high-level operations on top of an fbp-client instance.
 * @module lib/protocol
 */

import debugLib from "debug";
import fbpGraph from "fbp-graph";

import { randomString } from "./common.js";

const debug = debugLib("fbp-spec:protocol");

/**
 * A graph JSON payload, as sent over the FBP protocol or parsed from FBP notation.
 * @typedef {{ name?: string, properties?: Record<string, *>, inports?: Record<string, *>, outports?: Record<string, *>, processes?: Record<string, *>, connections?: *[] }} GraphPayload
 */

/**
 * A component as advertised by a runtime.
 * @typedef {{ name: string, description?: string, subgraph?: boolean, inPorts: { id: string, [key: string]: * }[], outPorts: { id: string, [key: string]: * }[], [key: string]: * }} RuntimeComponent
 */

/**
 * Send a graph to the runtime, and return the ID it was registered under.
 * @param {import("fbp-client").FbpClient} client Connected fbp-client instance
 * @param {GraphPayload|import("fbp-graph").Graph} graph Graph to send, either a fbp-graph instance or graph JSON payload
 * @param {boolean} [main=false] Whether this is the main graph of the runtime
 * @returns {Promise<string>} The graph ID assigned on the runtime
 */
export async function sendGraph(client, graph, main = false) {
  if (!graph) {
    throw new Error("Graph not defined");
  }

  let graphId = graph.name || graph.properties?.id;
  if (!graphId) {
    graphId = `fixture.${randomString(10)}`;
  }
  graph.name = graphId;

  if (!(graph instanceof fbpGraph.Graph)) {
    // fbp-client operates on fbp-graph instances; loadJSON always returns a Promise
    const loadedGraph = await fbpGraph.graph.loadJSON(graph);
    return sendGraph(client, loadedGraph, main);
  }

  debug("sendgraph", graphId);
  await client.protocol.graph.send(graph, main);
  return graphId;
}

/**
 * Start the network for a graph on the runtime.
 * @param {import("fbp-client").FbpClient} client Connected fbp-client instance
 * @param {string} graphId ID of the graph to start
 * @returns {Promise<void>} Resolves when the network has started
 */
export async function startNetwork(client, graphId) {
  debug("startnetwork", graphId);

  // TODO: Register start with recorder
  await client.protocol.network.start({ graph: graphId });
}

/**
 * Stop the network for a graph on the runtime.
 * @param {import("fbp-client").FbpClient} client Connected fbp-client instance
 * @param {string} graphId ID of the graph to stop
 * @returns {Promise<void>} Resolves when the network has stopped
 */
export async function stopNetwork(client, graphId) {
  debug("stopnetwork", graphId);

  // TODO: Register stop with recorder
  await client.protocol.network.stop({ graph: graphId });
}

/**
 * Send input data packets to the input ports of a graph.
 * @param {import("fbp-client").FbpClient} client Connected fbp-client instance
 * @param {string} graphId ID of the graph to send to
 * @param {Record<string, *>} packets Data to send, keyed by port name
 * @returns {Promise<void>} Resolves when all packets have been sent
 */
export async function sendPackets(client, graphId, packets) {
  debug("sendpackets", graphId, packets);

  await Promise.all(
    Object.keys(packets).map((port) =>
      client.protocol.runtime.packet({
        event: "data",
        port,
        payload: packets[port],
        graph: graphId,
      }),
    ),
  );
}

/**
 * Get the components available on the runtime.
 * @param {import("fbp-client").FbpClient} client Connected fbp-client instance
 * @returns {Promise<Record<string, RuntimeComponent>>} Components keyed by name
 */
export async function getComponents(client) {
  debug("get components");

  const componentList = await client.protocol.component.list();
  /** @type {Record<string, RuntimeComponent>} */
  const components = {};
  for (const component of componentList) {
    components[component.name] = component;
  }
  return components;
}

/**
 * Get the capabilities advertised by the runtime.
 * @param {import("fbp-client").FbpClient} client Connected fbp-client instance
 * @returns {Promise<string[]>} Capability names
 */
export async function getCapabilities(client) {
  const def = client.definition;
  if (def?.capabilities?.length) {
    // We already know the capabilities
    return def.capabilities;
  }
  const definition = await client.protocol.runtime.getruntime();
  return definition.capabilities ?? [];
}

/**
 * Get the fbp-spec tests attached to components on the runtime.
 * @param {import("fbp-client").FbpClient} client Connected fbp-client instance
 * @returns {Promise<Record<string, string>>} YAML test sources, keyed by component name
 */
export async function getComponentTests(client) {
  debug("get component tests");

  const components = await client.protocol.component.list();
  const sources = await Promise.all(
    components.map((component) =>
      client.protocol.component.getsource({ name: component.name }).then(
        (source) => source,
        () => ({ tests: null }),
      ),
    ),
  );
  /** @type {Record<string, string>} */
  const tests = {};
  for (const source of sources) {
    if (!source.tests) {
      continue;
    }
    const name = source.library
      ? `${source.library}/${source.name}`
      : source.name;
    tests[name] = source.tests;
  }
  return tests;
}
