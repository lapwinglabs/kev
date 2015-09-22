test:
		@LOG=test* ./node_modules/.bin/prok \
		--env test/env.test \
		--procfile test/Procfile.test \
		--root .

install:
	@npm install

.PHONY: test
