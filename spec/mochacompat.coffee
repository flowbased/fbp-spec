
require '../src/mochacompat' # Register custom UI
Mocha = require 'mocha'

addTests = (mocha) ->
  fs = require 'fs'
  path = require 'path'

  testDir = path.join __dirname, 'fixtures/mochacases'

  fs.readdirSync(testDir).filter (filename) ->
    isJs = filename.substr(-3) == '.js';
    isCoffee = filename.substr(-7) == '.coffee';
    return isJs or isCoffee
  .forEach (filename) ->
    fullPath = path.join testDir, filename
    mocha.addFile fullPath

main = () ->
  # See https://github.com/mochajs/mocha/wiki/Using-mocha-programmatically
  options = 
    ui: 'fbp-spec'
  mocha = new Mocha options
  addTests mocha  
  mocha.run (failures) ->
    process.on 'exit', () ->
      process.exit failures

main() if not module.parent


