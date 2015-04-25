
# For starting the runtime used in test
try
  child_process = require 'child_process'
catch err
  return

common = require './common'

debug = common.debug

exports.start = (command, callback) ->

  started = false
  stderr = ""
  stdout = ""

  # FIXME: using sh to interpret command will Unix-specific
  prog = 'sh'
  args = [ '-c', command ]
  child = child_process.spawn prog, args

  debug 'spawned, waiting for output'

  child.on 'error', (err) ->
    return callback err

  child.stdout.on 'data', (data) ->
    stdout += data.toString()
    if not started
      debug 'got output, transitioning to started'
      started = true
      # give process some time to open port
      setTimeout callback, 100

  child.stderr.on 'data', (data) ->
    stderr += data.toString()
    if not started
      debug 'got stderr, failing'
      started = true
      return callback new Error "Subprocess wrote on stderr: '#{stderr}'"


  return child
