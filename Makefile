test: node_modules_test
		@LOG=test* ./node_modules/.bin/prok \
		--env test/env.test \
		--procfile test/Procfile.test \
		--root .

node_modules_test: package.json
	@npm install --dev
	@touch node_modules

.PHONY: test
