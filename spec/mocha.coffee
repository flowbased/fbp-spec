fbpspec = require '..'

rt =
  label: "Example runtime"
  description: "Simple Python example FBP runtime"
  type: "fbp-python-example"
  protocol: "websocket"
  address: "ws://localhost:3569"
  secret: "py3k"
  id: "2ef763ff-1f28-49b8-b58f-5c6a5c23af26"
  user: "3f3a8187-0931-4611-8963-239c0dff1939"
  command: 'python2 protocol-examples/python/runtime.py'

fbpspec.mocha.run rt, './examples/simple-passing.yaml', {}
