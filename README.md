# socket-pack

support pack and unpack for socket data.

features:

- support pack and send large data (max 2^32 Bytes) to other side
- concat data from multiple `data` events and emit a single `package` event

## Usage

```js
const wrap = require('socket-pack')
const net = require('net')

// server
let server = net.createServer(conn => {
  // wrap connection (socket === conn)
  let socket = wrap(conn)

  // send data (could be large data)
  socket.send({
    foo: 'very very large data ....'
  })
})

server.listen(12344, () => {
  // client
  let client = net.createConnection(12344, () => {
    // wrap connection (socket === conn)
    let socket = wrap(client)

    // receive data (will receive entire data object)
    socket.on('package', data => {
      // print: {foo: 'bar'}
      console.log(data)
    })
  })
})
```

## API

### `wrap(socket, opts)`

Params:

- `socket`, *{net.Socket}* socket instance to wrap
- `opts`, *{Object}* set wrap options
  - `opts.encode`, *{Function}* function to encode (Mixed -> Buffer)
  - `opts.decode`, *{Function}* function to decode (Buffer -> Mixed)

After call `wrap()` on `Socket` instance, the methods bellow will be available

#### `socket.send(data[, callback])`

pack data and send.

Params:

- `data`, *{String|Object}* data to send
- `callback`, *{Function}* will invoke after data sent

#### event: `package`

emit when data package received

## LICENSE

MIT
