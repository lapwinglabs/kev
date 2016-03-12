var Promise = require('bluebird')
var assert = require('assert')
var Kev = require('../../kev')
var KevMemory = Kev.Memory
var test_core = require('../common/test-plugin-core')
var test_ttl = require('../common/test-ttl')

Promise.promisifyAll(Kev.prototype)
Promise.resolve()
  .then(() => test_core(KevMemory()))
  .then(() => test_ttl(KevMemory({ ttl: 5 })))
  .then(() => test_tag_cleanup(KevMemory()))

function test_tag_cleanup (store) {
  var kev = Kev({ store: store })
  return kev.putAsync('val1', 'tagged')
    .then(() => kev.tagAsync('val1', 'tag'))
    .then(() => kev.tagAsync('val1', 'tag2'))
    .then(() => {
      assert.deepEqual(['val1'], store.tagKeys['tag'])
      assert.deepEqual(['val1'], store.tagKeys['tag2'])
      assert.deepEqual(['tag', 'tag2'], store.keyTags['val1'])
    })
    .then(() => kev.dropTagAsync('tag'))
    .then(() => {
      assert.equal(undefined, store.tagKeys['tag'])
      assert.equal(undefined, store.tagKeys['tag2'])
      assert.equal(undefined, store.keyTags['val1'])
      console.log('TAG CLEANUP PASSED')
    })
}
