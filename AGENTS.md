# AGENTS.md

## 1. Project Identity

Project: **Smart Building Cloud Platform**

Purpose:

Build a production-like smart-building platform demonstrating:

- Backend engineering with FastAPI
- Database engineering with PostgreSQL
- Event-driven architecture with Kafka
- Cloud infrastructure
- DevOps automation
- Kubernetes
- Infrastructure as Code
- Observability
- Backup and disaster recovery
- AI-assisted anomaly detection

Primary engineering goal:

> Build a reliable, observable, scalable and recoverable system rather than merely demonstrating many technologies.

The AI agent must prioritize correctness, maintainability, reliability and security over speed of implementation.

---

# 2. Core Technology Stack

Use the following stack unless the user explicitly requests a change.

## Backend

- Python 3.12+
- FastAPI
- Pydantic v2
- SQLAlchemy 2.x
- Alembic
- Uvicorn
- pytest

## Database

- PostgreSQL 16+
- PgBouncer where connection pooling is required
- pgBackRest for backup/recovery

## Messaging

- Apache Kafka

## Cache

- Redis

## AI

- Python
- NumPy
- pandas
- scikit-learn
- Isolation Forest or another explainable anomaly-detection approach

## Containers

- Docker
- Docker Compose

## Orchestration

- Kubernetes
- Helm

## Infrastructure

- Terraform
- Ansible

## Observability

- Prometheus
- Grafana
- Loki
- Promtail
- Alertmanager

## Object Storage

- MinIO for local development
- S3-compatible storage for cloud deployment

## CI/CD

- GitHub Actions

---

# 3. General Agent Rules

## 3.1 Understand Before Editing

Before modifying code:

1. Inspect the repository structure.
2. Read relevant existing files.
3. Identify dependencies between components.
4. Understand the existing architecture.
5. Reuse existing abstractions when appropriate.
6. Avoid unnecessary rewrites.

Never modify a file merely because another implementation appears cleaner.

Preserve existing behavior unless the requested change intentionally changes it.

---

## 3.2 Minimal Changes

Prefer the smallest change that correctly solves the problem.

Do NOT:

- Rewrite unrelated modules.
- Rename large numbers of files without necessity.
- Replace working technologies without permission.
- Introduce unnecessary abstractions.
- Introduce unnecessary design patterns.
- Add dependencies for trivial functionality.

Every new dependency must have a clear technical reason.

---

## 3.3 No Technology Creep

Do not introduce additional technologies simply to make the project look more advanced.

For example, do not add:

- Elasticsearch
- Cassandra
- MongoDB
- RabbitMQ
- Spark
- Flink
- Airflow
- Istio
- ArgoCD
- LangChain
- LLM frameworks

unless there is a concrete requirement and the user explicitly approves the architectural change.

Kafka is the default event broker.

PostgreSQL is the primary database.

FastAPI is the primary backend framework.

---

# 4. Architecture Rules

Target architecture:

```text
                    React / Web UI
                          |
                          v
                    FastAPI Backend
                          |
             +------------+------------+
             |            |            |
             v            v            v
          Device       Alert        User
          Service      Service      Service
             |
             |
IoT Simulator -> Kafka -> Consumers
                          |
                    +-----+-----+
                    |           |
                    v           v
               PostgreSQL     AI Service
                    |
              +-----+------+
              |            |
           Primary       Replica
              |
              v
         pgBackRest
              |
              v
         MinIO / S3

Observability:

Application
    |
    +--> Prometheus
    +--> Loki
    |
    +--> Grafana
    |
    +--> Alertmanager
```

Keep responsibilities separated.

---

# 5. Backend Rules

## 5.1 FastAPI

FastAPI is the main backend framework.

Application structure should generally follow:

```text
backend/
└── app/
    ├── main.py
    ├── api/
    │   └── v1/
    ├── core/
    ├── models/
    ├── schemas/
    ├── services/
    └── repositories/
```

Responsibilities:

### `api/`

HTTP routing and request/response handling.

### `schemas/`

Pydantic request and response models.

### `services/`

Business logic.

