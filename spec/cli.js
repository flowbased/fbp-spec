/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const chai = require('chai');
const child_process = require('child_process');
const path = require('path');

const fbpSpec = function(suite, callback) {
  const prog = "./bin/fbp-spec";
  const args = [
    suite,
    '--command', 'python2 protocol-examples/python/runtime.py'
  ];
  const options = {};
  return child_process.execFile(prog, args, options, callback);
};

const example = name => path.join('examples', name);

const countTestcases = function(str) {
  let count = 0;
  const passChars = ['✓', '✗'];
  for (let char of Array.from(str)) {
    if (passChars.indexOf(char) !== -1) { count += 1; }
  }
  return count;
};

const pyTimeout = 3000;
describe('fbp-spec', function() {

  describe("with failing testcases", () => it('should exit with non-zero code', function(done) {
    this.timeout(pyTimeout);
    return fbpSpec(example('simple-failing.yaml'), function(err) {
      chai.expect(err).to.exist;
      chai.expect(err.code).to.not.equal(0);
      chai.expect(err.message).to.contain('Command failed');
      return done();
    });
  }));

  describe("with passing testcases", () => it('should exit with 0 code', function(done) {
    this.timeout(pyTimeout);
    return fbpSpec(example('simple-passing.yaml'), function(err) {
      if (err) { return done(err); }
      return done();
    });
  }));

  return describe("with multiple suites and some failing cases", () => it('should run all testcases', function(done) {
    this.timeout(pyTimeout);
    return fbpSpec(example('multisuite-failandpass.yaml'), function(err, stdout, stderr) {
      chai.expect(err).to.exist;
      chai.expect(countTestcases(stdout)).to.equal(4);
      chai.expect(stdout).to.contain('sending a boolean with wrong expect');
      chai.expect(stdout).to.contain('should repeat the same');
      return done();
    });
  }));
});
