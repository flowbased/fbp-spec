
chai = require 'chai'

describe 'nested passing', ->

  describe 'sub topic', () ->

    it 'should pass', (done) ->
      chai.expect(42).to.equal 42
      done();

    describe 'sub sub topic', () ->
      it 'should pass', (done) ->
        chai.expect(42).to.equal 42
        done();
