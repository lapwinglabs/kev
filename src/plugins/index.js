const DataLoader = require('dataloader')

module.exports = (url = 'memory://', { loader, memory, mongo, redis }) => {
  if (url.startsWith('redis://')) {
    const Redis = require('./redis')
    return loaders(new Redis(url, redis), loader)
  }

  if (url.startsWith('mongodb://')) {
    const Mongo = require('./mongo')
    return loaders(new Mongo(url, mongo), loader)
  }

  if (url.startsWith('memory://')) {
    const Memory = require('./memory')
    return loaders(new Memory(url, memory), loader)
  }
}

// TODO: support dataloader caching on 'get'
const loaders = (plugin, options) => {
  return {
    get: new DataLoader(plugin.get.bind(plugin), { ...options, cache: false }),
    set: new DataLoader(plugin.set.bind(plugin), { ...options, cache: false }),
    del: new DataLoader(plugin.del.bind(plugin), { ...options, cache: false }),
    dropKeys: new DataLoader(plugin.dropKeys.bind(plugin), { ...options, cache: false }),
    dropTag: new DataLoader(plugin.dropTags.bind(plugin), { ...options, cache: false }),
    tags: new DataLoader(plugin.tags.bind(plugin), { ...options, cache: false }),
    keys: plugin.keys.bind(plugin),
    tagged: plugin.tagged.bind(plugin),
    close: plugin.close.bind(plugin)
  }
}
