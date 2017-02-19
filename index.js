try {
  module.exports = require('./browser/fbp-spec.js');
} catch (e) {
  console.log("fbp-spec: Failed to load built file, loading source. Error:", e);
  require('coffee-script/register');
  module.exports = require('./src/index');
}
