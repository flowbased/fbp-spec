
isBrowser = () ->
  return not (process? and process.execPath and process.execPath.match /node|iojs/)

fbpspec = if isBrowser() then require 'fbp-spec' else require '..'

chai = require 'chai' if not chai
yaml = require 'js-yaml'

if isBrowser()
  examples = window.fbpspec_examples
  runtimeInfo =
    protocol: 'iframe'
    address: "fixtures/everything.html?fbp_noload=true&fbp_protocol=iframe"
else
  examples = require '../examples/bundle.json'
  runtimeInfo =
    protocol: 'websocket'
    address: "ws://localhost:3335"
    command: "python2 protocol-examples/python/runtime.py --port 3335"

startRuntime = (client, info, callback) ->
  runtime = null
  if info.command
    runtime = fbpspec.subprocess.start info.command, {}, callback
  else if info.protocol == 'iframe'
    parent = document.getElementById 'fixtures'
    client.setParentElement parent
    callback null
  else
    callback null
  
  return runtime

stopRuntime = (runtime) ->
  runtime.kill() if runtime

setupAndRun = (runner, suite, testcase, callback) ->
  runner.setupSuite suite, (err) ->
    return callback err if err

    fbpspec.runner.runTestAndCheck runner, testcase, (err, r) ->
      results = r

      runner.teardownSuite suite, (e) ->
        return callback err, results


describe 'Examples', ->
  runner = null
  runtime = null
  before (done) ->
    @timeout 6000
    runner = new fbpspec.runner.Runner runtimeInfo
    runtime = startRuntime runner.client, runtimeInfo, (err) ->
      return done err if err
      runner.connect done
  after (done) ->
    stopRuntime runtime
    runner.disconnect done

  Object.keys(examples).forEach (name) ->
    example = null
    describe "#{name}", ->
      error = null
      try
        example = examples[name]
      catch e
        error = e

      it 'should load without error', ->
        chai.expect(error).to.not.exist
        chai.expect(example).to.exist

      it "should valididate against schema", ->
        results = fbpspec.testsuite.validate example
        chai.expect(results.errors).to.eql []
        chai.expect(results.missing).to.eql []
        chai.expect(results.valid).to.equal true


      describe 'testcases', ->

        example = [] if not example
        suites = if Array.isArray example then example.slice 0 else [ example ]
        suites.forEach (suite) ->
          suite.cases.forEach (testcase) ->
            describe "#{testcase.name}", () ->

              itOrSkip = if testcase.skip then it.skip else it
              if isBrowser() and suite.topic is 'DummyComponent'
                # These tests only work with the Python runtime
                itOrSkip = it.skip

              if testcase.assertion == 'should pass'
                itOrSkip "should pass", (done) ->
                  @timeout 10000
                  setupAndRun runner, suite, testcase, (err, results) ->
                    chai.expect(err).to.not.exist
                    chai.expect(results.error).to.not.exist
                    chai.expect(results.passed).to.be.true
                    done()
              else if testcase.assertion == 'should fail'
                itOrSkip "should fail", (done) ->
                  @timeout 10000
                  setupAndRun runner, suite, testcase, (err, results) ->
                    chai.expect(err).to.not.exist
                    chai.expect(results.error, 'missing error').to.exist
                    chai.expect(results.error.message).to.contain 'expect'
                    chai.expect(results.passed).to.be.false
                    done()
