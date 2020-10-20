const isBrowser = () => !((typeof process !== 'undefined' && process !== null) && process.execPath && process.execPath.match(/node|iojs/));

describe("require('fbp-spec')", () => {
  it('should not throw', () => {
    // eslint-disable-next-line global-require,import/no-unresolved
    const fbpspec = isBrowser() ? require('fbp-spec') : require('..');
    chai.expect(fbpspec).to.be.an('object');
  });
});
