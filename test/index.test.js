'use strict'

const assert = require('assert')
const EventEmitter = require('events').EventEmitter
const wrap = require('..')

const TEST_MTU = 10

class Socket extends EventEmitter {
  write (data, callback) {
    let max = data.length
    let mtu = 10
    let offset = 0

    while (offset < max) {
      this.emit('data', data.slice(offset, offset + mtu))
      offset += mtu
    }

    if (callback) {
      callback()
    }
  }
}

function pack (text) {
  let buf = Buffer.alloc(4)
  buf.writeUInt32BE(text.length)

  return Buffer.concat([buf, Buffer.from(text)])
}

describe('socket pack test', function () {
  // write:
  // ----["1234","5678"]----[true]
  // 01234567890123456789012345678
  // ^         ^         ^
  it('should receive data and emit package event', function () {
    let socket = wrap(new Socket())
    let pkgs = []

    socket.on('package', pkg => {
      pkgs.push(pkg)
    })

    socket.send({foo: 'bar'})
    socket.write(Buffer.concat([pack('["1234","5678"]'), pack('[true]')]))

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          assert.equal(pkgs[0].foo, 'bar')
          assert.equal(pkgs[1][0], '1234')
          assert.equal(pkgs[2][0], true)

          resolve()
        } catch (err) {
          reject(err)
        }
      }, 100)
    })
  })

  it('should pack with custom encode and decode', function () {
    let socket = wrap(new Socket(), {
      encode: text => {
        return Buffer.from('>' + text)
      },
      decode: buf => {
        return buf.toString()
      }
    })

    let received = null
    socket.on('package', data => {
      received = data
    })
    socket.send('abc')

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          assert.equal(received, '>abc')

          resolve()
        } catch (err) {
          reject(err)
        }
      }, 100)
    })
  })
})
