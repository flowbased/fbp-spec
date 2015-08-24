fbpspec = require '../'

tv4 = require 'tv4'
chai = require 'chai' if not chai
yaml = require 'js-yaml'

examplesDir = require('path').join __dirname, '..', 'examples'
listExamples = () ->
  return require('fs').readdirSync examplesDir
getExample = (name) ->
  p = require('path').join examplesDir, name
  content = require('fs').readFileSync p, encoding:'utf-8'
  results = []
  yaml.safeLoadAll content, (doc) ->
    results.push doc
  results = results[0] if results.length == 1
  return results

runtimeInfo =
  protocol: 'websocket'
  address: "ws://localhost:3335"
  command: "python2 protocol-examples/python/runtime.py --port 3335"

describe 'Examples', ->
  schema = fbpspec.getSchema 'testsfile'
  runner = null
  runtime = null
  before (done) ->
    @timeout 4000
    tv4.addSchema schema.id, schema
    runner = new fbpspec.runner.Runner runtimeInfo
    runtime = fbpspec.subprocess.start runtimeInfo.command, {}, (err) ->
      return done err if err
      runner.connect done
  after (done) ->
    tv4.reset()
    runtime.kill() if runtime
    runner.disconnect done

  listExamples().forEach (name) ->
    example = null
    describe "#{name}", ->
      error = null
      try
        example = getExample name
      catch e
        error = e

      it 'should load without error', ->
        chai.expect(error).to.not.exist
        chai.expect(example).to.exist

      it "should valididate against schema", ->
        results = tv4.validateMultiple example, schema.id
        chai.expect(results.errors).to.eql []

      describe 'testcases', ->

        # XXX: We get away with not running suite setup/teardown here
        # cause the Python 'runtime' under test always echos
        example = [] if not example
        suites = if Array.isArray example then example.slice 0 else [ example ]
        suites.forEach (suite) ->
          suite.cases.forEach (testcase) ->
            describe "#{testcase.name}", () ->

              itOrSkip = if testcase.skip then it.skip else it
              if testcase.assertion == 'should pass'
                itOrSkip "should pass", (done) ->
                  fbpspec.runner.runTestAndCheck runner, testcase, (err, results) ->
                    chai.expect(err).to.not.exist
                    chai.expect(results.error).to.not.exist
                    chai.expect(results.passed).to.be.true
                    done()
              else if testcase.assertion == 'should fail'
                itOrSkip "should fail", (done) ->
                  fbpspec.runner.runTestAndCheck runner, testcase, (err, results) ->
                    chai.expect(err).to.not.exist
                    chai.expect(results.error).to.exist
                    chai.expect(results.passed).to.be.false
                    done()
