var only = require('only')

var KevMemory = module.exports = function KevMemory(options) {
  if (!(this instanceof KevMemory)) return new KevMemory(options)
  this.storage = {}
}

KevMemory.prototype.get = function(key, done) {
  if (Array.isArray(key)) {
    done(null, only(this.storage, key.join(' ')) || null)
  } else {
    done(null, this.storage[key] || null)
  }
}

KevMemory.prototype.put = function(key, value, done) {
  var old = this.storage[key] || null
  this.storage[key] = value
  if (done) done(null, old)
}

KevMemory.prototype.del = function(key, done) {
  var old = this.storage[key] || null
  delete this.storage[key]
  if (done) done(null, old)
}

KevMemory.prototype.close = function(done) {
  delete this.storage
  if (done) done(null)
}
