.DEFAULT_GOAL := help
.PHONY: help setup precommit format format-check lint test dev build new
help: ## Show available commands
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "%-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
setup: ## Install dependencies and the pre-commit hook
	bun install
	@mkdir -p .git/hooks; printf '%s\n' '#!/bin/sh' 'exec make precommit' > .git/hooks/pre-commit; chmod +x .git/hooks/pre-commit
precommit: format-check lint test ## Run fast commit checks
format: ## Format supported files
	bun run format
format-check: ## Check formatting
	bun run format:check
lint: ## Lint and type-check
	bun run lint
test: ## Run tests and content integrity validation
	bun run test
dev: ## Start the development server
	bun run dev
build: ## Build and validate static output
	bun run build
new: ## Create a content record with the interactive guide
	bun run new-content