### `repositories/`

Database access logic where repository abstraction is useful.

### `models/`

SQLAlchemy database models.

### `core/`

Configuration, database initialization, security and common infrastructure.

Do not put large business logic blocks directly inside route functions.

Bad:

```python
@router.post("/readings")
async def create_reading(...):
    # 100 lines of business logic
```

Prefer:

```python
@router.post("/readings")
async def create_reading(...):
    return await reading_service.create(...)
```

---

# 6. API Rules

API versioning:

```text
/api/v1/...
```

Examples:

```text
GET    /api/v1/apartments
POST   /api/v1/apartments
GET    /api/v1/apartments/{id}

GET    /api/v1/devices
POST   /api/v1/devices

POST   /api/v1/readings
GET    /api/v1/readings

GET    /api/v1/dashboard/overview

GET    /health
GET    /ready
```

Rules:

- Validate all external input.
- Use Pydantic schemas.
- Return appropriate HTTP status codes.
- Do not expose database exceptions directly to clients.
- Use consistent error responses.
- Avoid returning internal stack traces.
- Use pagination for potentially large datasets.
- Use filtering and time ranges for sensor data.
- Never load an unbounded sensor history into memory.

---

# 7. Database Rules

PostgreSQL is the source of truth for persistent relational data.

## 7.1 Schema

Core entities:

```text
buildings
floors
apartments
device_types
devices
sensor_readings
energy_consumption
water_consumption
alerts
maintenance_events
system_events
users
```

Maintain proper:

- Primary keys
- Foreign keys
- Unique constraints
- Check constraints
- NOT NULL constraints
- Indexes

Do not use application code to enforce a rule that should clearly be enforced by the database.

---

## 7.2 Migrations

All schema changes must use Alembic.

Never manually modify production schema without a migration.

Migration workflow:

```text
Change SQLAlchemy model
        |
        v
Create Alembic migration
        |
        v
Review migration
        |
        v
Run migration
        |
        v
Test upgrade/downgrade when practical
```

Never delete or rewrite an already-applied migration just to make the migration history look cleaner.

---

## 7.3 Indexing

Sensor data is time-series-like and must be indexed appropriately.

Example:

```text
sensor_readings(device_id, timestamp)
```

Potential indexes:

```text
devices(apartment_id)
sensor_readings(device_id, timestamp)
energy_consumption(apartment_id, timestamp)
alerts(created_at)
```

Do not add indexes blindly.

Every significant index should have a query/use-case justification.

---

## 7.4 Query Performance

Before optimizing:

1. Identify the slow query.
2. Inspect the query plan.
3. Determine the bottleneck.
4. Make the smallest appropriate change.
5. Benchmark again.

Use:

```sql
EXPLAIN
EXPLAIN ANALYZE
```

Do not claim a query is optimized without evidence when performance is part of the requirement.

---

# 8. Database Reliability

The project must demonstrate database reliability.

Target architecture:

```text
                 Application
                      |
                   PgBouncer
                      |
                 HAProxy
                 /       \
                /         \
          PostgreSQL     PostgreSQL
            Primary        Replica
                |
                |
               WAL
                |
                v
             Replica
```

Agent must understand the distinction between:

- Backup
- Replication
- High availability
- Disaster recovery

Replication is NOT a backup.

---

# 9. Backup Rules

Use pgBackRest.

Required concepts:

```text
Full Backup
Incremental Backup
WAL Archive
Retention
Restore
Point-in-Time Recovery
```

The agent must never claim backup works merely because a backup command completed.

A restore verification test should be performed.

Preferred workflow:

```text
Backup
  |
  v
Restore to isolated environment
  |
  v
Verify expected data
  |
  v
Record recovery result
```

Document:

```text
RPO
RTO
Backup frequency
Retention policy
Recovery procedure
```

---

# 10. Kafka Rules

Kafka is the event-streaming layer.

Recommended topics:

```text
sensor.readings
device.events
alerts
system.events
```

Do not use Kafka simply because it is available.

Use it for asynchronous/event-driven workloads.

Preferred flow:

