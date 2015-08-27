
testsuite = require './testsuite'
runner = require './runner'
subprocess = require './subprocess'

debug = require('debug')('fbp-spec:cli')

## Main
parse = (args) ->
  program = require 'commander'

  program
    .arguments('<suites>')
    .action( (suites) -> program.suites = suites )
    .option('--address <URL>', 'Address of runtime to connect to', String, 'ws://localhost:3569')
    .option('--secret <secret>', 'Runtime secret', String, null)
    .option('--command <command>', 'Command to launch runtime under test', String, null)
    .parse(process.argv)

  return program


startRuntime = (options, callback) ->

  if not options.command # we're not responsible for starting it
    callback null
    return null
  subprocessOptions = {}
  return subprocess.start options.command, subprocessOptions, callback

hasErrors = (suites) ->
  failures = 0
  for s in suites
    for c in s.cases
      failures += 1 if c.error
  return failures > 0

runOptions = (options, onUpdate, callback) ->
  suites = testsuite.getSuitesSync options.suites
  child = null

  cleanReturn = (err) ->
    child.kill() if child
    return callback err, suites

  def =
    protocol: 'websocket'
    address: options.address
    secret: options.secret

  debug 'runtime info', def
  ru = new runner.Runner def
  child = startRuntime options, (err) ->
    cleanReturn err if err

    ru.connect (err) ->
      cleanReturn err if err

      runner.runAll ru, suites, onUpdate, (err) ->
        cleanReturn err if err

        ru.disconnect (err) ->
          cleanReturn err

testStatusText = (suites) ->
  results = []
  ident = '  '
  for s in suites
    for c in s.cases
      continue if not c.passed? or c.shown
      results.push "#{s.name}" if not s.titleshown
      s.titleshown = true
      c.shown = true # bit hacky, mutates suites
      res = if c.passed then '✓' else "✗ Error: #{c.error}"
      res = "SKIP: #{c.skip}" if c.skip
      results.push "#{ident}#{c.name}\n#{ident+ident}#{c.assertion}: #{res}"
  return results

main = () ->
  options = parse process.argv

  onUpdate = (suites) ->
    r = testStatusText suites
    console.log r.join('\n')

  runOptions options, onUpdate, (err, suites) ->
    throw err if err
    exitStatus = if hasErrors suites then 2 else 0
    process.exit exitStatus


exports.main = main
