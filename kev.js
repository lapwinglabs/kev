var KevMemory = require('./plugins/memory.js')

var Kev = module.exports = function Kev(options) {
  if (!(this instanceof Kev)) return new Kev(options)

  if (!options.store) this.store = KevMemory()
  else this.store = options.store
}

Kev.prototype.get = function get(key, done) {
  this.store.get(key, done)
  return this
}

Kev.prototype.put = function put(key, value, done) {
  this.store.put(key, value, done)
  return this
}

Kev.prototype.del = function del(key, done) {
  this.store.del(key, done)
  return this
}

Kev.prototype.close = function close(done) {
  this.store.close(done)
  return this
}

Kev.Memory = KevMemory
