
chai = require 'chai'
fbpClient = require 'fbp-protocol-client'
mochacompat = require '../src/mochacompat'
protocol = require '../src/protocol'

testPath = (name) ->
  path = require 'path'
  test = path.join __dirname, 'fixtures/mochacases', name
  return test

connectClient = (client, callback) ->
  onStatus = (status) =>
    return if not status.online # ignore, might get false before getting a true
    client.removeListener 'status', onStatus

    protocol.getCapabilities client, (err, caps, def) ->
      return callback err, def

  client.on 'status', onStatus
  client.connect()

setupAndConnect = (options, callback) ->
  mochacompat.setup options, (err, state) ->
    return callback err if err
    def =
      protocol: 'websocket'
      address: "ws://localhost:#{options.port}"
    Transport = fbpClient.getTransport def.protocol
    client = new Transport def

    connectClient client, (err, def) ->
      return callback err, client, def, state

# FIXME: move to protocol

describe 'Mocha compatibility runner', ->
  definition = null
  it 'should implement the FBP runtime protocol', (done) ->
    options =
      files: [ testPath('bdd-nested-passing.coffee') ]
    setupAndConnect options, (err, client, def) ->
      definition = def
      return done err if err
      chai.expect(def).to.include.keys ['protocol', 'type', 'version', 'capabilities']
      chai.expect(def.protocol).to.equal 'websocket'
      chai.expect(def.type).to.equal 'fbp-spec-mocha'
      chai.expect(def.version).to.equal '0.5'
      done()
  it 'has the required FBP runtime capabilities', ->
    c = definition.capabilities
    chai.expect(c).to.include 'protocol:graph'
    chai.expect(c).to.include 'protocol:component'
    chai.expect(c).to.include 'protocol:network'
    chai.expect(c).to.include 'component:getsource'

  describe "loading test file with nested describe()", ->
    it.skip 'should list each it() as separate testcase', (done) ->
      options =
        files: [ testPath('bdd-nested-passing.coffee') ]
      setupAndConnect options, (err, client) ->
        protocol.getComponentTests client, (err) ->
          return done err if err


