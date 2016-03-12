var Promise = require('bluebird')
var Kev = require('../../kev')
var KevMongo = Kev.Mongo
var assert = require('assert')
var mongoose = require('mongoose')
mongoose.Promise = require('bluebird')

var test_core = require('../common/test-plugin-core')
var test_ttl = require('../common/test-ttl')

var MongoClient = Promise.promisifyAll(require('mongodb').MongoClient)

Promise.resolve()
  .then(() => MongoClient.connectAsync(process.env.MONGO_URL + '/kev-test2'))
  .then((db) => {
    // Verify it accepts an existing mongo connection
    var core = KevMongo({ db: db })
    var ttl = KevMongo({ db: db, ttl: '5 sec' })
    return test_core(core).then(() => test_ttl(ttl))
  })
  .then(() => {
    // Verify it can handle more than one open mongo connection
    var store = KevMongo({
      db: mongoose
        .connect(process.env.MONGO_URL)
        .then(() => mongoose.connection.db)
        .tap(() => console.log('DB CONSTRUCTOR PASSED'))
    })
    return test_core(store).tap(() => console.log('MULTI CONNECTION PASSED'))
  })
  .then(() => {
    // Verify it accepts urls
    var store = KevMongo({ url: process.env.MONGO_URL + '/kev-test', ttl: 5 })
    return test_core(store).tap(() => console.log('URL CONSTRUCTOR PASSED'))
  })
  .then(() => {
    // Verify url pooling
    var mongo1 = KevMongo({ url: process.env.MONGO_URL + '/kev-test', ttl: 5 })
    var mongo2 = KevMongo({ url: process.env.MONGO_URL + '/kev-test', ttl: 5 })
    return mongo1.db.then(() => mongo2.db)
      .delay(6000)
      .then(() => {
        assert.equal(mongo1.db, mongo2.db)
        mongo1.close(() => mongo2.close())
        console.log('CONNECTION SHARING PASSED')
      })
  })
  .then(() => {
    // Verify compression
    var store = KevMongo({
      url: process.env.MONGO_URL + '/kev-compressed',
      ttl: 5,
      compress: true
    })
    return test_core(store).then(() => console.log('COMPRESSION PASSED'))
  })
  .then(() => {
    // verify raw retrieval support
    var raw = Promise.promisifyAll(Kev({ store: KevMongo({
      url: process.env.MONGO_URL + '/kev-compressed',
      ttl: 5,
      compress: true
    })}))
    return raw.putAsync('tagged', 'hello world')
      .then(() => raw.getAsync('tagged'))
      .then((value) => assert.equal(value, 'hello world'))
      .then(() => raw.getAsync('tagged', { compress: { raw: true } }))
      .then((value) => assert.equal(value, 'eJxTykjNyclXKM8vyklRAgAgRQSh'))
      .then(() => raw.dropAsync('*'))
      .then(() => raw.closeAsync())
      .then(() => console.log('RAW RETRIEVAL PASSED'))
  })
  .then(() => {
    // verify gzip compression support
    var gzip = Promise.promisifyAll(Kev({ store: KevMongo({
      url: process.env.MONGO_URL + '/kev-compressed',
      ttl: 5,
      compress: { type: 'gzip' }
    })}))
    return gzip.putAsync('tagged', 'hello world')
      .then(() => gzip.getAsync('tagged'))
      .then((value) => assert.equal(value, 'hello world'))
      .then(() => gzip.getAsync('tagged', { compress: { raw: true } }))
      .then((value) => assert.equal(value, 'H4sIAAAAAAAAA1PKSM3JyVcozy/KSVECAITtPj0NAAAA'))
      .then(() => gzip.dropAsync('*'))
      .then(() => gzip.closeAsync())
      .then(() => console.log('GZIP PASSED'))
  })
  .then(() => {
    // verify resurrect support with compression
    var resurrectZip = Promise.promisifyAll(Kev({
      store: KevMongo({
        url: process.env.MONGO_URL + '/kev-test',
        compress: { type: 'gzip' },
        restoreTypes: { resurrect: true }
      })
    }))
    return resurrectZip.putAsync('date', new Date(Date.now()))
      .then(() => resurrectZip.getAsync('date'))
      .then((value) => assert.ok(value instanceof Date))
      .then(() => resurrectZip.putAsync('regex', /xyz/))
      .then(() => resurrectZip.getAsync('regex'))
      .then((value) => assert.ok(value instanceof RegExp))
      .then(() => resurrectZip.dropAsync('*'))
      .then(() => resurrectZip.closeAsync())
      .then(() => console.log('COMPRESSED RESURRECT PASSED'))
  })
  .then(() => {
    // verify resurrect support without compression
    var resurrect = Promise.promisifyAll(Kev({
      store: KevMongo({
        url: process.env.MONGO_URL + '/kev-test',
        restoreTypes: { resurrect: true }
      })
    }))
    return resurrect.putAsync('date', new Date(Date.now()))
      .then(() => resurrect.getAsync('date'))
      .then((value) => assert.ok(value instanceof Date))
      .then(() => resurrect.putAsync('regex', /xyz/))
      .then(() => resurrect.getAsync('regex'))
      .then((value) => assert.ok(value instanceof RegExp))
      .then(() => resurrect.dropAsync('*'))
      .then(() => resurrect.closeAsync())
      .then(() => console.log('UNCOMPRESSED RESURRECT PASSED'))
  })
  .then(() => {
    // verify custom packing without compress
    var customPack = Promise.promisifyAll(Kev({
      store: KevMongo({
        url: process.env.MONGO_URL + '/kev-test',
        restoreTypes: { pack: (v) => 'stored', unpack: (v) => 'retrieved' }
      })
    }))
    return customPack.putAsync('data', { hi: 'there' })
      .then(() => customPack.store.storage)
      .then((db) => db.findOneAsync({}))
      .then((doc) => assert.equal(doc.value, 'stored'))
      .then(() => customPack.getAsync('data'))
      .then((val) => assert.equal(val, 'retrieved'))
      .then(() => customPack.dropAsync('*'))
      .then(() => customPack.closeAsync())
      .then(() => console.log('CUSTOM RESTORE PASSED'))
  })
  .then(() => {
    // verify underlying object storage without resurrect/compress
    var objStore = Promise.promisifyAll(Kev({
      store: KevMongo({
        url: process.env.MONGO_URL + '/kev-test',
      })
    }))
    return objStore.putAsync('obj', { hi: 'there' })
      .then(() => objStore.store.storage)
      .then((db) => db.findOneAsync({}))
      .then((doc) => assert.deepEqual(doc.value, { hi: 'there' }))
      .then(() => objStore.dropAsync('*'))
      .then(() => objStore.closeAsync())
      .then(() => console.log('DOCUMENT STORAGE PASSED'))
  })
