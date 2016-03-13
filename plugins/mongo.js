var Promise = require('bluebird')
var seconds = require('juration').parse
var zlib = require('zlib')
var globber = require('glob-to-regexp')
var assign = require('deep-assign')
var copy = require('deep-copy')
var Resurrector = require('../lib/resurrect')

var DEFAULT_MONGO_URL = 'mongodb://127.0.0.1:27017/kev'
var DEFAULT_COLLECTION = 'kev'

var ID_KEY = "key"
var TAGS_KEY = "tags"
var DATA_FIELD_KEY = "value"
var TTL_KEY = "expiresAt"

var connections = {}
var dbs = []
var clients = []
var expired = (r) => r && r[TTL_KEY] && r[TTL_KEY] < new Date(Date.now())

var KevMongo = module.exports = function KevMongo (options) {
  if (!(this instanceof KevMongo)) return new KevMongo(options)

  var mongodb = require('mongodb')
  var MongoClient = mongodb.MongoClient
  Promise.promisifyAll(mongodb.Collection.prototype)
  Promise.promisifyAll(mongodb.Db.prototype)
  Promise.promisifyAll(mongodb.Cursor.prototype)
  Promise.promisifyAll(MongoClient)

  options = options || {}
  this.collection = options.collection || DEFAULT_COLLECTION
  if (options.ttl) options.ttl = seconds(String(options.ttl))

  if (options.db) {
    this.db = Promise.resolve()
      .then(() => options.db)
      .then((db) => {
        if (!db.createCollectionAsync) return Promise.promisifyAll(db)
        else return db
      })
  } else {
    var url = options.url || DEFAULT_MONGO_URL
    if (!connections[url]) {
      connections[url] = MongoClient.connectAsync(url, options.options || {})
    }
    this.db = connections[url]
    this.url = url
  }

  this.options = options
  var restore = options.restoreTypes || {}
  if (restore.pack && restore.unpack) {
    this.options.restore = restore
  } else if (restore.resurrect) {
    var resurrect = new Resurrector(restore.resurrect)
    this.options.restore = { pack: resurrect.stringify.bind(resurrect), unpack: resurrect.resurrect.bind(resurrect) }
  } else {
    this.options.restore = { pack: (v) => v, unpack: (v) => v }
  }

  this.storage = this.db.then((db) => {
    this.db = db
    return db.createCollectionAsync(this.collection)
      .catch((err) => {
        if (~err.message.indexOf('collection already exists')) return db.collectionAsync(this.collection)
        else throw err
      })
      .then((collection) => {
        if (!~dbs.indexOf(db)) {
          clients[dbs.length] = []
          dbs.push(db)
        }
        clients[dbs.indexOf(db)].push(collection)
        return collection
      })
  }).then((collection) => {
    if (!collection.createIndexAsync) collection = Promise.promisifyAll(collection)
    collection.createIndex({ [ID_KEY]: 1 }, { background: true })
    collection.createIndex({ [TAGS_KEY]: 1 })
    collection.createIndex({ [TTL_KEY]: 1 }, { background: true, expireAfterSeconds: 0 })
    return collection
  })
}

KevMongo.prototype.get = function get (keys, options, done) {
  var compress = merge_opt(options.compress, this.options.compress)
  var restore = merge_opt(options.restore, this.options.restore)
  this.storage.then((db) => db.findAsync({ [ID_KEY]: { $in: keys } }))
    .then((r) => Promise.fromCallback(r.toArray.bind(r)))
    .filter((v) => !expired(v))
    .reduce((out, v) => { out[v[ID_KEY]] = unpack(compress, restore)(v[DATA_FIELD_KEY]); return out }, {})
    .props()
    .tap((out) => { keys.forEach((k) => { out[k] = out[k] || null }) })
    .then((out) => done && done(null, out))
    .catch((err) => done && done(err))
}

