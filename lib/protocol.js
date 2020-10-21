// FBP protocol dependent code

const fbpGraph = require('fbp-graph');
const debug = require('debug')('fbp-spec:protocol');
const Promise = require('bluebird');
const common = require('./common');

exports.sendGraph = function sendGraph(client, graph, callback) {
  const main = false; // this is a component?
  if (!graph) {
    callback(new Error('Graph not defined'));
    return;
  }

  let graphId = graph.name || graph.properties.id;
  if (!graphId) { graphId = `fixture.${common.randomString(10)}`; }
  const g = graph;
  g.name = graphId;

  if (!(graph instanceof fbpGraph.Graph)) {
    // fbp-client operates on fbp-graph instances
    fbpGraph.graph.loadJSON(graph, (err, loadedGraph) => {
      if (err) {
        callback(err);
        return;
      }
      exports.sendGraph(client, loadedGraph, callback);
    });
    return;
  }

  debug('sendgraph', graphId);

  Promise.resolve()
    .then(() => client.protocol.graph.send(graph, main))
    .then(() => graphId)
    .nodeify(callback);
};

exports.startNetwork = function startNetwork(client, graphId, callback) {
  debug('startnetwork', graphId);

  Promise.resolve()
    .then(() => client.protocol.network.start({
      graph: graphId,
    }))
    .nodeify(callback);
};

exports.stopNetwork = function stopNetwork(client, graphId, callback) {
  debug('stopnetwork', graphId);

  Promise.resolve()
    .then(() => client.protocol.network.stop({
      graph: graphId,
    }))
    .nodeify(callback);
};

exports.sendPackets = function sendPackets(client, graphId, packets, callback) {
  debug('sendpackets', graphId, packets);

  Promise.all(Object.keys(packets).map((port) => client.protocol.runtime.packet({
    event: 'data',
    port,
    payload: packets[port],
    graph: graphId,
  })))
    .nodeify(callback);
};

exports.getComponents = function getComponents(client, callback) {
  debug('get components');

  Promise.resolve()
    .then(() => client.protocol.component.list())
    .then((componentList) => {
      const components = {};
      componentList.forEach((component) => {
        components[component.name] = component;
      });
      return components;
    })
    .nodeify(callback);
};

exports.getCapabilities = function getCapabilities(client, callback) {
  const def = client.definition;
  if (def && def.capabilities && def.capabilities.length) {
    // We already know the capabilities
    callback(null, def.capabilities);
    return;
  }
  Promise.resolve()
    .then(() => client.protocol.runtime.getruntime())
    .then((definition) => definition.capabilities)
    .nodeify(callback);
};

exports.getComponentTests = function getComponentTests(client, callback) {
  debug('get component tests');

  Promise.resolve()
    .then(() => client.protocol.component.list())
    .then((components) => Promise.all(components.map((component) => client
      .protocol.component.getsource({
        name: component.name,
      }).then(
        (source) => source,
        () => ({
          tests: null,
        }),
      ))))
    .then((sources) => {
      const tests = {};
      sources.forEach((source) => {
        if (!source.tests) { return; }
        const name = source.library ? `${source.library}/${source.name}` : source.name;
        tests[name] = source.tests;
      });
      return tests;
    })
    .nodeify(callback);
};
