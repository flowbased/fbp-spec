/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const chai = require('chai');

describe('nested passing', () => describe('sub topic', function() {

  it('should pass', function(done) {
    chai.expect(42).to.equal(42);
    return done();
  });

  return describe('sub sub topic', () => it('should pass', function(done) {
    chai.expect(42).to.equal(42);
    return done();
  }));
}));
