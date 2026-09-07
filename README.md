# Smart Building Cloud Platform

> A production-like smart building platform for real-time IoT monitoring and infrastructure operations.

## Overview

This platform demonstrates enterprise-grade backend engineering with:

- **FastAPI** backend with async PostgreSQL
- **PostgreSQL** with streaming replication and automated backup/recovery
- **Kafka**-based event streaming for IoT sensor data
- **AI anomaly detection** (Isolation Forest) for energy/water consumption
- **Docker** & **Kubernetes** deployment
- **Terraform** & **Ansible** infrastructure automation
- **Prometheus**, **Grafana**, **Loki** observability stack

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Python 3.12+ (for local development)

### Run with Docker Compose

```bash
# Start all services
make up

# View logs
make logs

# Stop
make down
```

### Local Development

```bash
# Create virtual environment
cd backend
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
.venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements-dev.txt

# Run tests
python -m pytest tests/ -v

# Start the server
uvicorn app.main:app --reload
```

### API Documentation

Once running, visit:

- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- Health: [http://localhost:8000/health](http://localhost:8000/health)

## Architecture

```text
IoT Simulator → Kafka → Consumer → PostgreSQL
                                        ↑
                                   FastAPI API ← React UI
                                        ↓
                                    AI Service
```

See [docs/architecture.md](docs/architecture.md) for full details.

## Project Structure

```text
├── backend/          # FastAPI application
├── simulator/        # IoT data simulator
├── ai-service/       # Anomaly detection
├── deployment/       # Docker & Kubernetes
├── infrastructure/   # Terraform & Ansible
├── monitoring/       # Prometheus, Grafana, Loki
├── scripts/          # Utility scripts
└── docs/             # Documentation
```

## Development Status

- [x] Phase 0 — Repository & FastAPI skeleton
- [x] Phase 1 — Database design & migrations
- [x] Phase 2 — REST API (CRUD + Dashboard)
- [ ] Phase 3 — IoT Simulator
- [ ] Phase 4 — Kafka integration
- [ ] Phase 5 — AI anomaly detection
- [ ] Phase 6 — Monitoring stack
- [ ] Phase 7 — PostgreSQL HA
- [ ] Phase 8 — Backup & Recovery
- [ ] Phase 9 — Docker (full stack)
- [ ] Phase 10 — Kubernetes
- [ ] Phase 11 — Terraform
- [ ] Phase 12 — Ansible
- [ ] Phase 13 — CI/CD
- [ ] Phase 14 — Chaos Engineering

## License

Private project — for portfolio demonstration purposes.
