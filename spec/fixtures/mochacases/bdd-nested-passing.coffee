
chai = require 'chai'

describe 'nested passing', ->
  console.log 'describe fired'

  describe 'sub topic', () ->
    console.log 'sub describe fired'

    it 'should pass', (done) ->
      chai.expect(42).to.equal 42
      done();

    describe 'sub sub topic', () ->
      it 'should pass', (done) ->
        chai.expect(42).to.equal 42
        done();
