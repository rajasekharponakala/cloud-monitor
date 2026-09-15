.PHONY: dev build start collect lint clean

dev: ## Next.js dashboard dev server (API on same origin)
	cd dashboard && npm run dev

build: ## production build of dashboard
	cd dashboard && npm run build

start: ## production server (set PORT, default 3000)
	cd dashboard && npm run start

collect: ## run collectors once (needs config.toml + optional CRON_SECRET)
	curl -s -X POST http://127.0.0.1:3000/api/collect \
	  $([ -n "$$CRON_SECRET" ] && echo "-H \"Authorization: Bearer $$CRON_SECRET\"")

lint: ## frontend lint
	cd dashboard && npm run lint

clean:
	rm -f *.db cloud-monitor.db
	rm -rf dashboard/.next
