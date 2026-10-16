.PHONY: help start dev stop install test check build package-ext

.DEFAULT_GOAL := dev

FRONTEND_PORT ?= 5173
BACKEND_PORT  ?= 8000

UV := $(shell command -v uv 2>/dev/null)
ifneq ($(UV),)
	API_RUN = uv run --with-requirements api/requirements.txt
	PYTEST_RUN = PYTHONPATH=api uv run --with-requirements api/requirements.txt --with pytest pytest api/tests -q
else ifneq ($(wildcard .venv/bin/python),)
	API_RUN = .venv/bin/python -m
	PYTEST_RUN = PYTHONPATH=api .venv/bin/python -m pytest api/tests -q
else
	API_RUN = python3 -m
	PYTEST_RUN = PYTHONPATH=api python3 -m pytest api/tests -q
endif

help: ## Show available commands
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

dev start: ## Start full-stack app (Frontend :5173 + FastAPI :8000)
	@test -d node_modules || npm install
	@npx concurrently -k -n FRONTEND,BACKEND -c cyan,green \
		"npx vite --host 0.0.0.0 --port $(FRONTEND_PORT)" \
		"$(API_RUN) uvicorn main:app --reload --host 0.0.0.0 --port $(BACKEND_PORT) --app-dir api"

stop: ## Stop running local dev servers on ports 5173 and 8000
	@fuser -k $(FRONTEND_PORT)/tcp $(BACKEND_PORT)/tcp 2>/dev/null || true
	@echo "Stopped local servers on :$(FRONTEND_PORT) and :$(BACKEND_PORT)."

install: ## Install frontend and backend dependencies
	npm install
ifneq ($(UV),)
	uv pip install --system -r api/requirements.txt 2>/dev/null || true
else
	python3 -m pip install -r api/requirements.txt
endif

test: ## Run backend (pytest) and frontend/extension (vitest) suites
	$(PYTEST_RUN)
	npm test -- --run

check: ## Run lint, type-check, and full test suite
	npm run lint
	npm run type-check
	$(MAKE) test

build: ## Build production frontend bundle
	npm run build

package-ext: ## Package MV3 browser extension into knowbear-extension.zip
	rm -f knowbear-extension.zip
	cd extension && zip -r -q ../knowbear-extension.zip . -x "tests/*" "tests" "*.DS_Store"
	@echo "Created knowbear-extension.zip"
