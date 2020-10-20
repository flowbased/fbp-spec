/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const isBrowser = () => !((typeof process !== 'undefined' && process !== null) && process.execPath && process.execPath.match(/node|iojs/));

describe("require('fbp-spec')", () => it('should not throw', function() {
  let fbpspec;
  return fbpspec = isBrowser() ? require('fbp-spec') : require('..');
}));

