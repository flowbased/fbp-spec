path = require 'path'
require 'isomorphic-fetch'

allowCorsMiddleware = (req, res, next) ->
  res.setHeader 'Access-Control-Allow-Origin', '*'
  next()

module.exports = ->
  # Project configuration
  pkg = @file.readJSON 'package.json'

  @initConfig
    pkg: @file.readJSON 'package.json'

    # Schemas
    yaml:
      schemas:
        files: [
          expand: true
          cwd: 'schemata/'
          src: '*.yaml'
          dest: 'schema/'
        ]

    # Building for browser
    webpack:
      build: require './webpack.config.js'

    watch:
      src:
        files: [
          "src/**/*"
          "examples/**/*"
          "spec/**/*"
        ]
        tasks: "test"
        options:
          livereload: true

    exec:
      runtime:
        command: 'python2 protocol-examples/python/runtime.py --port 3334'

    # Web server for the browser tests
    connect:
      server:
        options:
          port: 8000
          livereload: true
          middleware: (connect, options, middlewares) ->
            middlewares.unshift allowCorsMiddleware
            return middlewares

    # Coding standards
    yamllint:
      schemas: ['schemata/*.yaml']
      examples: ['examples/*.yml']

    coffeelint:
      components: ['Gruntfile.coffee', 'spec/*.coffee']
      options:
        'max_line_length':
          'level': 'ignore'

    # Tests
    mochaTest:
      nodejs:
        src: ['spec/*.coffee']
        options:
          reporter: 'spec'
          require: 'coffeescript/register'
          grep: process.env.TESTS

    # CoffeeScript compilation of tests
    coffee:
      options:
        bare: true
        transpile:
          presets: ['@babel/preset-env']
      lib:
        expand: true
        cwd: 'src'
        src: ['**.coffee']
        dest: 'lib'
        ext: '.js'
      schema:
        expand: true
        cwd: 'schema'
        src: ['**.coffee']
        dest: 'schema'
        ext: '.js'
      browser:
        expand: true
        cwd: 'browser'
        src: ['**.coffee']
        dest: 'browser'
        ext: '.js'
      examples:
        expand: true
        cwd: 'examples'
        src: ['**.coffee']
        dest: 'examples'
        ext: '.js'
      spec:
        expand: true
        cwd: 'spec'
        src: '*.coffee'
        dest: 'browser/spec'
        ext: '.js'

    downloadfile:
      files: [
        { url: 'https://noflojs.org/noflo-browser/everything.html', dest: 'spec/fixtures' }
        { url: 'https://noflojs.org/noflo-browser/everything.js', dest: 'spec/fixtures' }
      ]

    # BDD tests on browser
    karma:
      unit:
        configFile: 'karma.conf.js'

    # Deploying
    copy:
      ui:
        files: [ expand: true, cwd: './ui/', src: '*', dest: './browser/' ]

  # Grunt plugins used for building
  @loadNpmTasks 'grunt-yaml'
  @loadNpmTasks 'grunt-webpack'
  @loadNpmTasks 'grunt-contrib-watch'

  # Grunt plugins used for testing
  @loadNpmTasks 'grunt-yamllint'
  @loadNpmTasks 'grunt-coffeelint'
  @loadNpmTasks 'grunt-contrib-coffee'
  @loadNpmTasks 'grunt-mocha-test'
  @loadNpmTasks 'grunt-contrib-connect'
  @loadNpmTasks 'grunt-karma'
  @loadNpmTasks 'grunt-exec'

  @registerTask 'examples:bundle', ->
    examples = require './examples'
    examples.bundle()

  # Grunt plugins used for deploying
  @loadNpmTasks 'grunt-contrib-copy'

  # Our local tasks
  grunt = @
  @registerMultiTask 'downloadfile', 'Download a file', ->
    callback = @async()
    promises = @data.map (conf) ->
      fetch(conf.url)
      .then (res) ->
        return res.text()
      .then (content) ->
        filename = path.basename conf.url
        location = path.join conf.dest, path.sep, filename
        grunt.file.write location, content
        console.log "Wrote #{conf.url} to #{location}"
        return true
    Promise.all promises
    .then ->
      do callback
    , (err) ->
      callback err

  @registerTask 'build', 'Build', (target = 'all') =>
    @task.run 'yaml'
    @task.run 'coffee'
    if target != 'nodejs'
      @task.run 'webpack'
      @task.run 'examples:bundle'
      @task.run 'copy:ui'

  @registerTask 'test', 'Build and run tests', (target = 'all') =>
    @task.run 'coffeelint'
    @task.run 'yamllint'
    @task.run "build:#{target}"
    @task.run 'mochaTest'
    if target != 'nodejs'
      @task.run 'downloadfile'
      @task.run 'connect'
      @task.run 'karma'

  @registerTask 'default', ['test']

  @registerTask 'uidev', ['connect:server:keepalive']

  @registerTask 'dev', 'Developing', (target = 'all') =>
    @task.run 'test'
    @task.run 'watch'
