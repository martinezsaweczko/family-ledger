# Hearth: common commands. Run `make help` to list them.
COMPOSE ?= $(shell command -v podman >/dev/null 2>&1 && echo "podman compose" || echo "docker compose")
IMAGE   ?= hearth
CONTAINER_CLI ?= $(shell command -v podman >/dev/null 2>&1 && echo podman || echo docker)

.DEFAULT_GOAL := help
.PHONY: help install db db-stop db-reset run dev build preview test unit e2e lint format check ci image clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install npm dependencies and the Playwright browser
	npm ci
	npx playwright install chromium

db: ## Start the local MySQL (waits until healthy)
	$(COMPOSE) up -d --wait db

db-stop: ## Stop the local MySQL (data is kept)
	$(COMPOSE) stop db

db-reset: ## DELETE all local database data and start fresh
	$(COMPOSE) down -v
	$(MAKE) db

run: db ## Start MySQL and the dev server (http://localhost:5173)
	npm run dev -- --open

dev: run

build: ## Production build
	npm run build

preview: db build ## Build and serve the production build locally
	npm run preview

test: db ## Run all tests (unit + e2e)
	npm run test:unit -- --run
	npx playwright test

unit: db ## Run unit/integration tests only
	npm run test:unit -- --run

e2e: db ## Run Playwright end-to-end tests only
	npx playwright test

lint: ## Prettier + ESLint
	npm run lint

format: ## Auto-format the code
	npm run format

check: ## Type-check (svelte-check)
	npm run check

ci: lint check test build ## Everything CI runs, locally

image: ## Build the container image
	$(CONTAINER_CLI) build -t $(IMAGE) .

clean: ## Remove build output and test artifacts
	rm -rf build .svelte-kit test-results playwright-report
