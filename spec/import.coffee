
isBrowser = () ->
  return not (process? and process.execPath and process.execPath.match /node|iojs/)

describe "require('fbp-spec')", ->
  it 'should not throw', () ->
    fbpspec = if isBrowser() then require 'fbp-spec' else require '..'

