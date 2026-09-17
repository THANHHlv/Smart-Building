.PHONY: help up down build logs test migrate seed lint format clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------

up: ## Start all services
	docker compose -f deployment/docker/docker-compose.yml up -d

up-dev: ## Start all services with dev overrides (hot reload)
	docker compose -f deployment/docker/docker-compose.yml -f deployment/docker/docker-compose.dev.yml up -d

down: ## Stop all services
	docker compose -f deployment/docker/docker-compose.yml down

down-v: ## Stop all services and remove volumes
	docker compose -f deployment/docker/docker-compose.yml down -v

build: ## Build all Docker images
	docker compose -f deployment/docker/docker-compose.yml build

logs: ## Tail logs from all services
	docker compose -f deployment/docker/docker-compose.yml logs -f

logs-backend: ## Tail backend logs
	docker compose -f deployment/docker/docker-compose.yml logs -f backend

ps: ## Show running services
	docker compose -f deployment/docker/docker-compose.yml ps

# ---------------------------------------------------------------------------
# Backend
# ---------------------------------------------------------------------------

test: ## Run backend tests
	cd backend && python -m pytest tests/ -v

test-cov: ## Run backend tests with coverage
	cd backend && python -m pytest tests/ --cov=app --cov-report=term-missing

lint: ## Lint backend code
	cd backend && python -m ruff check app/ tests/

format: ## Format backend code
	cd backend && python -m ruff format app/ tests/

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

migrate: ## Run Alembic migrations (upgrade to head)
	cd backend && alembic upgrade head

migrate-down: ## Rollback last migration
	cd backend && alembic downgrade -1

migrate-new: ## Create new migration (usage: make migrate-new MSG="add users table")
	cd backend && alembic revision --autogenerate -m "$(MSG)"

seed: ## Seed database with rich demo data
	cd backend && python scripts/seed_demo_data.py

frontend-dev: ## Start React frontend dev server
	cd frontend && npm run dev

frontend-build: ## Build React frontend
	cd frontend && npm run build

simulate: ## Run IoT telemetry simulator CLI (e.g. 5 cycles, 2s interval)
	cd backend && python scripts/iot_simulator.py 5 2

# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

clean: ## Remove build artifacts and caches
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
