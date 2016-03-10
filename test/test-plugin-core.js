'use strict'

var assert = require('assert')
var Promise = require('bluebird')
var Kev = require('..')

module.exports = function (store, options) {
  var kev = Promise.promisifyAll(Kev({ store: store }))
  return kev.putAsync('key1', 'value1').then(function() {
    return kev.getAsync('key1')
  }).then(function(value) {
    assert.equal(value, 'value1')
  }).then(function () {
    return kev.delAsync('key1')
  }).then(function(old) {
    assert.equal(old, 'value1')
  }).then(function () {
    return kev.getAsync('key1')
  }).then(function (value) {
    assert.equal(value, null)
  }).then(function () {
    var max = 2000
    var puts = []
    for (var i = 1; i <= max; i++) {
      puts.push(kev.putAsync(String(i), i))
    }
    return Promise.all(puts)
  }).then(function () {
    var max = 2000
    var keys = []
    for (var i = 1; i <= max; i++) keys.push(String(i))
    return kev.getAsync(keys)
  }).then(function (values) {
    assert.equal(values['100'], 100)
    assert.equal(values['2000'], 2000)
    return kev.dropAsync('2*')
  }).then(function (keys) {
    assert.equal(112, keys)
    return kev.getAsync('221')
  }).then(function (val) {
    assert.equal(val, null)
    return kev.getAsync('199')
  }).then(function (val) {
    assert.equal(val, 199)
    console.log('CORE PASSED')
  })
}