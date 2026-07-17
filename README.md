# FraudShield AI

Real-Time AI Fraud Scoring Engine for UPI Transactions ("Stripe Radar for UPI").

Designed to evaluate transactions in real-time (< 200ms p99 SLA) using a hybrid machine learning and rules engine.

---

## Technical Stack
- **Backend:** FastAPI (Python 3.13), SQLAlchemy, PostgreSQL 15, Redis 7
- **ML Subsystem:** LightGBM, scikit-learn (Isolation Forest), SHAP (TreeExplainer)
- **Graph Subsystem:** NetworkX (in-memory graph database representation)
- **Dashboard:** React Native Expo (configured for Web target)

---

## Setup & Running

### Prerequisites
1. **Python 3.13** installed via Homebrew.
2. **Docker Desktop** installed and running.

### 1. Start Databases
Start PostgreSQL 15 and Redis 7 containers:
```bash
make infra
```

### 2. Initialize Dependencies
Install all package requirements in a virtual environment:
```bash
python3.13 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
```

### 3. Initialize and Seed Databases
Setup Postgres tables, rules, and seed the demo dataset:
```bash
PYTHONPATH=backend venv/bin/python -m app.db.init_db
PYTHONPATH=backend venv/bin/python -m app.db.seed_demo
```

### 4. Train ML Models
Generate synthetic transactions and train LGBM + Isolation Forest:
```bash
make train
```
*Outputs are saved to `backend/app/ml_models/`.*

### 5. Start Backend Server
Run the FastAPI application:
```bash
make dev
```
*Server is live at `http://localhost:8000`. API docs available at `http://localhost:8000/docs`.*

### 6. Start Dashboard (Expo Web)
Run the React Native dashboard in your web browser:
```bash
cd mobile
npm install
npm run web
```
*Expo Web client will open at `http://localhost:19006` or similar.*

---

## Integration Tests
Verify end-to-end scoring, rules, and health checks:
```bash
# Install pytest requirements
venv/bin/pip install pytest pytest-asyncio
# Run test suite
make test
```