```text
IoT Simulator
      |
      v
Kafka
      |
      v
Consumer
      |
      v
PostgreSQL
```

The FastAPI API should not become the bottleneck for high-volume sensor ingestion.

Consider:

- Consumer groups
- Partitioning
- Consumer lag
- Retry behavior
- Idempotency
- Dead-letter handling where appropriate

Sensor ingestion should be designed to tolerate duplicate events.

---

# 11. IoT Simulator Rules

The simulator is a first-class component.

It should generate realistic data rather than pure random numbers.

Generate:

- Electricity
- Temperature
- Humidity
- Water consumption
- Device status

Data should include:

```text
Normal behavior
Daily patterns
Random noise
Sudden spikes
Missing readings
Device offline events
Outliers
```

Example:

```text
Normal:
1.2
1.4
1.3
1.5

Anomaly:
12.8
13.4
11.9
```

The simulator must support configurable:

```text
number of apartments
number of devices
event interval
anomaly probability
```

Do not hard-code all values.

---

# 12. AI Rules

AI is a supporting component, not the central purpose of the project.

Primary AI use case:

> Detect abnormal energy/water/sensor behavior.

Preferred first model:

```text
Isolation Forest
```

Pipeline:

```text
Historical data
      |
      v
Feature engineering
      |
      v
Train model
      |
      v
Save model
      |
      v
Real-time data
      |
      v
Inference
      |
      v
Anomaly score
      |
      v
Alert
```

The AI service must:

- Have a clear input schema.
- Have a clear output schema.
- Log inference failures.
- Avoid blocking the main API unnecessarily.
- Store model versions.
- Record enough information to reproduce predictions.

Do not use an LLM for numerical anomaly detection when a deterministic/statistical/ML method is sufficient.

LLM integration is optional and should only be used for incident summarization or natural-language assistance.

---

# 13. Observability Rules

Observability is mandatory.

Three pillars:

```text
Metrics
Logs
Traces
```

Initial implementation:

```text
Prometheus → Metrics
Loki       → Logs
Grafana    → Visualization
Alertmanager → Alerts
```

The application should expose metrics such as:

```text
HTTP request count
HTTP request latency
HTTP error count
Database connection usage
Kafka consumer lag
IoT events processed
AI anomalies detected
```

---

# 14. Logging Rules

Use structured logging where practical.

Every important log should provide enough context:

```text
timestamp
level
service
event
request_id
device_id
user_id where appropriate
```

Never log:

- Passwords
- API keys
- Access tokens
- Database credentials
- Secrets
- Sensitive personal information

Do not use `print()` for production application logging.

---

# 15. Health Checks

Every deployable service should have appropriate health checks.

At minimum:

```text
/health
/ready
```

Distinguish:

```text
Liveness
Readiness
```

Example:

```text
Liveness:
Process is alive.

Readiness:
Service can accept traffic and required dependencies are available.
```

Do not make liveness depend on every external dependency.

---

# 16. Docker Rules

Every service should have a Dockerfile where appropriate.

Prefer:

- Small base images.
- Multi-stage builds when useful.
- Non-root execution.
- Explicit dependency versions.
- `.dockerignore`.
- Health checks where useful.

Never place secrets directly into:

```text
Dockerfile
docker-compose.yml
Git repository
```

Use environment variables or secret-management mechanisms.

---

# 17. Kubernetes Rules

Kubernetes manifests should include appropriate:

```text
Deployment
Service
ConfigMap
Secret
PersistentVolumeClaim
Ingress
HorizontalPodAutoscaler
```

Use:

```text
requests
limits
readinessProbe
livenessProbe
```

Do not run containers as root unless there is a documented reason.

Do not store secrets in plaintext Git-managed manifests.

Use namespaces.

Example:

```text
smart-building
monitoring
```

---

# 18. Kubernetes Reliability

The system must demonstrate self-healing.

Example test:

```bash
kubectl delete pod <pod>
```

Expected:

```text
Pod deleted
    |
    v
Kubernetes detects replica count mismatch
    |
    v
New pod created
    |
    v
Readiness check passes
    |
    v
Traffic resumes
```

