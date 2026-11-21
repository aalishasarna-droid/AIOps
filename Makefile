# Makefile — Secure AIOps Platform
# All targets run in Docker. Never install Python on the host.

.DEFAULT_GOAL := help

# ──────────────────── Core ──────────────────────────────────────────────

.PHONY: build up down reset logs

build: ## Build all Docker images
	docker compose build

up: ## Start core services
	docker compose up -d

down: ## Stop all services
	docker compose down

reset: ## Stop, remove volumes, and rebuild
	docker compose down -v
	docker compose build
	docker compose up -d

logs: ## Tail logs from all services
	docker compose logs -f

# ──────────────────── Profiles ──────────────────────────────────────────

.PHONY: up-ai up-chaos up-edge-ai up-regions

up-ai: ## Start AI services (aiops-core, aiops-ml, explain)
	docker compose --profile ai up -d

up-chaos: ## Start chaos testing (toxiproxy)
	docker compose --profile chaos up -d

up-edge-ai: ## Start edge AI (ollama)
	docker compose --profile edge-ai up -d

up-regions: ## Start multi-region simulated ingest nodes (eu-central-1 on port 8001)
	docker compose --profile regions up -d

# ──────────────────── Dependencies ──────────────────────────────────────

.PHONY: lock

lock: ## Regenerate hash-locked requirements.txt files inside containers
	@echo "Locking collector dependencies..."
	docker run --rm -v $(PWD)/collector:/work -w /work python:3.12-slim \
		sh -c "pip install pip-tools && pip-compile --generate-hashes requirements.in -o requirements.txt"
	@echo "Locking SaaS dependencies..."
	docker run --rm -v $(PWD)/saas:/work -w /work python:3.12-slim \
		sh -c "pip install pip-tools && pip-compile --generate-hashes requirements.in -o requirements.txt"

# ──────────────────── Testing ───────────────────────────────────────────

.PHONY: test leak-test

test: ## Run all tests in Docker
	docker compose --profile test run --rm tests python -m pytest tests/ -v

leak-test: ## Run canary secret leak test
	docker compose --profile test run --rm tests python -m pytest tests/leak/ -v

# ──────────────────── Shells ────────────────────────────────────────────

.PHONY: shell-collector shell-ingest shell-simulator

shell-collector: ## Shell into the collector container
	docker compose exec collector /bin/bash || docker compose run --rm collector /bin/bash

shell-ingest: ## Shell into the ingest-api container
	docker compose exec ingest-api /bin/bash || docker compose run --rm ingest-api /bin/bash

shell-simulator: ## Shell into the simulator container
	docker compose exec simulator /bin/bash || docker compose run --rm simulator /bin/bash

inspect-db: ## Inspect the local collector SQLite database (raw store & outbox)
	docker compose exec collector python -m collector.inspect_db

shell-db: ## Open interactive SQLite shell in the collector database
	docker compose exec -it collector python -m sqlite3 /app/data/collector.db

# ──────────────────── Demo ──────────────────────────────────────────────

.PHONY: demo demo-reset

demo: ## Run demo scenario
	@echo "Starting demo with db_outage_cascade scenario..."
	SIMULATOR_SCENARIO=db_outage_cascade docker compose up -d

demo-reset: ## Reset to clean state for demo
	docker compose down -v
	docker compose build
	@echo "Ready for demo. Run 'make demo' to start."

# ──────────────────── Help ──────────────────────────────────────────────

.PHONY: help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
