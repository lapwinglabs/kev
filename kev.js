var KevMemory = require('./plugins/memory.js')
var KevMongo = require('./plugins/mongo.js')
var KevRedis = require('./plugins/redis.js')

var Kev = module.exports = function Kev(options) {
  if (!(this instanceof Kev)) return new Kev(options)

  if (!options.store) this.store = KevMemory()
  else this.store = options.store
}

Kev.prototype.get = function get (keys, options, done) {
  var single = typeof keys === 'string'
  if (typeof options === 'function') {
    done = options
    options = {}
  }
  options = options || {}
  this.store.get(single ? [keys] : keys, options, (e, v) => done(e, single && v ? v[keys] : v))
  return this
}

Kev.prototype.put = Kev.prototype.set = function put (key, value, options, done) {
  var keys = {}, single = typeof key === 'string'
  if (single) {
    keys[key] = value
    single = true
  } else if (Array.isArray(key)) {
    keys = key.reduce((p, c) => { p[c] = value; return p }, {})
  } else if (typeof key === 'object') {
    keys = key
    done = options
    options = value
  }
  if (typeof options === 'function') { done = options; options = {} }
  this.store.put(keys, options || {}, (e, v) => done && done(e, single && v ? v[key] : v))
  return this
}

Kev.prototype.del = function del (key, done) {
  var single = typeof key === 'string'
  this.store.del(single ? [key] : key, (e, v) => done(e, single && v ? v[key] : v))
  return this
}

Kev.prototype.drop = function drop (pattern, done) {
  if (typeof pattern === 'function') {
    done = pattern
    pattern = '*'
  }
  this.store.drop(pattern, done)
  return this
}

Kev.prototype.tag = function tag (key, tag, done) {
  var single = typeof tag === 'string'
  this.store.tag(key, single ? [tag] : tag, done)
  return this
}

Kev.prototype.tags = function tags (key, done) {
  var single = typeof key === 'string'
  this.store.tags(single ? [key] : key, (e, v) => done && done(e, single && v ? v[key] : v))
  return this
}

Kev.prototype.dropTag = function tag (tag, done) {
  var single = typeof tag === 'string'
  this.store.dropTag(single ? [tag] : tag, done)
  return this
}

Kev.prototype.close = function close(done) {
  this.store.close(done)
  return this
}

Kev.Memory = KevMemory
Kev.Mongo = KevMongo
Kev.Redis = KevRedis