Record recovery time when doing resilience experiments.

---

# 19. Terraform Rules

Terraform is the source of truth for infrastructure.

Use:

```text
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply
```

Never manually create production infrastructure if Terraform is intended to manage it.

Rules:

- Use variables.
- Use outputs.
- Use modules when justified.
- Avoid hard-coded secrets.
- Review `terraform plan`.
- Keep state secure.
- Never commit sensitive Terraform state to Git.

Do not create a module for every tiny resource.

---

# 20. Ansible Rules

Use Ansible for configuration management.

Typical responsibilities:

```text
Install Docker
Install system packages
Configure users
Configure SSH
Configure monitoring agents
Configure OS parameters
```

Terraform:

```text
Creates infrastructure
```

Ansible:

```text
Configures infrastructure
```

Do not duplicate responsibilities unnecessarily.

---

# 21. CI/CD Rules

Every meaningful change should pass CI.

Recommended pipeline:

```text
Push
 |
 v
Lint
 |
 v
Unit tests
 |
 v
Integration tests
 |
 v
Build image
 |
 v
Security scan
 |
 v
Push image
 |
 v
Deploy
 |
 v
Health check
```

CI should fail on:

- Test failures
- Syntax errors
- Lint errors where enforced
- Invalid Docker build
- Security checks configured as blocking

Never disable a failing test merely to make CI green.

---

# 22. Testing Rules

Use pytest.

Required levels:

```text
Unit tests
Integration tests
API tests
Database tests
```

For important functionality, test:

```text
Success
Validation failure
Not found
Database failure
Duplicate event
Timeout
Dependency failure
```

Do not write tests that only assert that a function exists.

Tests should verify behavior.

---

# 23. Load Testing

Use:

```text
k6
```

or:

```text
Locust
```

Measure:

```text
RPS
P50 latency
P95 latency
P99 latency
Error rate
CPU
Memory
Database connections
Kafka consumer lag
```

Do not invent benchmark results.

Only document numbers obtained from actual tests.

---

# 24. Chaos Engineering

Failure scenarios may include:

```text
FastAPI pod failure
Kafka consumer failure
PostgreSQL primary failure
Network latency
CPU pressure
Disk pressure
```

For every experiment document:

```text
Failure injected
Detection time
Recovery time
Downtime
Data loss
Root cause
Recovery mechanism
```

Do not perform destructive experiments against an external production system without explicit authorization.

---

# 25. Security Rules

Security is part of the architecture.

Never:

- Commit credentials.
- Commit `.env`.
- Hard-code API keys.
- Log passwords.
- Log tokens.
- Disable TLS verification to "fix" an issue.
- Disable authentication just to simplify development.
- Use overly broad database permissions unnecessarily.

Use:

```text
Least privilege
Secret management
Input validation
Authentication
Authorization
Network isolation
Non-root containers
Dependency scanning
```

---

# 26. Configuration Rules

Configuration must be externalized.

Use:

```text
.env
.env.example
environment variables
Kubernetes ConfigMap
Kubernetes Secret
```

`.env.example` may contain:

```text
DATABASE_URL=
KAFKA_BOOTSTRAP_SERVERS=
REDIS_URL=
SECRET_KEY=
```

It must never contain real secrets.

---

# 27. Error Handling

Errors should be handled intentionally.

Do not:

```python
except Exception:
    pass
```

Do not silently swallow errors.

Bad:

```python
try:
    process()
except Exception:
    pass
```

Prefer:

```python
try:
    process()
except SpecificException as exc:
    logger.exception("Processing failed", exc_info=exc)
    raise
```

Handle expected failures explicitly.

---

# 28. Async Rules

FastAPI async endpoints should not perform blocking operations directly.

Be careful with:

- Blocking database drivers
- CPU-heavy AI inference
- File operations
- Synchronous network calls

For CPU-heavy tasks, consider:

```text
Background worker
Separate AI service
Task queue
```

Do not make every function `async` without understanding why.

---

# 29. Data Integrity

Sensor data must be treated as important system data.

