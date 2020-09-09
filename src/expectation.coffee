
debug = require('debug')('fbp-spec:expectation')
chai = require 'chai'
JSONPath = require 'jsonpath'

common = require './common'

## A library of standard expectation operators
#
# Should throw AssertionError if expectation is violated,
# with details about the issue
operators =
  'type': (actual, expected) ->
    chai.expect(actual).to.be.a expected
  'equals': (actual, expected) ->
    chai.expect(actual).to.eql expected
  'above': (actual, expected) ->
    chai.expect(actual).to.be.above expected
  'below': (actual, expected) ->
    chai.expect(actual).to.be.below expected
  'haveKeys': (actual, expected) ->
    chai.expect(actual).to.have.keys expected
  'includeKeys': (actual, expected) ->
    chai.expect(actual).to.include.keys expected
  'contains': (actual, expected) ->
    chai.expect(actual).to.contain expected
  'noterror': (actual, expected) ->
    throw actual if actual?.message

# returns a predicate function
# (data) ->
findOperator = (expectation) ->
  for opname, expectValue of expectation
    continue if opname is 'path'
    op = operators[opname]
    if op
      predicate = (data) ->
        op data, expectValue
      predicate.toString = () -> return "#{opname} #{expectValue}"
      return predicate

  throw new Error "fbp-spec: No operator matching #{Object.keys(expectation)}. Available: #{Object.keys(operators)}"

extractMatches = (expectation, data) ->
  options =
    flatten: true
  if expectation.path
    debug 'extracting JSONPath from', expectation.path, data
    matches = JSONPath.query data, expectation.path, options
    throw new Error("expected JSONPath '#{expectation.path}' to match data in #{JSON.stringify(data)}") if not matches.length
  else
    matches = [ data ]
  debug 'matching against', matches
  return matches

exports.expect = (expects, portsdata) ->

  # can have one or more set of expectations of messages
  expects = [ expects ] if not common.isArray expects

  for e in expects
    # each message expectation can match on ports
    for port, exp of e

      # for each matching port, there can be one or more assertions on the value
      expectations = exp
      expectations = [ expectations ] if not common.isArray expectations
      for expectation in expectations
        debug 'checking port for expectation', port, expectation
        data = portsdata[port]
        if typeof data == 'undefined'
          throw new Error "No data received on port #{port}"
        predicate = findOperator expectation
        matches = extractMatches expectation, data
        for m in matches
          debug 'checking against predicate', m, predicate.toString()
          predicate m

exports.noError = (maybeErr) ->
  chai.expect(maybeErr).to.not.exist

