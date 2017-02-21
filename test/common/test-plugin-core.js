'use strict'

var assert = require('assert')
var Promise = require('bluebird')
var Kev = require('../../kev')

module.exports = function (store, options) {
  var kev = Promise.promisifyAll(Kev({ store: store }))
  return kev.putAsync('key1', 'value1').then(function() {
    return kev.getAsync('key1')
  }).then((value) => {
    assert.equal(value, 'value1')
  }).then(() => {
    return kev.delAsync('key1')
  }).then((old) => {
    assert.equal(old, 'value1')
  }).then(() => {
    return kev.getAsync('key1')
  }).then((value) => {
    assert.equal(value, null)
  }).then(() => {
    return kev.putAsync({ group1: 'value1', group2: 'value2', 'group space': 'value3' })
  }).then(() => {
    return kev.getAsync(['group1', 'group2', 'group space'])
  }).then((values) => {
    assert.equal(values.group1, 'value1')
    assert.equal(values.group2, 'value2')
    assert.equal(values['group space'], 'value3')
  }).then(() => {
    return kev.delAsync([ 'group1', 'group2' ])
  }).then(() => {
    return kev.getAsync([ 'group1', 'group2' ])
  }).then((values) => {
    assert.equal(values.group1, null)
    assert.equal(values.group2, null)
  }).then(() => {
    var max = 2000
    var puts = []
    for (var i = 1; i <= max; i++) {
      puts.push(kev.putAsync(String(i), i))
    }
    return Promise.all(puts)
  }).then(() => {
    var max = 2000
    var keys = []
    for (var i = 1; i <= max; i++) keys.push(String(i))
    return kev.getAsync(keys)
  }).then((values) => {
    assert.equal(values['100'], 100)
    assert.equal(values['2000'], 2000)
    return kev.dropAsync('2*')
  }).then((keys) => {
    assert.equal(112, keys)
    return kev.getAsync('221')
  }).then((val) => {
    assert.equal(val, null)
    return kev.getAsync('199')
  }).then((val) => {
    assert.equal(val, 199)
  }).then(() => {
    return kev.tagAsync('100', 'hundred')
  }).then(() => {
    return kev.tagsAsync('100')
  }).then((tags) => {
    assert.deepEqual(tags, [ 'hundred' ])
  }).then(() => {
    return kev.tagAsync('300', 'hundred')
  }).then(() => {
    return kev.dropTagAsync('hundred')
  }).then((dropped) => {
    assert.equal(dropped, 2)
    return kev.getAsync(['100', '300'])
  }).then((values) => {
    assert.deepEqual(values, { '100': null, '300': null })
    return kev.dropAsync('*')
  }).then(() => {
    return kev.closeAsync()
  }).then(() => {
    console.log('CORE PASSED')
  })
}