KevMongo.prototype.put = function put (keys, options, done) {
  var compress = merge_opt(options.compress, this.options.compress)
  var restore = merge_opt(options.restore, this.options.restore)
  var ttl = options.ttl || options.ttl === 0 ? seconds(String(options.ttl)) : this.options.ttl
  this.storage.then((db) => {
    for (key in keys) {
      var query = { [ID_KEY]: key }
      var update = { [ID_KEY]: key }
      if (ttl) update[TTL_KEY] = new Date(Date.now() + ttl * 1000)
      keys[key] = pack(compress, restore)(keys[key])
        .then((v) => update[DATA_FIELD_KEY] = v)
        .then(() => db.findOneAndReplaceAsync(query, update, { upsert: true }))
        .then((r) => (r && r.value && !expired(r.value)) ? r.value[DATA_FIELD_KEY] : null)
        .then(unpack(compress, restore))
    }
    return Promise.props(keys)
      .then((v) => done && done(null, v))
      .catch((e) => done && done(e))
  })
}

KevMongo.prototype.del = function del (keys, done) {
  this.storage.then((db) => {
    return Promise.resolve(keys)
      .reduce((out, key) => {
        out[key] = db.findOneAndDeleteAsync({ [ID_KEY]: key })
          .then((r) => (r && r.value) ? r.value[DATA_FIELD_KEY] : null)
          .then(unpack(this.options.compress, this.options.restore))
        return out
      }, {})
      .props()
      .then((v) => done && done(null, v))
      .catch((e) => done && done(e))
  })
}

KevMongo.prototype.drop = function drop (pattern, done) {
  var re = globber(pattern)
  this.storage
    .then((db) => db.deleteManyAsync({ [ID_KEY]: { $regex: re } }))
    .then((r) => done && done(null, r.deletedCount))
    .catch((e) => done && done(e))
}

KevMongo.prototype.tag = function tag (key, tags, done) {
  var update = { $addToSet: { [TAGS_KEY]: { $each: tags } } }
  this.storage.then((db) => db.findOneAndUpdateAsync({ [ID_KEY]: key }, update))
    .then((r) => done && done())
    .catch((e) => done && done(e))
}

KevMongo.prototype.tags = function tags (keys, done) {
  this.storage.then((db) => db.findAsync({ [ID_KEY]: { $in: keys } }, { [TAGS_KEY]: 1, [ID_KEY]: 1, [TTL_KEY]: 1 }))
    .then((r) => Promise.fromCallback(r.toArray.bind(r)))
    .filter((v) => !expired(v))
    .reduce((out, v) => { out[v[ID_KEY]] = v[TAGS_KEY]; return out }, {})
    .then((out) => done && done(null, out))
    .catch((err) => done && done(err))
}

KevMongo.prototype.dropTag = function dropTag (tags, done) {
  this.storage
    .then((db) => db.deleteManyAsync({ [TAGS_KEY]: { $elemMatch: { $in: tags } } }))
    .then((r) => done && done(null, r.deletedCount))
    .catch((e) => done && done(e))
}

KevMongo.prototype.close = function (done) {
  this.storage.then((collection) => {
    var db = this.db
    var db_clients = clients[dbs.indexOf(db)]
    db_clients.splice(db_clients.indexOf(collection), 1)
    if (db_clients.length === 0) {
      var index = dbs.indexOf(db)
      dbs.splice(index, 1)
      clients.splice(index, 1)
      this.url && delete connections[this.url]
      db.close(done)
    } else {
      done && done()
    }
  })
}

function pack (compress, restore) {
  return Promise.promisify((value, done) => {
    if (!value) return setImmediate(() => done(null, null))

    var data = restore.pack(value)
    if (!compress) return setImmediate(() => done(null, data))

    var fn = compress.type === 'gzip' ? 'gzip' : 'deflate'
    var encoding = compress.encoding || 'base64'
    zlib[fn](JSON.stringify(data), compress, (err, buf) => {
      if (err) done(err)
      else done(null, buf.toString(encoding))
    })
  })
}

function unpack (compress, restore) {
  return Promise.promisify((value, done) => {
    if (!value) return setImmediate(() => done(null, null))
    if (!compress) return setImmediate(() => done(null, restore.unpack(value)))
    if (compress.raw) return setImmediate(() => done(null, value))
    var fn = compress.type === 'gzip' ? 'gunzip' : 'inflate'
    var encoding = compress.encoding || 'base64'
    zlib[fn](new Buffer(value, encoding), compress, (err, val) => {
      if (err) done(err)
      else done(null, restore.unpack(JSON.parse(val.toString())))
    })
  })
}

function merge_opt (target, source) {
  if (target === false) return false
  if (!target) return source
  if (!source || source === true) return target
  return assign({}, copy(target), copy(source))
}
