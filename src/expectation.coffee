
debug = require('debug')('fbp-spec:expectation')
chai = require 'chai'
JSONPath = require 'JSONPath'

common = require './common'

## A library of standard expectation operators
#
# Should throw AssertionError if expectation is violated,
# with details about the issue
operators =
  'equals': (actual, expected) ->
    chai.expect(actual).to.eql expected
  'above': (actual, expected) ->
    chai.expect(actual).to.be.above expected
  'below': (actual, expected) ->
    chai.expect(actual).to.be.below expected
  'haveKeys': (actual, expected) ->
    chai.expect(actual).to.be.have.keys expected
  'type': (actual, expected) ->
    chai.expect(actual).to.be.a expected

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

  # TEMP: default to equals, for compat
  p = (data) ->
    operators.equals data, expectation
  p.toString = () -> "equals #{expectation}"
  return p
  #throw new Error "fbp-spec: No operator matching #{Object.keys(expectation)}. Available: #{Object.keys(operators)}"

extractMatches = (expectation, data) ->
  options =
    flatten: true
  if expectation.path
    debug 'extracting JSONPath from', expectation.path, data
    matches = JSONPath.eval data, expectation.path, options
    throw new Error("JSONPath '#{expectation.path}' did not match any data in #{JSON.stringify(data)}") if not matches.length
  else
    matches = [ data ]
  debug 'matching against', matches
  return matches

exports.expect = (testcase, portsdata) ->
  expects = testcase.expect
  expects = [ expects ] if not common.isArray expects

  for e in expects
    for port, expectation of e

      debug 'checking port for expectation', port, expectation
      data = portsdata[port]
      predicate = findOperator expectation
      matches = extractMatches expectation, data
      for m in matches
        debug 'checking against predicate', m, predicate.toString()
        predicate m

exports.noError = (maybeErr) ->
  chai.expect(maybeErr).to.not.exist

