'use strict'

const debug = require('debug')('socket-pack')

const LENGTH_BYTES = 4

function noop () {}

function jsonEncode (data) {
  return Buffer.from(JSON.stringify(data))
}

function jsonDecode (data) {
  return JSON.parse(data.toString())
}

/**
 * wrap socket to support pack/unpack
 * @param  {Socket} socket socket instance
 * @param  {Object} opts   wrap options
 *  - {Function} opts.encode custom encoder (String/Object -> Buffer)
 *  - {Function} opts.decode custom decode (Buffer -> String/Object)
 * @return {Socket}
 */
function wrap (socket, opts) {
  opts = opts || {}

  let encode = opts.encode || jsonEncode
  let decode = opts.decode || jsonDecode
  // processing: {
  //   length: <Number>,
  //   buffer: <Buffer>
  // }
  let processing = null
  let unprocessed = null

  socket.send = (data, callback) => {
    callback = callback || noop

    let dataBuf = encode(data)
    let lengthBuf = Buffer.alloc(LENGTH_BYTES)

    // write data length to first 4 bytes
    lengthBuf.writeUInt32BE(dataBuf.length, 0)

    debug('ready to send data: length bytes = %s', dataBuf)

    // write socket
    try {
      const onError = err => {
        callback(err)
      }
      socket.once('error', onError)
      socket.write(Buffer.concat([lengthBuf, dataBuf]), () => {
        // if write successfully, then remove Error listener
        socket.removeListener('error', onError)
        callback(null)
      })
    } catch (err) {
      callback(err)
    }
  }

  socket.on('data', data => {
    // if exists unprocessed data, then concat it
    if (unprocessed) {
      debug('concat unprocessed data: length = %s', unprocessed.length)
      data = Buffer.concat([unprocessed, data])
      unprocessed = null
    }

    let offset = 0
    let fullLength = data.length
    let toRead = 0

    // reads:
    // 1. <|------>         (processing = null)
    // 2. <|----|---...>    (processing = null)
    // 3. <---|---|--->     (processing = {...})
    while (offset < fullLength) {
      debug('ready to process data: processing = %s, offset = %s', !!processing, offset)

      // if some package is processing
      if (processing) {
        toRead = processing.length - processing.buffer.length
      } else {
        // if new package length less than 4 bytes, then process next time
        if (fullLength - offset < LENGTH_BYTES) {
          unprocessed = data.slice(offset, fullLength)
          debug('rest data length < %s: length = %s', LENGTH_BYTES, unprocessed.length)
          break
        }

        toRead = data.readUInt32BE(offset)
        offset += LENGTH_BYTES

        debug('read new package: length = %s', toRead)

        processing = {
          length: toRead,
          buffer: Buffer.alloc(0)
        }
      }

      // start to read
      let realRead = Math.min(toRead, fullLength - offset)
      debug('read bytes: read = %s, offset = %s', realRead, offset)
      processing.buffer = Buffer.concat([processing.buffer, data.slice(offset, offset + realRead)])
      offset += realRead

      // if package read finished
      if (processing.length - processing.buffer.length <= 0) {
        debug('emit package event')
        socket.emit('package', decode(processing.buffer))
        processing = null
      }
    }
  })

  return socket
}

module.exports = wrap
