fbpspec = require '..'

rt =
  protocol: "websocket"
  address: "ws://localhost:3569"
  secret: "py3k"
  command: 'python2 protocol-examples/python/runtime.py'

fbpspec.mocha.run rt, './examples/simple-passing.yaml', { starttimeout: 1000 }
