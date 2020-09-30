module.exports = (config) => {
  const configuration = {
    basePath: process.cwd(),
    frameworks: [
      'mocha',
      'chai',
    ],
    reporters: [
      'mocha',
    ],
    files: [
      'browser/fbp-spec.js',
      'examples/bundle.js',
      'browser/spec/import.js',
      'browser/spec/examples.js',
    ],
    browsers: ['ChromeHeadless'],
    logLevel: config.LOG_WARN,
    singleRun: true,
  };

  config.set(configuration);
};
