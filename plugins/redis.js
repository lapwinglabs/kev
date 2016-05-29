var Promise = require('bluebird')
var seconds = require('juration').parse
var Resurrector = require('../lib/resurrect')
var zlib = require('zlib')
var assign = require('deep-assign')
var copy = require('deep-copy')

var KevRedis = module.exports = function KevRedis (options) {
  if (!(this instanceof KevRedis)) return new KevRedis(options)

  var Redis = require('redis')
  Promise.promisifyAll(Redis.RedisClient.prototype)
  Promise.promisifyAll(Redis.Multi.prototype)

  options = options || {}
  options.port = options.port || 6379
  options.host = options.host || '127.0.0.1'
  options.compress = options.compress || false
  var client = Redis.createClient(options.port, options.host)

  if (options.ttl) options.ttl = seconds(String(options.ttl))
  if (options.prefix) options.prefix = options.prefix + ':'
  else options.prefix = 'kev:'
  this.options = options

  var restore = options.restoreTypes || {}
  if (restore.pack && restore.unpack) {
    this.options.restore = restore
  } else if (restore.resurrect) {
    var resurrect = new Resurrector(restore.resurrect)
    this.options.restore = { pack: resurrect.stringify.bind(resurrect), unpack: resurrect.resurrect.bind(resurrect) }
  } else if (this.options.compress) {
    this.options.restore = { pack: (v) => v, unpack: (v) => v }
  } else {
    this.options.restore = { pack: JSON.stringify, unpack: JSON.parse }
  }

  this.pendingOps = []
  client.on('connect', () => {
    this.storage = client;
    for (var index in this.pendingOps) {
      this.pendingOps[index]()
    }
  })
}

KevRedis.prototype.get = function (keys, options, done) {
  if (!this.storage) return this.pendingOps.push(this.get.bind(this, keys, options, done))
  var compress = merge_opt(options.compress, this.options.compress)
  var restore = merge_opt(options.restore, this.options.restore)
  var prefixed = keys.map((k) => this.options.prefix + k)
  this.storage.mgetAsync(prefixed)
    .reduce((out, v, idx) => {
      out[keys[idx]] = unpack(compress, restore)(v)
      return out
    }, {})
    .props()
    .then((out) => done && done(null, out))
    .catch((err) => done && done(err))
}

KevRedis.prototype.put = function (keys, options, done) {
  if (!this.storage) return this.pendingOps.push(this.put.bind(this, keys, options, done))
  var compress = merge_opt(options.compress, this.options.compress)
  var restore = merge_opt(options.restore, this.options.restore)
  var storage = this.storage
  var ttl = options.ttl || options.ttl === 0 ? seconds(String(options.ttl)) : this.options.ttl
  for (var key in keys) {
    var prefixed = this.options.prefix + key
    keys[key] = put(prefixed, keys[key])
  }

  function put (key, value) {
    return pack(compress, restore)(value)
      .then((v) => storage.getsetAsync(key, v))
      .tap((v) => ttl && storage.expire(key, ttl))
      .then(unpack(compress, restore))
  }

  Promise.props(keys)
    .then((v) => done && done(null, v))
    .catch((err) => done && done(err))
}

KevRedis.prototype.del = function (keys, done) {
  if (!this.storage) return this.pendingOps.push(this.del.bind(this, keys, done))
  var prefixed = keys.map((k) => this.options.prefix + k)

  var try_del = (key) => {
    this.storage.watch(key)
    return this.storage.getAsync(key).then((old) => {
      return this._delete(key, this.storage.multi())
        .then((op) => op.execAsync())
        .then((replies) => {
          if (!replies) return Promise.delay(100).then(() => try_del(key))
          else return unpack(this.options.compress, this.options.restore)(old)
        })
    })
  }

  Promise.resolve(prefixed)
    .mapSeries(try_del)
    .reduce((p, c, i) => { p[keys[i]] = c; return p }, {})
    .then((v) => done && done(null, v))
    .catch((e) => done && done(e))
}

KevRedis.prototype.drop = function (pattern, done) {
  if (!this.storage) return this.pendingOps.push(this.drop.bind(this, pattern, done))
  pattern = this.options.prefix + pattern

  var try_drop_key = (key) => {
    return this._delete(key, this.storage.multi())
      .then((op) => op.execAsync())
      .then((replies) => {
        if (!replies) return Promise.delay(100).then(() => try_drop_key(key))
        else return replies[0]
      })
  }

  this.storage.keysAsync(pattern).mapSeries(try_drop_key)
    .reduce((count, deleted) => count + deleted, 0)
    .then((count) => done && done(null, count))
    .catch((e) => done && done(e))
}

