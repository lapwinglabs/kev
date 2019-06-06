const zlib = require('zlib')

const ms = require('ms')
const transform = require('stream-transform')
const read = require('stream-to-array')
const Resurrect = require('resurrect-js')

const Plugin = require('./plugins')

module.exports = class Kev {
  constructor ({ url, ttl, prefix = [], tags = [], compression = false, packer, unpacker, ...plugin_opts } = {}) {
    this.store = Plugin(url, plugin_opts)
    this.ttl = ttl
    this.prefix = Array.isArray(prefix) ? prefix : [ prefix ]
    this.default_tags = tags
    this.compression = compression

    const resurrector = new Resurrect({ prefix: '__kev#', cleanup: true })
    this.packer = (packer || unpacker) ? packer : resurrector.stringify.bind(resurrector)
    this.unpacker = (packer || unpacker) ? unpacker : resurrector.resurrect.bind(resurrector)
  }

  withPrefix (prefix) {
    prefix = this.prefix.concat(prefix)
    const clone = new Kev({ prefix, tags: this.default_tags, ttl: this.ttl, compression: this.compresssion })
    clone.store = this.store
    return clone
  }

  // TODO: augment tags with parent prefixes as well
  withTags (tags) {
    tags = this.default_tags.concat(tags)
    const clone = new Kev({ tags, prefix: this.prefix, ttl: this.ttl, compression: this.compression })
    clone.store = this.store
    return clone
  }

  withTTL (ttl) {
    const clone = new Kev({ ttl, tags: this.default_tags, prefix: this.prefix, compression: this.compression })
    clone.store = this.store
    return clone
  }

  /** Get */

  async get (key, { decompress = true } = {}) {
    if (Array.isArray(key)) return this.getMany(key)

    key = this.prefixed(key)
    const result = await this.store.get.load(key)
    return this.unpack(result, { decompress })
  }

  async getMany (keys) {
    const values = await Promise.all(keys.map((k) => this.get(k)))
    return zip(keys, values)
  }

  /** Set */

  async set (key, value, { ttl, tags = [] } = {}) {
    if (typeof key === 'object') return this.setMany(key, value)

    key = this.prefixed(key)
    ttl = ms(String(ttl || this.ttl || 0))
    tags = prefixedTags(this.prefix, tags.concat(this.default_tags))
    value = await this.pack(value)

    const previous = await this.store.set.load({ key, value, ttl, tags })
    return this.unpack(previous)
  }

  async setMany (kvobj, { ttl, tags = [] } = {}) {
    const keys = Object.keys(kvobj)
    const values = await Promise.all(keys.map((key) => this.set(key, kvobj[key], { ttl, tags })))
    return zip(keys, values)
  }

  /** Del */

  async del (key) {
    if (Array.isArray(key)) return this.delMany(key)

    key = this.prefixed(key)

    const previous = await this.store.del.load(key)
    return this.unpack(previous)
  }

  async delMany (keys) {
    const values = await Promise.all(keys.map((k) => this.del(k)))
    return zip(keys, values)
  }

  /** Tags */

  async tags (key) {
    if (Array.isArray(key)) {
      const tags = await Promise.all(key.map((k) => this.tags(k)))
      return zip(key, tags)
    }

    key = this.prefixed(key)
    const tags = await this.store.tags.load(key)
    return tags
      .filter((tag) => tag.startsWith(this.prefixed()))
      .map(this.deprefixed.bind(this))
  }

  /** Key Streams */

  keys (pattern = '*') {
    pattern = this.prefixed(pattern)
    const stream = this.store.keys(pattern)
      .pipe(transform(this.deprefixed.bind(this)))
    stream.toArray = () => read(stream)
    return stream
  }

  tagged (tag) {
    tag = this.prefixed(tag)
    const stream = this.store.tagged(tag)
      .pipe(transform(this.deprefixed.bind(this)))
    stream.toArray = () => read(stream)
    return stream
  }

  /** Drop Keys */

  async dropKeys (pattern = '*') {
    if (Array.isArray(pattern)) {
      const dropped = await Promise.all(pattern.map((p) => this.dropKeys(p)))
      return zip(pattern, dropped)
    }

    pattern = this.prefixed(pattern)
    return this.store.dropKeys.load(pattern)
  }

  /** Drop Tags */

  async dropTag (tag) {
    if (Array.isArray(tag)) return this.dropTags(tag)

    tag = this.prefixed(tag)
    return this.store.dropTag.load(tag)
  }

  async dropTags (tags) {
    const dropped = await Promise.all(tags.map((t) => this.dropTag(t)))
    return zip(tags, dropped)
  }

  async close () {
    return this.store.close()
  }

  prefixed (key = '') {
    return this.prefix.concat([ key ]).join(':')
  }

  deprefixed (key) {
    return key.replace(new RegExp(`^${this.prefixed()}`), '')
  }

  async pack (value) {
    value = this.packer(value)
    if (!this.compression) return value

    const fn = this.compression.type === 'gzip' ? 'gzip' : 'deflate'
    const encoding = this.compression.encoding || 'base64'
    return new Promise((resolve, reject) => {
      zlib[fn](value, this.compression, (err, buf) => {
        if (err) reject(err)
        else resolve(buf.toString(encoding))
      })
    })
  }

  async unpack (value, { decompress = true } = {}) {
    if (value === undefined) return value
    if (!this.compression) return this.unpacker(value)
    if (!decompress) return value

    const fn = this.compression.type === 'gzip' ? 'gunzip' : 'inflate'
    const encoding = this.compression.encoding || 'base64'
    return new Promise((resolve, reject) => {
      zlib[fn](Buffer.from(value, encoding), this.compression, (err, val) => {
        if (err) reject(err)
        else resolve(this.unpacker(val))
      })
    })
  }
}

const prefixedTags = (prefixes, tags) => {
  return prefixes.reduce((prefixed, prefix, i, prefixes) => {
    prefixed.push(...tags.map((tag) => prefixes.slice(0, i + 1).concat(tag).join(':')))
    return prefixed
  }, [])
}

const zip = (keys, values) => {
  return keys.reduce((zipped, key, i) => {
    zipped[key] = values[i]
    return zipped
  }, {})
}
