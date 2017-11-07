'use strict';

var chai, child_process, countTestcases, example, fbpSpec, path, pyTimeout;

chai = require('chai');

child_process = require('child_process');

path = require('path');

fbpSpec = function fbpSpec(suite, callback) {
  var args, options, prog;
  prog = "./bin/fbp-spec";
  args = [suite, '--command', 'python2 protocol-examples/python/runtime.py'];
  options = {};
  return child_process.execFile(prog, args, options, callback);
};

example = function example(name) {
  return path.join('examples', name);
};

countTestcases = function countTestcases(str) {
  var char, count, i, len, passChars;
  count = 0;
  passChars = ['✓', '✗'];
  for (i = 0, len = str.length; i < len; i++) {
    char = str[i];
    if (passChars.indexOf(char) !== -1) {
      count += 1;
    }
  }
  return count;
};

pyTimeout = 3000;

describe('fbp-spec', function () {
  describe("with failing testcases", function () {
    return it('should exit with non-zero code', function (done) {
      this.timeout(pyTimeout);
      return fbpSpec(example('simple-failing.yaml'), function (err) {
        chai.expect(err).to.exist;
        chai.expect(err.code).to.not.equal(0);
        chai.expect(err.message).to.contain('Command failed');
        return done();
      });
    });
  });
  describe("with passing testcases", function () {
    return it('should exit with 0 code', function (done) {
      this.timeout(pyTimeout);
      return fbpSpec(example('simple-passing.yaml'), function (err) {
        chai.expect(err).to.not.exist;
        return done();
      });
    });
  });
  return describe("with multiple suites and some failing cases", function () {
    return it('should run all testcases', function (done) {
      this.timeout(pyTimeout);
      return fbpSpec(example('multisuite-failandpass.yaml'), function (err, stdout, stderr) {
        chai.expect(err).to.exist;
        chai.expect(countTestcases(stdout)).to.equal(4);
        chai.expect(stdout).to.contain('sending a boolean with wrong expect');
        chai.expect(stdout).to.contain('should repeat the same');
        return done();
      });
    });
  });
});