KevRedis.prototype.tag = function (key, tags, done) {
  if (!this.storage) return this.pendingOps.push(this.tag.bind(this, key, tags, done))

  var keyTags = this.options.prefix + '_keyTags:' + key
  key = this.options.prefix + key

  var try_tag = (key, tags) => {
    var op = this.storage.multi()
    return Promise.resolve(tags)
      .reduce((op, tag) => {
        var tagKeys = this.options.prefix + '_tagKeys:' + tag
        return op.sadd(keyTags, tag).sadd(tagKeys, key)
      }, this.storage.multi())
      .then((op) => op.execAsync())
      .then((replies) => {
        if (!replies) return Promise.delay(100).then(() => try_tag(key, tags))
      })
  }

  try_tag(key, tags)
    .then(() => done && done())
    .catch((e) => done && done(e))
}

KevRedis.prototype.tags = function (keys, done) {
  if (!this.storage) return this.pendingOps.push(this.tags.bind(this, keys, done))

  Promise.resolve(keys)
    .map((key) => {
      return Promise.props({ key: key, tags: this.storage.smembersAsync(this.options.prefix + '_keyTags:' + key) })
    })
    .reduce((out, entry) => { out[entry.key] = entry.tags; return out }, {})
    .then((tags) => done && done(null, tags))
    .catch((e) => done && done(e))
}

KevRedis.prototype.dropTag = function (tags, done) {
  if (!this.storage) return this.pendingOps.push(this.dropTag.bind(this, tags, done))

  var try_drop_tag = (tag) => {
    var tagKeys = this.options.prefix + '_tagKeys:' + tag
    this.storage.watch(tagKeys)

    var dropped_keys = []
    return this.storage.smembersAsync(tagKeys).reduce((op, key) => {
        if (!~dropped_keys.indexOf(key)) dropped_keys.push(key)
        return this._delete(key, op)
      }, this.storage.multi().del(tagKeys))
      .then((op) => op.execAsync())
      .then((replies) => {
        if (!replies) return Promise.delay(100).then(() => try_drop_tag(tag))
        else return dropped_keys
      })
      .catch((err) => { console.error('KEV REDIS: Error dropping tag', tag, ':', err); throw err })
  }

  Promise.resolve(tags).reduce((count, tag) => try_drop_tag(tag), 0)
    .then((keys) => done && done(null, keys.length))
    .catch((e) => done && done(null, err))
}

KevRedis.prototype._delete = function (key, op) {
  var keyTags = this.options.prefix + '_keyTags:' + key.slice(this.options.prefix.length)
  this.storage.watch(keyTags)
  op = op.del(key).del(keyTags)
  return this.storage.smembersAsync(keyTags).reduce((op, otherTag) => {
    var tagKeys = this.options.prefix + '_tagKeys:' + otherTag
    return op.srem(tagKeys, key)
  }, op)
}

KevRedis.prototype.close = function (done) {
  if (!this.storage) return this.pendingOps.push(this.close.bind(this, done))
  if (!this.storage.connected) { return process.nextTick(done) }
  this.storage.once('end', done || function() {})
  this.storage.quit()
}

function pack (compress, restore) {
  return Promise.promisify((value, done) => {
    if (!value) return setImmediate(() => done(null, null))
    if (!compress) {
      setImmediate(() => done(null, restore.pack(value)))
    } else {
      var fn = compress.type === 'gzip' ? 'gzip' : 'deflate'
      var encoding = compress.encoding || 'base64'
      zlib[fn](JSON.stringify(restore.pack(value)), compress, (err, buf) => {
        if (err) done(err)
        else done(null, buf.toString(encoding))
      })
    }
  })
}

function unpack (compress, restore) {
  return Promise.promisify((value, done) => {
    if (!value) return setImmediate(() => done(null, null))
    if (!compress) {
      setImmediate(() => done(null, restore.unpack(value)))
    } else {
      if (compress.raw) return setImmediate(() => done(null, value))
      var fn = compress.type === 'gzip' ? 'gunzip' : 'inflate'
      var encoding = compress.encoding || 'base64'
      zlib[fn](new Buffer(value, encoding), compress, (err, val) => {
        if (err) done(err)
        else done(null, restore.unpack(JSON.parse(val.toString())))
      })
    }
  })
}

function merge_opt (target, source) {
  if (target === false) return false
  if (!target) return source
  if (!source || source === true) return target
  return assign({}, copy(target), copy(source))
}
