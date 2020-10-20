const debug = require('debug')('fbp-spec:expectation');
const chai = require('chai');
const JSONPath = require('jsonpath');

const common = require('./common');

// # A library of standard expectation operators
//
// Should throw AssertionError if expectation is violated,
// with details about the issue
const operators = {
  type(actual, expected) {
    return chai.expect(actual).to.be.a(expected);
  },
  equals(actual, expected) {
    return chai.expect(actual).to.eql(expected);
  },
  above(actual, expected) {
    return chai.expect(actual).to.be.above(expected);
  },
  below(actual, expected) {
    return chai.expect(actual).to.be.below(expected);
  },
  haveKeys(actual, expected) {
    return chai.expect(actual).to.have.keys(expected);
  },
  includeKeys(actual, expected) {
    return chai.expect(actual).to.include.keys(expected);
  },
  contains(actual, expected) {
    return chai.expect(actual).to.contain(expected);
  },
  noterror(actual) {
    if (actual != null ? actual.message : undefined) { throw actual; }
  },
};

// returns a predicate function
// (data) ->
function findOperator(expectation) {
  const ops = Object.keys(expectation);
  for (let i = 0; i < ops.length; i += 1) {
    const opname = ops[i];
    const expectValue = expectation[opname];
    if (opname !== 'path') {
      const op = operators[opname];
      if (op) {
        const predicate = (data) => op(data, expectValue);
        predicate.toString = () => `${opname} ${expectValue}`;
        return predicate;
      }
    }
  }

  throw new Error(`fbp-spec: No operator matching ${Object.keys(expectation)}. Available: ${Object.keys(operators)}`);
}

function extractMatches(expectation, data) {
  let matches;
  if (expectation.path) {
    debug('extracting JSONPath from', expectation.path, data);
    matches = JSONPath.query(data, expectation.path);
    if (!matches.length) { throw new Error(`expected JSONPath '${expectation.path}' to match data in ${JSON.stringify(data)}`); }
  } else {
    matches = [data];
  }
  debug('matching against', matches);
  return matches;
}

exports.expect = function expect(expects, portsdata) {
  // can have one or more set of expectations of messages
  if (!common.isArray(expects)) {
    expect([expects]);
    return;
  }

  expects.forEach((e) => {
    // each message expectation can match on ports
    Object.keys(e).forEach((port) => {
      // for each matching port, there can be one or more assertions on the value
      const expectations = common.isArray(e[port]) ? e[port] : [e[port]];
      expectations.forEach((expectation) => {
        debug('checking port for expectation', port, expectation);
        const data = portsdata[port];
        if (typeof data === 'undefined') {
          throw new Error(`No data received on port ${port}`);
        }
        const predicate = findOperator(expectation);
        const matches = extractMatches(expectation, data);
        matches.forEach((m) => {
          debug('checking against predicate', m, predicate.toString());
          predicate(m);
        });
      });
    });
  });
};

exports.noError = (maybeErr) => chai.expect(maybeErr).to.not.exist;
