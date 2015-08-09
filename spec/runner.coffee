
chai = require 'chai'
child_process = require 'child_process'
path = require 'path'

fbpSpec = (suite, callback) ->
  prog = "./bin/fbp-spec"
  args = [
    suite
    '--command', 'python2 protocol-examples/python/runtime.py'
  ]
  options = {}
  child_process.execFile prog, args, options, callback

example = (name) ->
  return path.join 'examples', name

countTestcases = (str) ->
  count = 0
  passChars = ['✓', '✗']
  for char in str
    count += 1 if passChars.indexOf(char) != -1
  return count

pyTimeout = 3000
describe 'fbp-spec', ->

  describe "with failing testcases", ->
    it 'should exit with non-zero code', (done) ->
      @timeout pyTimeout
      fbpSpec example('simple-failing.yaml'), (err) ->
        chai.expect(err).to.exist
        chai.expect(err.code).to.not.equal 0
        chai.expect(err.message).to.contain 'Command failed'
        done()

  describe "with passing testcases", ->
    it 'should exit with 0 code', (done) ->
      @timeout pyTimeout
      fbpSpec example('simple-passing.yaml'), (err) ->
        chai.expect(err).to.not.exist
        done()

  describe "with multiple suites and some failing cases", ->
    it 'should run all testcases', (done) ->
      @timeout pyTimeout
      fbpSpec example(''), (err, stdout, stderr) ->
        chai.expect(err).to.exist
        chai.expect(countTestcases(stdout)).to.equal 4
        chai.expect(stdout).to.contain 'sending a boolean with wrong expect'
        chai.expect(stdout).to.contain 'should repeat the same'
        done()
