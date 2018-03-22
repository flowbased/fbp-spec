
chai = require 'chai'
fbpClient = require 'fbp-client'
mochacompat = require '../src/mochacompat'
protocol = require '../src/protocol'
testsuite = require '../src/testsuite'
runner = require '../src/runner'

testPath = (name) ->
  path = require 'path'
  test = path.join __dirname, 'fixtures/mochacases', name
  return test

runtimeDefinition = (options) ->
  def =
    protocol: 'websocket'
    address: "ws://localhost:#{options.port}"
  return def

setupAndConnect = (options, callback) ->
  mochacompat.setup options, (err, state, httpServer) ->
    return callback err if err
    def = runtimeDefinition options
    fbpClient(def)
      .then((c) ->
        client = c
        return client.connect()
      )
      .then((() -> callback()), callback)
    return
  return

runAllComponentTests = (ru, callback) ->
  state = null
  onUpdate = (s) ->
    state = s
  ru.connect (err) ->
    return done err if err
    runner.getComponentSuites ru, (err, suites) ->
      return done err if err
      runner.runAll ru, suites, onUpdate, (err) ->
        return callback err, state

describe 'Mocha compatibility runner', ->
  httpServer = null
  definition = null
  ru = null

  afterEach (done) ->
    if httpServer
      httpServer.close()
      httpServer = null
    if ru
      ru.disconnect (err) ->
        ru = null
        done err
    else
      done()

  it 'should implement the FBP runtime protocol', (done) ->
    options =
      files: [ testPath('bdd-nested-passing.coffee') ]
    setupAndConnect options, (err, client, def, state, server) ->
      httpServer = server
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
    it 'should list each it() as separate fbp-spec testcase', (done) ->
      options =
        files: [ testPath('bdd-nested-passing.coffee') ]
      setupAndConnect options, (err, client, def, state, server) ->
        httpServer = server
        return done err if err
        protocol.getComponentTests client, (err, suites) ->
          return done err if err
          chai.expect(suites).to.be.a 'object'
          suiteNames = Object.keys suites
          chai.expect(suiteNames).to.have.length 1
          t = suites[suiteNames[0]]
          tests = testsuite.loadYAML t
          chai.expect(tests).to.have.length 1
          chai.expect(tests[0]).to.include.keys ['name', 'fixture', 'cases']
          chai.expect(tests[0].cases).to.have.length 2
          [caseA, caseB] = tests[0].cases
          chai.expect(caseA.name).to.include 'sub topic'
          chai.expect(caseB.name).to.include 'sub sub topic'
          done()

  describe 'running a passing test', ->
    it 'should recorded 1 passed test', (done) ->
      options =
        files: [ testPath('bdd-simple-passing.coffee') ]
      mochacompat.setup options, (err, state, server) ->
        httpServer = server

        ru = new runner.Runner runtimeDefinition(options)
        runAllComponentTests ru, (err, state) ->
          return done err if err
          chai.expect(state).to.have.length 1
          cases = state[0].cases
          chai.expect(cases).to.have.length 1
          chai.expect(cases[0].passed, 'testcase did not pass').to.equal true
          done()

  describe 'running a failing test', ->
    testcase = null
    it 'should recorded 1 failed test', (done) ->
      options =
        files: [ testPath('bdd-simple-failing.coffee') ]
      mochacompat.setup options, (err, state, server) ->
        httpServer = server
        ru = new runner.Runner runtimeDefinition(options)
        runAllComponentTests ru, (err, state) ->
          return done err if err
          chai.expect(state).to.have.length 1
          cases = state[0].cases
          chai.expect(cases).to.have.length 1
          testcase = cases[0]
          chai.expect(testcase.passed, 'failing testcase passed').to.equal false
          done()
    it 'has error message of the Chai assertion', ->
      chai.expect(testcase?.error).to.contain 'expected 42 to equal 41'

  describe 'suite with some skipped tests', ->
    it 'skipped tests should be marked as such'
    it 'non-skipped tests should be ran'
