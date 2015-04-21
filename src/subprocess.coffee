
# For starting the runtime used in test
child_process = require 'child_process'
common = require './common'

debug = common.debug

exports.start = (command, callback) ->

  # FIXME: using sh to interpret command will Unix-specific
  prog = 'sh'
  args = [ '-c', command ]
  child = child_process.spawn prog, args
  child.on 'error', (err) ->
    return callback err

  child.stdout.on 'data', (data) ->
    debug data.toString()
  child.stderr.on 'data', (data) ->
    debug data.toString()

  # give process some time to open port
  setTimeout callback, 5000

  return child
