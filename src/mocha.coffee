
## Run fbp-spec testcases using Mocha as a runner/frontend
## Intended to allow reuse of Mocha reporters, or
## to quickly add a couple of fbp-spec cases to a predominantly Mocha-based testsuite
## See also ./mochacompat.coffee

runnerModule = require('./runner')
Runner = runnerModule.Runner
testsuite = require './testsuite'
expectation = require './expectation'
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

          runnerModule.runTestAndCheck runner, testcase, (err, result) ->
            return done err if err
            return done result.error

## run()
# Must be be ran using Mocha,
# it is responsible for setting up the "describe", and "it" functions
exports.run = (rt, tests, options) ->
  # default pretty high to give time for runtime to start
  options.starttimeout = 5000 if not options.starttimeout?
  options.fixturetimeout = 2000 if not options.fixturetimeout?

  runnerOptions =
    connectTimeout: options.starttimeout
  runner = new Runner rt, runnerOptions
  try
    suites = testsuite.getSuitesSync tests
  catch e
    console.log 'Unable to get suites:', e
    throw e
  process = null

  start = (callback) ->
    return callback null if not rt.command
    subprocessOptions = {}
    process = subprocess.start rt.command, subprocessOptions, callback
  stop = (callback) ->
    process.kill() if process
    return callback null

  before (done) ->
    @timeout options.starttimeout+500
    start (err) ->
      debug 'started', err
      expectation.noError err
      runner.connect done
    return null
  after (done) ->
    stop (err) ->
      debug 'stopped', err
      expectation.noError err
      runner.disconnect done
    return null

  for suite in suites
    suite.timeout = options.fixturetimeout if not suite.timeout?
    runSuite runner, suite

