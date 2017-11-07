"use strict";

var isBrowser;

isBrowser = function isBrowser() {
  return !(typeof process !== "undefined" && process !== null && process.execPath && process.execPath.match(/node|iojs/));
};

describe("require('fbp-spec')", function () {
  return it('should not throw', function () {
    var fbpspec;
    return fbpspec = isBrowser() ? require('fbp-spec') : require('..');
  });
});