var Kev = require('../kev.js')
var KevMemory = Kev.Memory
var assert = require('assert')

var kevmem = Kev({ store: KevMemory() });

var kevs = [kevmem]

kevs.forEach(function(kev) {
  kev.put('key1', 'value1', function(err) {
    kev.get('key1', function(err, value) {
      assert.equal(value, 'value1')
      kev.del('key1', function(err, old) {
        assert.equal(old, 'value1')
        kev.get('key1', function(err, value) {
          assert.equal(value, null)
          kev.close()
          console.log('Pass!')
        })
      })
    })
  })
})
