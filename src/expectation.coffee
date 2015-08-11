
common = require './common'
chai = require 'chai'

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

# returns a predicate function
# (data) ->
findOperator = (expectation) ->
  for opname, expectValue of expectation
    continue if opname is 'path'
    op = operators[opname]
    if op
      return (data) ->
        op data, expectValue

  # TEMP: default to equals, for compat
  return (data) ->
    operators.equals data, expectation
  #throw new Error "fbp-spec: No operator matching #{Object.keys(expectation)}. Available: #{Object.keys(operators)}"

extractData = (expectation, data) ->
  # TODO: apply JSONPath
  return data

exports.expect = (testcase, data) ->
  expects = testcase.expect
  expects = [ expects ] if not common.isArray expects

  for e in expects
    predicate = findOperator e
    d = extractData e, data
    predicate d

exports.noError = (maybeErr) ->
  chai.expect(maybeErr).to.not.exist

