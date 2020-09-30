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
      'browser/*.js',
      'browser/**/*.js',
    ],
    browsers: ['ChromeHeadless'],
    logLevel: config.LOG_WARN,
    singleRun: true,
  };

  config.set(configuration);
};
