/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// FBP protocol dependent code

let getComponents;
const fbpGraph = require('fbp-graph');
const common = require('./common');
const debug = require('debug')('fbp-spec:protocol');
const Promise = require('bluebird');

exports.sendGraph = function(client, graph , callback) {
  const main = false; // this is a component?
  if (!graph) { return callback(new Error("Graph not defined")); }

  let graphId = graph.name || graph.properties.id;
  if (!graphId) { graphId = `fixture.${common.randomString(10)}`; }
  graph.name = graphId;

  if (!(graph instanceof fbpGraph.Graph)) {
    // fbp-client operates on fbp-graph instances
    fbpGraph.graph.loadJSON(graph, function(err, g) {
      if (err) { return callback(err); }
      return exports.sendGraph(client, g, callback);
    });
    return;
  }

  debug('sendgraph', graphId);

  Promise.resolve()
    .then(() => client.protocol.graph.send(graph, main))
    .then(() => graphId)
    .nodeify(callback);
};

exports.startNetwork = function(client, graphId, callback) {
  debug('startnetwork', graphId);

  Promise.resolve()
    .then(() => client.protocol.network.start({
      graph: graphId
    }))
    .nodeify(callback);
};

exports.stopNetwork = function(client, graphId, callback) {
  debug('stopnetwork', graphId);

  Promise.resolve()
    .then(() => client.protocol.network.stop({
      graph: graphId
    }))
    .nodeify(callback);
};

exports.sendPackets = function(client, graphId, packets, callback) {
  debug('sendpackets', graphId, packets);

  Promise.all(Object.keys(packets).map(port => client.protocol.runtime.packet({
    event: 'data',
    port,
    payload: packets[port],
    graph: graphId})))
    .nodeify(callback);
};

exports.getComponents = (getComponents = function(client, callback) {
  debug('get components');

  Promise.resolve()
    .then(() => client.protocol.component.list())
    .then(function(componentList) {
      const components = {};
      for (let component of Array.from(componentList)) {
        components[component.name] = component;
      }
      return components;
    })
    .nodeify(callback);
});

exports.getCapabilities = function(client, callback) {
  const def = client.definition;
  if (__guard__(def != null ? def.capabilities : undefined, x => x.length)) { return callback(null, def.capabilities); }
  Promise.resolve()
    .then(() => client.protocol.runtime.getruntime())
    .then(definition => definition.capabilities)
    .nodeify(callback);
};

exports.getComponentTests = function(client, callback) {
  debug('get component tests');

  Promise.resolve()
    .then(() => client.protocol.component.list())
    .then(components => Promise.all(components.map(component => client.protocol.component.getsource({
    name: component.name
  }).then(
    source => source,
    err => ({
      tests: null
    })))))
    .then(function(sources) {
      const tests = {};
      for (let source of Array.from(sources)) {
        if (!source.tests) { continue; }
        const name = source.library ? `${source.library}/${source.name}` : source.name;
        tests[name] = source.tests;
      }
      return tests;
    })
    .nodeify(callback);
};

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}