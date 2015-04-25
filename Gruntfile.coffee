path = require 'path'

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
    browserify:
      options:
        transform: [
          ['coffeeify', {global: true}]
        ]
        browserifyOptions:
          extensions: ['.coffee', '.js']
          ignoreMissing: true
          standalone: 'fbpspec'
      lib:
        files:
          'browser/fbp-spec.js': ['src/index.coffee']

    # Browser build of the client lib
    noflo_browser:
      build:
        files:
          'browser/fbp-spec.js': ['component.json']

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
          require: 'coffee-script/register'

  # Grunt plugins used for building
  @loadNpmTasks 'grunt-yaml'
  @loadNpmTasks 'grunt-browserify'
  @loadNpmTasks 'grunt-noflo-browser'

  # Grunt plugins used for testing
  @loadNpmTasks 'grunt-yamllint'
  @loadNpmTasks 'grunt-coffeelint'
  @loadNpmTasks 'grunt-mocha-test'

  # Grunt plugins used for deploying
  #


  # Our local tasks
  @registerTask 'build', 'Build', (target = 'all') =>
    @task.run 'yaml'
    @task.run 'noflo_browser'

  @registerTask 'test', 'Build and run tests', (target = 'all') =>
    @task.run 'coffeelint'
    @task.run 'yamllint'
    @task.run 'build'
    @task.run 'mochaTest'

  @registerTask 'default', ['test']

