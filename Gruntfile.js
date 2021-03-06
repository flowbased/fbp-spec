const path = require('path');
const fetch = require('isomorphic-fetch');
const webpackConfig = require('./webpack.config.js');

module.exports = function () {
  // Project configuration
  const pkg = this.file.readJSON('package.json');

  this.initConfig({
    pkg,

    // Schemas
    yaml: {
      schemas: {
        files: [{
          expand: true,
          cwd: 'schemata/',
          src: '*.yaml',
          dest: 'schema/',
        },
        ],
      },
    },

    // Building for browser
    webpack: {
      build: webpackConfig,
    },

    watch: {
      src: {
        files: [
          'src/**/*',
          'examples/**/*',
          'spec/**/*',
        ],
        tasks: 'test',
        options: {
          livereload: true,
        },
      },
    },

    exec: {
      runtime: {
        command: 'python2 protocol-examples/python/runtime.py --port 3334',
      },
    },

    // Coding standards
    yamllint: {
      schemas: ['schemata/*.yaml'],
      examples: ['examples/*.yml'],
    },

    // Tests
    mochaTest: {
      nodejs: {
        src: ['spec/*.js'],
        options: {
          reporter: 'spec',
          grep: process.env.TESTS,
        },
      },
    },

    downloadfile: {
      files: [
        { url: 'https://noflojs.org/noflo-browser/everything.html', dest: 'browser/spec/fixtures' },
        { url: 'https://noflojs.org/noflo-browser/everything.js', dest: 'browser/spec/fixtures' },
      ],
    },

    // BDD tests on browser
    karma: {
      unit: {
        configFile: 'karma.config.js',
      },
    },

    // Deploying
    copy: {
      ui: {
        files: [{
          expand: true, cwd: './ui/', src: '*', dest: './browser/',
        }],
      },
    },
  });

  // Grunt plugins used for building
  this.loadNpmTasks('grunt-yaml');
  this.loadNpmTasks('grunt-webpack');
  this.loadNpmTasks('grunt-contrib-watch');

  // Grunt plugins used for testing
  this.loadNpmTasks('grunt-yamllint');
  this.loadNpmTasks('grunt-mocha-test');
  this.loadNpmTasks('grunt-karma');
  this.loadNpmTasks('grunt-exec');

  this.registerTask('examples:bundle', () => {
    // eslint-disable-next-line global-require
    const examples = require('./examples');
    return examples.bundle();
  });

  // Grunt plugins used for deploying
  this.loadNpmTasks('grunt-contrib-copy');

  // Our local tasks
  const grunt = this;
  this.registerMultiTask('downloadfile', 'Download a file', function () {
    const callback = this.async();
    const promises = this.data.map((conf) => fetch(conf.url)
      .then((res) => res.text()).then((content) => {
        const filename = path.basename(conf.url);
        const location = path.join(conf.dest, path.sep, filename);
        grunt.file.write(location, content);
        console.log(`Wrote ${conf.url} to ${location}`);
        return true;
      }));
    return Promise.all(promises)
      .then(() => callback(),
        (err) => callback(err));
  });

  this.registerTask('build', 'Build', (target = 'all') => {
    this.task.run('yaml');
    if (['all', 'browser'].includes(target)) {
      this.task.run('webpack');
      this.task.run('examples:bundle');
      this.task.run('copy:ui');
    }
  });

  this.registerTask('test', 'Build and run tests', (target = 'all') => {
    this.task.run('yamllint');
    this.task.run(`build:${target}`);
    if (['all', 'nodejs'].includes(target)) {
      this.task.run('mochaTest');
    }
    if (['all', 'browser'].includes(target)) {
      this.task.run('downloadfile');
      this.task.run('karma');
    }
  });

  this.registerTask('default', ['test']);

  this.registerTask('dev', 'Developing', (target = 'all') => {
    this.task.run(`test:${target}`);
    this.task.run('watch');
  });
};
