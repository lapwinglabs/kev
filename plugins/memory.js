var only = require('only')
var globber = require('glob-to-regexp')
var assign = require('object-assign')
var seconds = require('juration').parse

var KevMemory = module.exports = function KevMemory(options) {
  if (!(this instanceof KevMemory)) return new KevMemory(options)
  this.options = options
  this.storage = {}
  this.tagKeys = {}
  this.keyTags = {}
}

KevMemory.prototype.get = function(keys, options, done) {
  var out = only(this.storage, keys.join(' '))
  keys.forEach((key) => { if (!out[key]) out[key] = null })
  setImmediate(() => done(null, out))
}

KevMemory.prototype.put = function(keys, options, done) {
  var options = assign({}, this.options, options)
  var old = only(this.storage, Object.keys(keys).join(' '))
  assign(this.storage, keys)
  if (options.ttl) {
    var ttl = seconds(String(options.ttl))
    Object.keys(keys).map((k) => setTimeout(() => delete this.storage[k], ttl))
  }
  if (done) setImmediate(() => done(null, old))
}

KevMemory.prototype.del = function(keys, done) {
  var old = only(this.storage, keys.join(' '))
  keys.map((k) => this._delete(k))
  if (done) setImmediate(() => done(null, old))
}

KevMemory.prototype.drop = function (pattern, done) {
  var keys = Object.keys(this.storage)
    .filter((k) => k.match(globber(pattern)))
  keys.forEach((k) => this._delete(k))
  if (done) setImmediate(() => done(null, keys.length))
}

KevMemory.prototype.tag = function (key, tags, done) {
  this.keyTags[key] = this.keyTags[key] || []
  tags.forEach((tag) => {
    this.tagKeys[tag] = this.tagKeys[tag] || []
    !~this.tagKeys[tag].indexOf(key) && this.tagKeys[tag].push(key)
    !~this.keyTags[key].indexOf(tag) && this.keyTags[key].push(tag)
  })
  done && setImmediate(() => done())
}

KevMemory.prototype.tags = function (keys, done) {
  done && setImmediate(() => done(null, keys.reduce((o, k) => { o[k] = this.keyTags[k]; return o }, {})))
}

KevMemory.prototype.dropTag = function (tags, done) {
  var sum = tags.reduce((sum, tag) => {
    var keys = this.tagKeys[tag]
    var count = keys.length
    Array.prototype.concat(keys).forEach((k) => this._delete(k))
    return sum + count
  }, 0)
  done && setImmediate(() => done(null, sum))
}

KevMemory.prototype._delete = function (key) {
  var tags = this.keyTags[key]
  tags && tags.forEach((tag) => {
    this.tagKeys[tag].splice(this.tagKeys[tag].indexOf(key), 1)
    if (!this.tagKeys[tag].length) delete this.tagKeys[tag]
  })
  delete this.storage[key]
  delete this.keyTags[key]
}

KevMemory.prototype.close = function(done) {
  delete this.storage
  if (done) setImmediate(() => done(null))
}
