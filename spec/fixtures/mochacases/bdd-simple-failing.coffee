
chai = require 'chai'

describe 'simple failing', () ->
  it 'should fail', (done) ->
    chai.expect(42).to.equal 41
    done();
