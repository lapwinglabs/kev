# Kev
Plugin-based universal key-value storage API.

## This is the story of Kev.
Kev started building his first Node application recently. He decided to use LevelDB for some basic key-value storage. Some 10k SLOC later, new requirements were added that required distributed connections to this persistent storage, and Kev decided Redis was probably now a better storage solution. No big deal. Search and replace to the rescue, right? Tell that to Murphy and his law, who apparently teamed up with a handful of third-party LevelDB dependencies and Kev's embarrassing lack of engineering discipline to make this a much larger refactoring effort than it should have been. "Oh well," Kev says to himself after carefully building some better abstractions and replacing all of the LevelDB API references in his project with their Redis counterparts, "at least I won't have to do that again."

Spoken like a true idiot, Kev.

**Two weeks later,** Kev's server starts running out of memory. After a not-so-quick foray into the Heap Profiling House of Horrors, Kev discovers that his simple key-value store has grown much larger than he had originally anticipated (5GB), and Redis was keeping this all in memory.

 *Thud.*

Kev's not a Silicon Valley billionaire. He can't afford to just throw more RAM at his problems.

 *Thud.*

He needs out-of-memory persistence and is going to have to change his key-value APIs. Again.

 *Thud.*

Like a metronome counting off 10,000 brain cells per minute, Kev bangs his head against the wall. Poor, heartbroken Kev, exhausted by the mere thought of learning yet another API to do the exact *.thud.* same *.thud.* simple *.thud.* task he was doing before: connect to a data source, then push and pull values by id. Kev's not the brightest fellow, but even he knows it shouldn't be this much work.

But Kev's pity party is short-lived. "Fool me twice...," he mutters under his breath, accepting responsibility for the path of shortsightedness that led him to this cleverly disguised opportunity. He's finally acknowledged the possibility (nay, probability) that he will need to swap his backend again at some point. Even if he doesn't, he shouldn't be relying on a particular storage engine if he wants to reuse any of these components in a different project. So his fingers hit the keys and like tiny little boxers punch out three simple functions:

```async get(key)```

```async set(key, value[, { tags, ttl }])```

```async del(key)```

So far so good. Kev writes a basic in-memory adapter and sets up the simplest conceivable test as a sanity check. It passes! Convinced he is on to something, Kev hastily refactors his project to use this new API and gives it a spin.

```var settings = Kev()```

His console explodes in a flurry of incomprehensible stack traces. A brief moment of panic ensues before Kev realizes that his application is simply expecting data that still lives in Redis. He whips up an adapter and with a single-line change reconnects his project to its old storage backend.

```var settings = Kev({ url: process.env.REDIS_URL })```

It works! Kev's hands clench into fists and fly above his head in a celebratory spasm just awkward enough to expose a man whose encounters with success must be infrequent at best. But there is no time for victory dances; the moment of truth has arrived. Kev still needs out-of-memory persistence and already has a remote mongo store setup that he can use. He quickly pulls together a MongoDB adapter and writes a simple script (using his new API) to populate his new instance with the data from Redis. One more single-line change and Kev's project is using MongoDB instead of Redis.

```var settings = Kev({ url: process.env.MONGO_URL })```

Kev is ecstatic. Where against a wall a head once beat in despair, a heart now beats in excitement. The skies have opened up and Kev has seen the light. Never again will his time be wasted on meaningless refactoring efforts. Never again will his settings, his caches, his packages, his *life* be bound to a particular persistence layer. He is free, and so are we.

You see, I am Kev. You are Kev. We are all Kev, living in fear of trading speed for tight coupling and leaky abstractions. Because the struggle is real, the struggle is constant. And in this battle we sometimes point the barrel at our own damn feet and pull the trigger. But [blood alone moves the wheels of history](https://www.youtube.com/watch?v=Y-1ieZPoG3I), and we cannot forget that it is a *privilege* to fight. **We must never give up! We must never acquiesce!** We must rise to be worthy of this historic hour and unite as one because it is together...**TOGETHER THAT WE WILL PREVAIL!**


## Epilogue
There is, of course, still work to do. Kev plans to implement the following features as the need arises:
 - [x] Prefixed namespaces
 - [x] Atomic operations
 - [x] Update batching
 - [x] Glob-matching keys
 - [x] Key streams
 - [x] At-rest compression
 - [ ] LevelDB adapter

## Getting Kev
```npm install kev```
