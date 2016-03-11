'use strict'

var assert = require('assert')
var Promise = require('bluebird')
var Kev = require('..')

module.exports = function (store, options) {
  var kev = Promise.promisifyAll(Kev({ store: store }))
  return kev.putAsync('key2', 'to-expire').then(() => {
    return kev.getAsync('key2')
  }).then((value) => {
    assert.equal(value, 'to-expire')
    return Promise.delay(6000)
  }).then(() => {
    return kev.getAsync('key2')
  }).then(() => {
    return kev.putAsync('key2', 'to-expire', { ttl: 2 })
  }).then(() => {
    return kev.getAsync('key2')
  }).then((value) => {
    assert.equal(value, 'to-expire')
    return Promise.delay(3000)
  }).then(() => {
    return kev.getAsync('key2')
  }).then((value) => {
    assert.equal(value, null)
    return kev.dropAsync('*')
  }).then(() => {
    return kev.close()
  }).then(() => {
    console.log('TTL PASSED')
  })
}
