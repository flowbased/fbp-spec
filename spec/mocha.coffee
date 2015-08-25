fbpspec = require '..'

rt =
  protocol: "websocket"
  address: "ws://localhost:3569"
  secret: "py3k" # Optional. If needed to connect/authenticate to runtime
  command: 'python2 protocol-examples/python/runtime.py' # Optional. Can be used to start runtime automatically

fbpspec.mocha.run rt, './examples/simple-passing.yaml', { starttimeout: 1000 }
