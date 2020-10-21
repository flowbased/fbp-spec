describe("require('fbp-spec')", () => {
  const isBrowser = () => !((typeof process !== 'undefined' && process !== null) && process.execPath && process.execPath.match(/node|iojs/));
  // eslint-disable-next-line global-require
  const chai = require('chai');

  it('should not throw', () => {
    // eslint-disable-next-line global-require,import/no-unresolved
    const fbpspec = isBrowser() ? require('fbp-spec') : require('..');
    chai.expect(fbpspec).to.be.an('object');
  });
});
