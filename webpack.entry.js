/* eslint-env browser */
const exported = {
  // eslint-disable-next-line global-require
  'fbp-spec': require('./index'),
  // eslint-disable-next-line global-require
  chai: require('chai'),
  // eslint-disable-next-line global-require
  'js-yaml': require('js-yaml'),
};

if (window) {
  window.require = function (moduleName) {
    if (exported[moduleName]) {
      return exported[moduleName];
    }
    throw new Error(`Module ${moduleName} not available`);
  };
}
