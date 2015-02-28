var redis = require('redis')

var KevRedis = module.exports = function KevRedis(options) {
  if (!(this instanceof KevRedis)) return new KevRedis(options)

  options = options || {}
  options.port = options.port || 6379
  options.host = options.host || '127.0.0.1'
  var client = redis.createClient(options.port, options.host, options)

  this.pendingOps = []
  var self = this
  client.on('connect', function() {
    self.storage = client;
    for (var index in self.pendingOps) {
      self.pendingOps[index]()
    }
  })
}

KevRedis.prototype.get = function(key, done) {
  if (!this.storage) return this.pendingOps.push(this.get.bind(this, key, done))

  this.storage.get(key, function(err, result) {
    done(err, unpack(result))
  })
}

KevRedis.prototype.put = function(key, value, done) {
  if (!this.storage) return this.pendingOps.push(this.put.bind(this, key, value, done))

  this.storage.getset(key, pack(value), function(err, result) {
    if (done) done(err, unpack(result))
  })
}

KevRedis.prototype.del = function(key, done) {
  if (!this.storage) return this.pendingOps.push(this.del.bind(this, key, done))

  var store = this.storage;
  this.get(key, function(err, value) {
    if (err) return done(err)

    store.del(key, function(err) {
      if (err) return done(err)

      done(null, value)
    })
  })
}

KevRedis.prototype.close = function(done) {
  if (!this.storage) return this.pendingOps.push(this.close.bind(this, done))

  if (!this.storage.connected) { return process.nextTick(done) }

  this.storage.once('end', done || function() {})
  this.storage.quit()
}

function pack(value) { return JSON.stringify(value) }
function unpack(value) { return JSON.parse(value) }
