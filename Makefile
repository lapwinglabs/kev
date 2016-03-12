test: test-memory test-mongo test-redis

test-memory:
		@LOG=*test* ./node_modules/.bin/prok \
		--env test/env.test \
		--procfile test/memory/Procfile.memory \
		--root .

test-mongo:
		@LOG=*test* ./node_modules/.bin/prok \
		--env test/env.test \
		--procfile test/mongo/Procfile.mongo \
		--root .

test-redis:
		@LOG=*test* ./node_modules/.bin/prok \
		--env test/env.test \
		--procfile test/redis/Procfile.redis \
		--root .

install:
	@npm install

.PHONY: test test-memory test-mongo test-redis
