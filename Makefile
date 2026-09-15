.PHONY: collect api dev build test lint clean

collect: ## one-shot collection using config.toml
	python3 -m monitor.scheduler

loop: ## continuous collection
	python3 -m monitor.scheduler --loop

api: ## JSON API + fallback UI on :4000
	python3 -m monitor.server

dev: ## Next.js dashboard dev server
	cd dashboard && npm run dev

build: ## production build of dashboard
	cd dashboard && npm run build

test: ## backend unit tests (no network)
	python3 -m pytest -q

lint: ## backend compile check + frontend lint
	python3 -m py_compile monitor/*.py
	cd dashboard && npm run lint

clean:
	rm -f *.db
	rm -rf dashboard/.next
