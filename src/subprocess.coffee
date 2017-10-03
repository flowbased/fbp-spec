
common = require './common'
debug = require('debug')('fbp-spec:subprocess')

exports.start = (command, options, callback) ->
  try
    child_process = require 'child_process'
  catch err
    return callback err

  options.timeout = 300 if not options.timeout?

  started = false
  stderr = ""
  stdout = ""

  # FIXME: using sh to interpret command will Unix-specific
  prog = 'sh'
  args = [ '-c', command ]
  child = child_process.spawn prog, args

  debug 'spawned', "'#{prog} #{args.join(' ')}'"
  debug 'waiting for output'

  child.on 'error', (err) ->
    return callback err

  child.stdout.on 'data', (data) ->
    data = data.toString()
    stdout += data
    debug 'sub stdout', data
    if not started
      debug 'got output, transitioning to started'
      started = true
      # give process some time to open port
      setTimeout callback, 100

  child.stderr.on 'data', (data) ->
    data = data.toString()
    stderr += data
    debug 'sub stderr', data
    if not started
      debug 'got stderr, failing'
      started = true
      return callback new Error "Subprocess wrote on stderr: '#{stderr}'"

  setTimeout () ->
    if not started
      debug 'timeout waiting for output, assuming started'
      started = true
      return callback null
  , options.timeout

  return child
