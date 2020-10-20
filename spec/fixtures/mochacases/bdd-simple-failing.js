/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const chai = require('chai');

describe('simple failing', () => it('should fail', function(done) {
  chai.expect(42).to.equal(41);
  return done();
}));
