const Redis = require('ioredis')
const transform = require('stream-transform')

module.exports = class KevRedis {
  constructor (url, options = {}) {
    this.client = new Redis(url, options)
  }

  async get (keys = []) {
    const result = await this.client.mget(keys)
    return result.map((value) => {
      if (value === null) return
      return JSON.parse(value)
    })
  }

  async set (keyvalues = []) {
    const cmd = keyvalues.reduce((cmd, keyvalue) => {
      const { key, value, ttl, tags = [] } = keyvalue
      const expire = ttl ? [ 'px', ttl ] : []

      cmd = cmd.watch([ key, keyTagsKey(key) ])
        .multi()
        .get(key)
        .set(key, JSON.stringify(value), ...expire)
        .eval('redis.call("unlink", unpack(redis.call("smembers", KEYS[1])))', 1, keyTagsKey(key))
        .unlink(keyTagsKey(key))

      if (tags.length) {
        const tag_keys = tags.map(keyTagKey(key))
        cmd = tag_keys
          .reduce((cmd, tag_key) => cmd.set(tag_key, '1', ...expire), cmd)
          .sadd(keyTagsKey(key), tag_keys)
      }

      return cmd.exec()
    }, this.client.pipeline())

    const result = await cmd.exec()
    const output = result
      .filter(([ , result ]) => Array.isArray(result))
      .reduce((output, [ , result ]) => {
        output.push(result[0] ? JSON.parse(result[0]) : undefined)
        return output
      }, [])

    return output
  }

  async del (keys = []) {
    let cmd = this.client.multi().mget(keys)

    cmd = keys.reduce((cmd, key) => cmd.unlink(key), cmd)

    const script = 'redis.call("unlink", unpack(redis.call("smembers", KEYS[1])))'
    cmd = keys.reduce((cmd, key) => cmd.eval(script, 1, keyTagsKey(key)), cmd)

    cmd = cmd.unlink(keys.map(keyTagsKey))

    const result = await cmd.exec()

    const [ [ , values ], ...rest ] = result
    const deleted = rest.slice(0, keys.length)
    return deleted.map((count, i) => count ? JSON.parse(values[i]) : undefined)
  }

  async tags (keys = []) {
    const cmd = keys.reduce((cmd, key) => cmd.smembers(keyTagsKey(key)), this.client.pipeline())
    const result = await cmd.exec()
    return result.map(([ , members ]) => members
      .map((key) => key.replace(new RegExp(`^${TAG_KEY_PREFIX}:`), ''))
      .map((key) => key.split(':')[0])
      .map((key) => debase64(key)))
  }

  async dropKeys (globs = []) {
    const results = []
    const promises = []

    globs.forEach((glob, i) => {
      results[i] = 0
      const stream = this.keys(glob)
      stream.on('data', (key) => results[i]++)
      stream.on('data', (key) => promises.push(this.del([ key ])))
      promises.push(until(stream, 'end'))
    })

    await Promise.all(promises)

    return results
  }

  async dropTags (tags = []) {
    const results = []
    const promises = []

    tags.forEach((tag, i) => {
      results[i] = 0
      const stream = this.tagged(tag)
      stream.on('data', (key) => results[i]++)
      stream.on('data', (key) => promises.push(this.del([ key ])))
      promises.push(until(stream, 'end'))
    })

    await Promise.all(promises)

    return results
  }

  tagged (tag) {
    const prefix = `${tagKey(tag)}:`
    const stream = this.client.scanStream({ match: `${prefix}*` })
    return stream
      .pipe(transform((keys, done) => setImmediate(() => done(null, ...keys))))
      .pipe(transform((key) => key.replace(prefix, '')))
      .pipe(transform((key) => debase64(key)))
  }

  keys (glob) {
    const stream = this.client.scanStream({ match: glob })
    return stream
      .pipe(transform((keys, done) => setImmediate(() => done(null, ...keys))))
  }

  async close () {
    this.client.quit()
  }
}

const until = (emitter, event) => {
  return new Promise((resolve, reject) => {
    emitter.once(event, resolve)
  })
}

/**
 * In order to ensure that the tagsKey and all of its member tagKeys
 * are stored on the same node (which is required for the eval script
 * we use to achieve atomic sets/dels), we make use of hash tags. To
 * ensure unique hash slots per key, we escape any right curly brackets
 * that may be included in the key or tag itself.
 *
 * Read more here: https://redis.io/topics/cluster-spec
 */
const TAG_KEY_PREFIX = '__tagged__'
const KEY_TAGS_PREFIX = '__tags__'
const tagKey = (tag) => `${TAG_KEY_PREFIX}:${base64(tag)}`
const keyTagsKey = (key) => `${KEY_TAGS_PREFIX}:{${base64(key)}}`
const keyTagKey = (key) => (tag) => `${tagKey(tag)}:{${base64(key)}}`
const base64 = (str) => Buffer.from(str).toString('base64')
const debase64 = (str) => Buffer.from(str, 'base64').toString('utf8')
