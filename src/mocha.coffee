
try
  chai = require 'chai'
catch err
  return

Runner = require('./runner').Runner
testsuite = require './testsuite'
subprocess = require './subprocess'

debug = require('debug')('fbp-spec:mocha')

runSuite = (runner, suite) ->

  suiteDescribe = if suite.skip then describe.skip else describe
  suiteDescribe "#{suite.name}", ->
    beforeEach (done) ->
      @timeout suite.timeout if suite.timeout?
      runner.setupSuite suite, done
    afterEach (done) ->
      runner.teardownSuite suite, done

    suite.cases.forEach (testcase) ->
       caseDescribe = if testcase.skip then describe.skip else describe
       caseDescribe testcase.name, ->
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
  # default pretty high to give time for runtime to start
  options.starttimeout = 5000 if not options.starttimeout?
  options.fixturetimeout = 2000 if not options.fixturetimeout?

  runner = new Runner rt
  try
    suites = testsuite.getSuitesSync tests
  catch e
    console.log 'Unable to get suites:', e
    throw e
  process = null

  start = (callback) ->
    return callback null if not rt.command
    subprocessOptions =
      timeout: options.starttimeout
    process = subprocess.start rt.command, subprocessOptions, callback
  stop = (callback) ->
    process.kill() if process
    return callback null

  before (done) ->
    @timeout options.starttimeout+500
    start (err) ->
      debug 'started', err
      chai.expect(err).to.not.exist
      runner.connect done
  after (done) ->
    stop (err) ->
      debug 'stopped', err
      chai.expect(err).to.not.exist
      runner.disconnect done

  for suite in suites
    suite.timeout = options.fixturetimeout if not suite.timeout?
    runSuite runner, suite

