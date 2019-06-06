const stream = require('into-stream')
const globber = require('glob-to-regexp')

const storage = {}
const tagged_keys = {}

module.exports = class KevMemory {
  constructor (url, options) {
    storage[url] = storage[url] || {}
    tagged_keys[url] = tagged_keys[url] || {}
    this.storage = storage[url]
    this.tagged_keys = tagged_keys[url]
  }

  async get (keys = []) {
    const now = Date.now()
    return keys
      .map((key) => this.storage[key])
      .map(({ value, expires } = {}) => {
        if (!expires || expires >= now) return value
      })
  }

  async set (keyvalues = []) {
    const now = Date.now()
    return keyvalues.map(({ key, value, ttl, tags = [] }) => {
      const original = this.storage[key] && this.storage[key].value

      this.del([ key ])
      const stored = this.storage[key] = { value, tags }

      tags.forEach((tag) => {
        this.tagged_keys[tag] = this.tagged_keys[tag] || new Set()
        this.tagged_keys[tag].add(key)
      })

      if (ttl) {
        stored.expires = now + ttl
        stored.timeout = setTimeout(() => this.del([ key ]), ttl)
        stored.timeout.unref()
      }

      return original
    })
  }

  async del (keys = []) {
    const now = Date.now()
    return keys.map((key) => {
      const stored = this.storage[key]
      if (!stored) return

      const { value, expires, timeout, tags } = stored
      timeout && clearTimeout(timeout)
      tags.forEach((tag) => {
        this.tagged_keys[tag].delete(key)
        if (!this.tagged_keys[tag].size) {
          delete this.tagged_keys[tag]
        }
      })
      delete this.storage[key]
      return expires && expires < now ? undefined : value
    })
  }

  async tags (keys = []) {
    const now = Date.now()
    return keys.map((key) => {
      const stored = this.storage[key]
      if (!stored) return []

      const { tags = [], expires } = stored
      if (expires < now) return []

      return tags
    })
  }

  async dropKeys (patterns = []) {
    return Promise.all(patterns
      .map((p) => globber(p))
      .map((regexp) => Object.keys(this.storage).filter((key) => key.match(regexp)))
      .map((deletes) => this.del(deletes).then((deleted) => deleted.length)))
  }

  async dropTags (tags = []) {
    return Promise.all(tags
      .map((tag) => [ ...this.tagged_keys[tag] ])
      .map((deletes) => this.del(deletes).then((deleted) => deleted.length)))
  }

  tagged (tag) {
    const matches = this.tagged_keys[tag] || []
    return stream.object(matches)
  }

  keys (pattern) {
    const matches = Object.keys(this.storage).filter((k) => k.match(globber(pattern)))
    return stream.object(matches)
  }

  async close () {}
}
