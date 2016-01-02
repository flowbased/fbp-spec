
chai = require 'chai'

describe 'simple passing', () ->
  it 'should pass', (done) ->
    chai.expect(42).to.equal 42
    done();
