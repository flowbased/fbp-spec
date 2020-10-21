const chai = require('chai');
const childProcess = require('child_process');
const path = require('path');

const fbpSpec = function (suite, callback) {
  const prog = './bin/fbp-spec';
  const args = [
    suite,
    '--command', 'python2 protocol-examples/python/runtime.py',
  ];
  const options = {};
  return childProcess.execFile(prog, args, options, callback);
};

const example = (name) => path.join('examples', name);

const countTestcases = function (str) {
  let count = 0;
  const passChars = ['✓', '✗'];
  for (let i = 0; i < str.length; i += 1) {
    const char = str[i];
    if (passChars.indexOf(char) !== -1) {
      count += 1;
    }
  }
  return count;
};

const pyTimeout = 3000;
describe('fbp-spec', () => {
  describe('with failing testcases', () => it('should exit with non-zero code', function (done) {
    this.timeout(pyTimeout);
    fbpSpec(example('simple-failing.yaml'), (err) => {
      chai.expect(err).to.be.an('error');
      chai.expect(err.code).to.not.equal(0);
      chai.expect(err.message).to.contain('Command failed');
      done();
    });
  }));

  describe('with passing testcases', () => it('should exit with 0 code', function (done) {
    this.timeout(pyTimeout);
    fbpSpec(example('simple-passing.yaml'), (err) => {
      if (err) {
        done(err);
        return;
      }
      done();
    });
  }));

  describe('with multiple suites and some failing cases', () => it('should run all testcases', function (done) {
    this.timeout(pyTimeout);
    fbpSpec(example('multisuite-failandpass.yaml'), (err, stdout) => {
      chai.expect(err).to.be.an('error');
      chai.expect(countTestcases(stdout)).to.equal(4);
      chai.expect(stdout).to.contain('sending a boolean with wrong expect');
      chai.expect(stdout).to.contain('should repeat the same');
      done();
    });
  }));
});
