
# Checking interface
# listens to packet data in test
# validates it
# reports it conclusion to the runner/UI
#
# should be able to do:
# - simple packet *value* validations
# - validate packet firing patterns (based on class invariants)
#
# needs
# packet inputs, declared expected outputs
# and things crossing over single packets, like 1-in-1-out invariant
# what is the lifetime of the checker?
# challenge: when to stop it? network:stop ?
#
class Checker
  constructor: () ->

  


# Ideas
# Invariants library
invariants =
    'always-sends-data':
        description: 'On sending data in, component always sends some data out on a port'

    '1-in-1-out':

    'forwards-groups':

    'strictly-typed-output':
        description: 'Never sends data out with type different from input'

    'strictly-typed-input':
        description: 'Errors when given wrongly typed data'

# Parametices invariants
    'is-inverse-to':
        description: 'An inverse operation exists and is declared on component'
        # The two can be chained together and tested across domain for equivalence

    'is-equivalent-to':
        description: 'All invariants for FOO also applies to me'

# Composite invariants, a variant can depend (implies) on other2
    'foo':
        implies: ['bar', 'baz']



