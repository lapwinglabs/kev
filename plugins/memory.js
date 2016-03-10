var only = require('only')
var globber = require('glob-to-regexp')
var assign = require('object-assign')

var KevMemory = module.exports = function KevMemory(options) {
  if (!(this instanceof KevMemory)) return new KevMemory(options)
  this.options = options
  this.storage = {}
}

KevMemory.prototype.get = function(keys, done) {
  setImmediate(() => done(null, only(this.storage, keys.join(' ')) || null))
}

KevMemory.prototype.put = function(keys, options, done) {
  var options = assign({}, this.options, options)
  var old = only(this.storage, Object.keys(keys).join(' '))
  assign(this.storage, keys)
  if (options.ttl) {
    var ttl = options.ttl * 1000
    Object.keys(keys).map((k) => setTimeout(() => delete this.storage[k], ttl))
  }
  if (done) setImmediate(() => done(null, old))
}

KevMemory.prototype.del = function(keys, done) {
  var old = only(this.storage, keys.join(' '))
  keys.map((k) => (delete this.storage[k]))
  if (done) setImmediate(() => done(null, old))
}

KevMemory.prototype.drop = function (pattern, done) {
  var keys = Object.keys(this.storage)
    .filter((k) => k.match(globber(pattern)))
  keys.forEach((k) => delete this.storage[k])
  if (done) setImmediate(() => done(null, keys.length))
}

KevMemory.prototype.close = function(done) {
  delete this.storage
  if (done) setImmediate(() => done(null))
}
