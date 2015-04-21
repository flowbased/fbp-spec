
chai = require 'chai'

Runner = require('./runner').Runner
getSuitesSync = require('./runner').getSuitesSync
subprocess = require './subprocess'

debug = require('./common').debug

runSuite = (runner, suite) ->

  describe "#{suite.name}", ->
    beforeEach (done) ->
      @timeout suite.timeout if suite.timeout?
      runner.setupSuite suite, done
    afterEach (done) ->
      runner.teardownSuite suite, done

    suite.cases.forEach (testcase) ->
      describe testcase.name, ->
        it testcase.assertion, (done) ->
          @timeout suite.timeout if suite.timeout?
          @timeout testcase.timeout if testcase.timeout?

          runner.runTest testcase, (err, received) ->
            chai.expect(err).to.not.exist
            chai.expect(received).to.eql testcase.expect
            done()

## run()
# Must be be ran using Mocha,
# it is responsible for setting up the "describe", and "it" functions
exports.run = (rt, tests, options) ->
  runner = new Runner rt
  suites = getSuitesSync tests
  process = null

  start = (callback) ->
    return callback null if not rt.command
    process = subprocess.start rt.command, callback
  stop = (callback) ->
    process.kill() if not process
    return callback null

  before (done) ->
    @timeout 5000 # default pretty high to give time for runtime to start
    start (err) ->
      debug 'connect', err
      runner.connect done
  after (done) ->
    stop (err) ->
      debug 'disconnect', err
      runner.disconnect done

  for suite in suites
    runSuite runner, suite

