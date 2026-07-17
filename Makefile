.PHONY: dev seed test train infra down clean

# Start infrastructure (PostgreSQL + Redis)
infra:
	docker-compose up -d
	@echo "Waiting for services..."
	@sleep 3
	@echo "PostgreSQL and Redis are up."

# Stop infrastructure
down:
	docker-compose down

# Clean infrastructure (remove volumes)
clean:
	docker-compose down -v

# Install Python dependencies
install:
	cd backend && pip install -r requirements.txt

# Start backend dev server
dev:
	cd backend && ../venv/bin/python run.py

# Seed demo data
seed:
	cd backend && ../venv/bin/python -m app.db.seed_demo

# Train ML models
train:
	PYTHONPATH=. venv/bin/python -m ml.src.models.train

# Run tests
test:
	cd backend && ../venv/bin/python -m pytest tests/ -v


# Full setup: infra + install + seed + dev
setup: infra install seed
	@echo "FraudShield AI is ready. Run 'make dev' to start."