Consider:

- Duplicate events
- Out-of-order events
- Missing events
- Invalid timestamps
- Device clock drift
- Duplicate device IDs
- Invalid sensor values

The ingestion pipeline should be idempotent where appropriate.

---

# 30. API and Database Separation

Do not expose SQLAlchemy models directly as the public API contract.

Use Pydantic schemas.

Example:

```text
SQLAlchemy Model
        |
        v
Service
        |
        v
Pydantic Response Schema
        |
        v
FastAPI
```

This prevents database implementation details from becoming API contracts.

---

# 31. Documentation Rules

Important architecture decisions must be documented.

Maintain:

```text
README.md
docs/architecture.md
docs/database.md
docs/backup-recovery.md
docs/deployment.md
docs/monitoring.md
docs/chaos-testing.md
docs/ai.md
```

Architecture diagrams should explain:

```text
Components
Data flow
Failure boundaries
Storage
Networking
Observability
```

---

# 32. Git Rules

Use meaningful commits.

Examples:

```text
feat: add device management API
feat: add Kafka sensor ingestion
fix: handle duplicate sensor events
perf: add sensor reading composite index
ops: add PostgreSQL monitoring
infra: add Terraform VPC
test: add device API integration tests
docs: document backup recovery
```

Avoid:

```text
update
fix
test
changes
final
final2
```

Never commit:

```text
.env
credentials
private keys
database dumps containing sensitive data
Terraform secrets/state when inappropriate
```

---

# 33. Agent Workflow

For every non-trivial task, follow this process:

## Step 1 — Understand

Read:

```text
AGENTS.md
README.md
relevant source files
relevant tests
```

## Step 2 — Plan

Before changing multiple components, identify:

```text
Files to change
Dependencies
Database changes
API changes
Infrastructure impact
Testing strategy
```

## Step 3 — Implement

Make minimal, focused changes.

## Step 4 — Test

Run the smallest relevant tests first.

Then run broader tests when appropriate.

## Step 5 — Inspect

Check:

```text
Logs
Errors
Database migration
Docker build
API behavior
Tests
```

## Step 6 — Report

Explain:

```text
What changed
Why
Tests executed
Known limitations
Next recommended step
```

---

# 34. When Requirements Are Ambiguous

Do not silently make a major architectural decision.

If ambiguity affects:

- Data model
- Security
- Infrastructure
- API contract
- Database HA
- Backup policy
- Cloud cost
- Production behavior

Ask for clarification or choose the safest minimal implementation and explicitly document the assumption.

For small implementation details, use reasonable engineering judgment.

---

# 35. Do Not Fake Completion

Never claim:

```text
"HA is working"
"Backup is verified"
"CI/CD is production-ready"
"System is scalable"
"AI accuracy is 95%"
```

unless evidence exists.

Instead say:

```text
Implemented but not yet verified.
```

or:

```text
Tested locally with X devices and Y events/sec.
```

Evidence is more important than impressive wording.

---

# 36. Definition of Done

A feature is not complete merely because the code compiles.

A feature is complete when applicable:

```text
Code
+
Tests
+
Validation
+
Logging
+
Error handling
+
Documentation
```

Infrastructure features additionally require:

```text
Deployment
+
Health checks
+
Monitoring
+
Failure testing
```

Database features additionally require:

```text
Migration
+
Index review
+
Backup consideration
+
Recovery consideration
```

---

# 37. Priority Order

When trade-offs are required, prioritize:

```text
1. Correctness
2. Security
3. Data integrity
4. Reliability
5. Observability
6. Maintainability
7. Performance
8. Developer convenience
9. Feature breadth
```

Do not sacrifice data integrity or security just to make a demo easier.

---

# 38. Final Principle

The project is not intended to demonstrate how many technologies an AI agent can install.

The project is intended to demonstrate that an engineer can:

```text
Design
   ↓
Implement
   ↓
Deploy
   ↓
Observe
   ↓
Scale
   ↓
Backup
   ↓
Recover
   ↓
Automate
   ↓
Improve
```

Every technical decision should support that goal.
