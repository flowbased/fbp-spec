/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const debug = require('debug')('fbp-spec:expectation');
const chai = require('chai');
const JSONPath = require('jsonpath');

const common = require('./common');

//# A library of standard expectation operators
//
// Should throw AssertionError if expectation is violated,
// with details about the issue
const operators = {
  'type'(actual, expected) {
    return chai.expect(actual).to.be.a(expected);
  },
  'equals'(actual, expected) {
    return chai.expect(actual).to.eql(expected);
  },
  'above'(actual, expected) {
    return chai.expect(actual).to.be.above(expected);
  },
  'below'(actual, expected) {
    return chai.expect(actual).to.be.below(expected);
  },
  'haveKeys'(actual, expected) {
    return chai.expect(actual).to.have.keys(expected);
  },
  'includeKeys'(actual, expected) {
    return chai.expect(actual).to.include.keys(expected);
  },
  'contains'(actual, expected) {
    return chai.expect(actual).to.contain(expected);
  },
  'noterror'(actual, expected) {
    if (actual != null ? actual.message : undefined) { throw actual; }
  }
};

// returns a predicate function
// (data) ->
const findOperator = function(expectation) {
  for (var opname in expectation) {
    var expectValue = expectation[opname];
    if (opname === 'path') { continue; }
    var op = operators[opname];
    if (op) {
      const predicate = data => op(data, expectValue);
      predicate.toString = () => `${opname} ${expectValue}`;
      return predicate;
    }
  }

  throw new Error(`fbp-spec: No operator matching ${Object.keys(expectation)}. Available: ${Object.keys(operators)}`);
};

const extractMatches = function(expectation, data) {
  let matches;
  if (expectation.path) {
    debug('extracting JSONPath from', expectation.path, data);
    matches = JSONPath.query(data, expectation.path);
    if (!matches.length) { throw new Error(`expected JSONPath '${expectation.path}' to match data in ${JSON.stringify(data)}`); }
  } else {
    matches = [ data ];
  }
  debug('matching against', matches);
  return matches;
};

exports.expect = function(expects, portsdata) {

  // can have one or more set of expectations of messages
  if (!common.isArray(expects)) { expects = [ expects ]; }

  return Array.from(expects).map((e) =>
    // each message expectation can match on ports
    (() => {
      const result = [];
      for (var port in e) {

      // for each matching port, there can be one or more assertions on the value
        const exp = e[port];
        var expectations = exp;
        if (!common.isArray(expectations)) { expectations = [ expectations ]; }
        result.push((() => {
          const result1 = [];
          for (let expectation of Array.from(expectations)) {
            debug('checking port for expectation', port, expectation);
            const data = portsdata[port];
            if (typeof data === 'undefined') {
              throw new Error(`No data received on port ${port}`);
            }
            var predicate = findOperator(expectation);
            var matches = extractMatches(expectation, data);
            result1.push((() => {
              const result2 = [];
              for (let m of Array.from(matches)) {
                debug('checking against predicate', m, predicate.toString());
                result2.push(predicate(m));
              }
              return result2;
            })());
          }
          return result1;
        })());
      }
      return result;
    })());
};

exports.noError = maybeErr => chai.expect(maybeErr).to.not.exist;

