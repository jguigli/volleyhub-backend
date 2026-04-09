.PHONY: help dev prod build stop restart logs logs-backend logs-postgres logs-redis \
        shell-backend shell-postgres seed ps clean fclean re

# ─── Colors ───────────────────────────────────────────────────────────────────
CYAN  := \033[36m
RESET := \033[0m
BOLD  := \033[1m

help: ## Show this help
	@echo ""
	@echo "  $(BOLD)VolleyHub Backend$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-18s$(RESET) %s\n", $$1, $$2}'
	@echo ""

# ─── Dev / Prod ───────────────────────────────────────────────────────────────

dev: ## Start all services (build + detached)
	docker compose up --build -d

prod: ## Start all services in production mode
	docker compose up --build -d

build: ## Rebuild all images
	docker compose build --no-cache

stop: ## Stop all services
	docker compose down

restart: ## Restart all services
	docker compose down && docker compose up --build -d

# ─── Logs ─────────────────────────────────────────────────────────────────────

logs: ## Follow logs of all services
	docker compose logs -f

logs-backend: ## Follow backend logs
	docker compose logs -f backend

logs-postgres: ## Follow postgres logs
	docker compose logs -f postgres

logs-redis: ## Follow redis logs
	docker compose logs -f redis

# ─── Shells ───────────────────────────────────────────────────────────────────

shell-backend: ## Open a shell in the backend container
	docker compose exec backend sh

shell-postgres: ## Open a psql shell in the postgres container
	docker compose exec postgres psql -U $${POSTGRES_USER:-volley} -d $${POSTGRES_DB:-volleyhub}

shell-redis: ## Open a redis-cli shell in the redis container
	docker compose exec redis redis-cli

# ─── Database ─────────────────────────────────────────────────────────────────

seed: ## Run the court seed script
	docker compose exec backend npm run seed

# ─── Status ───────────────────────────────────────────────────────────────────

ps: ## Show running containers
	docker compose ps

# ─── Cleanup ──────────────────────────────────────────────────────────────────

clean: ## Stop and remove containers (keep volumes)
	docker compose down --remove-orphans

fclean: ## Stop and remove containers + volumes (⚠ deletes all data)
	docker compose down --remove-orphans --volumes

re: fclean dev ## Full reset and restart
