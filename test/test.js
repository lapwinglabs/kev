var Kev = require('../kev.js')
var KevMemory = Kev.Memory
var KevMongo = Kev.Mongo
var KevRedis = Kev.Redis
var assert = require('assert')

var kevmem = Kev({ store: KevMemory() });
var kevmongo = Kev({ store: KevMongo( { url: process.env.MONGO_URL } ) })
var kevredis = Kev({ store: KevRedis( { port: process.env.REDIS_PORT } ) })

var kevs = [kevmem, kevmongo, kevredis]

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
