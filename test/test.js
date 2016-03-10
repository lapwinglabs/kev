var Promise = require('bluebird')
var KevMemory = require('../kev').Memory
var test_core = require('./test-plugin-core')
var test_ttl = require('./test-ttl')

Promise.resolve()
  .then(() => test_core(KevMemory()))
  .then(() => test_ttl(KevMemory({ ttl: 5 })))
