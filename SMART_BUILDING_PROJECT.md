# Smart Building Cloud Platform

> Nền tảng quản lý và giám sát tòa nhà thông minh, tập trung vào **Cloud / Database Engineering / DevOps / Observability**, kết hợp **AI anomaly detection** ở mức vừa phải.

## 1. Mục tiêu

Xây dựng một hệ thống có khả năng:

- Quản lý tòa nhà, căn hộ và thiết bị IoT.
- Thu thập dữ liệu điện, nước, nhiệt độ, độ ẩm theo thời gian thực.
- Mô phỏng hàng trăm/hàng nghìn thiết bị IoT bằng Python.
- Truyền dữ liệu qua Kafka.
- Cung cấp REST API bằng FastAPI.
- Lưu trữ dữ liệu bằng PostgreSQL.
- Triển khai PostgreSQL Primary/Replica và backup/recovery.
- Container hóa bằng Docker.
- Orchestrate bằng Kubernetes.
- Provision hạ tầng bằng Terraform.
- Tự động cấu hình server bằng Ansible.
- CI/CD bằng GitHub Actions.
- Monitoring bằng Prometheus + Grafana.
- Logging bằng Loki.
- Alerting bằng Alertmanager.
- AI phát hiện bất thường trong dữ liệu tiêu thụ điện/nước và một số chỉ số hệ thống.
- Thực hiện chaos/failure testing để kiểm tra khả năng phục hồi.

---

# 2. Kiến trúc mục tiêu

```text
                         ┌──────────────────┐
                         │   React Web UI   │
                         └────────┬─────────┘
                                  │
                              HTTP/REST
                                  │
                         ┌────────▼─────────┐
                         │    FastAPI       │
                         │   API Gateway    │
                         └───────┬──────────┘
                                 │
             ┌───────────────────┼──────────────────┐
             │                   │                  │
             ▼                   ▼                  ▼
      Device Service       Alert Service       User Service
             │                   │
             └───────────┬───────┘
                         │
                         ▼
                    Kafka / Broker
                         ▲
                         │
                Python IoT Simulator
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    Electricity      Temperature      Water Meter
      Sensors          Sensors          Sensors

                         │
                         ▼
                  Data Processing
                         │
                ┌────────┴────────┐
                ▼                 ▼
          PostgreSQL          AI Service
                │                 │
       ┌────────┴───────┐         │
       │                │         ▼
    Primary           Replica   Anomaly
       │                         Detection
       │
       ▼
   pgBackRest
       │
       ▼
    MinIO / S3


========================================================

                  DEVOPS / CLOUD LAYER

Terraform
    │
    ▼
Cloud / VM Infrastructure
    │
    ▼
Kubernetes
    │
    ├── FastAPI
    ├── AI Service
    ├── Kafka
    ├── Redis
    └── Monitoring Stack

GitHub Actions
    │
    ▼
Build → Test → Security Scan → Push Image → Deploy

Prometheus → Grafana
Loki       → Grafana
Alertmanager → Notifications
```

---

# 3. Công nghệ

## Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- Uvicorn

## Database

- PostgreSQL
- PgBouncer
- PostgreSQL Streaming Replication
- pgBackRest

## Messaging

- Apache Kafka

## Cache

- Redis

## IoT

- Python simulator
- MQTT có thể bổ sung ở phase sau

## AI

- Python
- pandas
- NumPy
- scikit-learn
- Isolation Forest

## DevOps

- Docker
- Docker Compose
- Kubernetes
- Helm
- GitHub Actions

## Infrastructure

- Terraform
- Ansible

## Observability

- Prometheus
- Grafana
- Loki
- Promtail
- Alertmanager

## Storage

- MinIO
- S3-compatible storage

---

# 4. Phạm vi MVP

Không triển khai toàn bộ hệ thống ngay.

MVP đầu tiên chỉ cần:

```text
IoT Simulator
      ↓
FastAPI
      ↓
PostgreSQL
      ↓
Grafana
```

Các chức năng:

1. Tạo apartment.
2. Tạo device.
3. Device gửi sensor data.
4. FastAPI nhận dữ liệu.
5. PostgreSQL lưu dữ liệu.
6. API lấy dữ liệu lịch sử.
7. Dashboard Grafana hiển thị dữ liệu.

Sau khi MVP chạy ổn mới thêm Kafka, AI, HA, Kubernetes và Cloud.

---

# 5. Data Model

Các bảng chính:

```text
users
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
```

Quan hệ:

```text
building
   │
   └── floor
          │
          └── apartment
                  │
                  └── device
                         │
                         └── sensor_reading
```

Ví dụ `devices`:

```text
id
device_code
apartment_id
device_type
status
installed_at
last_seen_at
```

Ví dụ `sensor_readings`:

```text
id
device_id
timestamp
metric
value
unit
```

---

# 6. API Design

FastAPI là backend chính.

## Apartments

```http
GET    /api/v1/apartments
POST   /api/v1/apartments
GET    /api/v1/apartments/{id}
PUT    /api/v1/apartments/{id}
DELETE /api/v1/apartments/{id}
```

## Devices

```http
GET    /api/v1/devices
POST   /api/v1/devices
GET    /api/v1/devices/{id}
PUT    /api/v1/devices/{id}
DELETE /api/v1/devices/{id}
```

## Sensor data

```http
POST /api/v1/readings
GET  /api/v1/readings
GET  /api/v1/devices/{id}/readings
```

## Dashboard

```http
GET /api/v1/dashboard/overview
GET /api/v1/dashboard/energy
GET /api/v1/dashboard/water
GET /api/v1/dashboard/temperature
```

## Health

```http
GET /health
GET /ready
```

---

# 7. Cấu trúc repository

```text
smart-building-platform/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   │
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── apartments.py
│   │   │       ├── devices.py
│   │   │       ├── readings.py
│   │   │       └── dashboard.py
│   │   │
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── logging.py
│   │   │
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── repositories/
│   │
│   ├── migrations/
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
│
├── simulator/
│   ├── main.py
│   ├── generators/
│   │   ├── electricity.py
│   │   ├── temperature.py
│   │   └── water.py
│   └── Dockerfile
│
├── ai-service/
│   ├── app/
│   ├── models/
│   ├── training/
│   ├── inference/
│   └── Dockerfile
│
├── frontend/
│
├── infrastructure/
│   ├── terraform/
│   └── ansible/
│
├── deployment/
│   ├── docker/
│   │   └── docker-compose.yml
│   │
│   ├── kubernetes/
│   │   ├── namespace.yaml
│   │   ├── backend.yaml
│   │   ├── kafka.yaml
│   │   └── postgres.yaml
│   │
│   └── helm/
│
├── monitoring/
│   ├── prometheus/
│   ├── grafana/
│   ├── loki/
│   └── alertmanager/
│
├── scripts/
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── cd.yml
│
├── docs/
│
├── .env.example
├── .gitignore
├── Makefile
└── README.md
```

---

# 8. Development Roadmap

## Phase 0 — Repository

Mục tiêu:

```text
Git repository
Docker
Python environment
FastAPI skeleton
PostgreSQL container
```

Checklist:

- [ ] Tạo repository.
- [ ] Tạo project structure.
- [ ] Tạo FastAPI app.
- [ ] Tạo Dockerfile.
- [ ] Tạo docker-compose.yml.
- [ ] Chạy PostgreSQL.
- [ ] FastAPI kết nối PostgreSQL.
- [ ] Tạo `/health`.

---

# Phase 1 — Database

Thiết kế PostgreSQL.

Checklist:

- [ ] Thiết kế ERD.
- [ ] Tạo models.
- [ ] SQLAlchemy.
- [ ] Alembic migration.
- [ ] Index.
- [ ] Foreign key.
- [ ] Constraint.
- [ ] Seed data.
- [ ] Query optimization.

Nên có index cho:

```text
sensor_readings(device_id, timestamp)
energy_consumption(apartment_id, timestamp)
devices(apartment_id)
```

---

# Phase 2 — FastAPI Backend

Xây dựng REST API.

Checklist:

- [ ] Apartment CRUD.
- [ ] Device CRUD.
- [ ] Sensor reading API.
- [ ] Energy API.
- [ ] Water API.
- [ ] Dashboard API.
- [ ] Validation bằng Pydantic.
- [ ] Error handling.
- [ ] Logging.
- [ ] Health check.
- [ ] Unit test.
- [ ] Integration test.

FastAPI docs:

```text
/docs
/redoc
```

---

# Phase 3 — IoT Simulator

Viết Python service sinh dữ liệu.

Ví dụ:

```text
100 apartments
×
5 devices
×
1 event / 5 seconds
```

Simulator phải sinh:

```text
Electricity
Temperature
Humidity
Water
Device status
```

Dữ liệu nên có:

```text
Normal
Spike
Missing data
Device offline
Extreme value
```

Điều này rất quan trọng cho AI và monitoring.

---

# Phase 4 — Kafka

Chuyển từ:

```text
Simulator → FastAPI → PostgreSQL
```

sang:

```text
Simulator
    ↓
Kafka
    ↓
Consumer
    ↓
PostgreSQL
```

Topics:

```text
sensor.readings
device.events
alerts
system.events
```

FastAPI không nhất thiết phải xử lý toàn bộ sensor stream.

FastAPI chủ yếu xử lý:

```text
REST API
Management
Query
Dashboard
```

---

# Phase 5 — AI

Bắt đầu bằng anomaly detection.

Input:

```text
timestamp
power
temperature
humidity
water_flow
```

Model:

```text
Isolation Forest
```

Pipeline:

```text
Historical Data
      ↓
Feature Engineering
      ↓
Train Model
      ↓
Save Model
      ↓
Real-time Data
      ↓
Inference
      ↓
Anomaly Score
      ↓
Alert
```

Ví dụ:

```json
{
  "device_id": "electric-302",
  "anomaly": true,
  "score": -0.81,
  "reason": "Abnormal power consumption"
}
```

Không cần dùng LLM ở giai đoạn đầu.

LLM chỉ nên được thêm sau này để:

```text
Metrics + Logs + Alerts
          ↓
        LLM
          ↓
Incident Summary
          ↓
Suggested Investigation Steps
```

---

# Phase 6 — Monitoring

Cài:

```text
Prometheus
Grafana
Loki
Alertmanager
```

Metrics cần theo dõi:

## Application

```text
HTTP requests
HTTP errors
Latency
Request rate
```

## PostgreSQL

```text
Connections
Transactions
Cache hit ratio
Query latency
Locks
Deadlocks
Database size
```

## Kafka

```text
Messages/sec
Consumer lag
Broker status
```

## Kubernetes

```text
CPU
Memory
Pod restart
Pod availability
Node health
```

---

# Phase 7 — PostgreSQL HA

Từ:

```text
PostgreSQL
```

nâng lên:

```text
                HAProxy
                   │
             ┌─────┴─────┐
             │           │
          Primary      Replica
             │
             │ WAL
             ▼
          Replica
```

Thực hiện:

- [ ] Streaming replication.
- [ ] Replication user.
- [ ] `pg_hba.conf`.
- [ ] WAL configuration.
- [ ] Replication monitoring.
- [ ] Replication lag metric.
- [ ] Failover test.
- [ ] Connection pooling.

---

# Phase 8 — Backup & Recovery

Dùng:

```text
PostgreSQL
     ↓
pgBackRest
     ↓
MinIO
```

Thiết kế:

```text
Full backup
Incremental backup
WAL archive
Retention policy
```

Phải test:

```text
Backup
  ↓
Delete / corrupt database
  ↓
Restore
  ↓
Verify data
```

Document:

```text
RPO
RTO
Backup frequency
Recovery procedure
```

Ví dụ:

```text
RPO: 5 minutes
RTO: < 15 minutes
```

Các con số trên chỉ là mục tiêu thử nghiệm; benchmark thực tế của hệ thống mới là giá trị cuối cùng.

---

# Phase 9 — Docker

Tất cả service chạy bằng Docker:

```text
FastAPI
PostgreSQL
Kafka
Redis
AI
Simulator
Prometheus
Grafana
Loki
Alertmanager
```

Tạo:

```text
docker-compose.yml
docker-compose.dev.yml
docker-compose.monitoring.yml
```

---

# Phase 10 — Kubernetes

Deploy:

```text
FastAPI
AI Service
Simulator
Kafka
Redis
Monitoring
```

Sử dụng:

```text
Deployment
Service
ConfigMap
Secret
PersistentVolume
PersistentVolumeClaim
Ingress
HorizontalPodAutoscaler
```

Test:

```bash
kubectl delete pod <pod>
```

Kubernetes phải tự tạo pod mới.

---

# Phase 11 — Terraform

Terraform quản lý infrastructure.

Ví dụ:

```text
VPC
Subnet
Security Group
VM
Load Balancer
Storage
Kubernetes
```

Mục tiêu:

```text
terraform init
terraform plan
terraform apply
```

Không tạo infrastructure thủ công.

---

# Phase 12 — Ansible

Ansible cấu hình server:

```text
Docker
Kubernetes prerequisites
Monitoring agents
Users
SSH configuration
System configuration
```

Ví dụ:

```text
Terraform
    ↓
Create VM
    ↓
Ansible
    ↓
Configure VM
```

---

# Phase 13 — CI/CD

GitHub Actions:

```text
git push
   ↓
Lint
   ↓
Unit Test
   ↓
Integration Test
   ↓
Docker Build
   ↓
Security Scan
   ↓
Push Image
   ↓
Deploy
   ↓
Health Check
```

Branch:

```text
main
develop
feature/*
```

---

# Phase 14 — Chaos Engineering

Thử các failure:

```text
Kill FastAPI pod
Kill Kafka consumer
Kill PostgreSQL primary
Network latency
Disk usage high
CPU stress
```

Đo:

```text
Detection time
Recovery time
Downtime
Data loss
RTO
RPO
```

Ví dụ report:

```text
Failure:
PostgreSQL Primary crashed

Detection:
3 seconds

Failover:
8 seconds

Application recovery:
12 seconds

Data loss:
0 records

Total recovery:
12 seconds
```

---

# 9. Security

Tối thiểu phải có:

- [ ] Không commit `.env`.
- [ ] Secrets bằng Kubernetes Secret.
- [ ] Password hash.
- [ ] JWT authentication.
- [ ] Role-based authorization.
- [ ] API validation.
- [ ] Rate limiting.
- [ ] HTTPS ở production.
- [ ] Container image scanning.
- [ ] Non-root containers.
- [ ] Database network isolation.

---

# 10. Testing

## Unit test

```text
pytest
```

## API test

```text
FastAPI TestClient
```

## Database integration test

```text
PostgreSQL test container
```

## Load test

Có thể dùng:

```text
Locust
k6
```

Test:

```text
100 users
500 users
1000 users
```

Đo:

```text
RPS
P95 latency
P99 latency
Error rate
CPU
Memory
Database connections
```

---

# 11. Metrics để đưa vào portfolio

Không chỉ nói:

> "System is scalable."

Hãy benchmark và ghi số liệu thật.

Ví dụ:

```text
IoT devices:        1,000
Events/sec:         200
API throughput:     850 RPS
P95 latency:        120 ms
DB connections:     80
Replication lag:    < 1 sec
Backup duration:    45 sec
Recovery time:      11 sec
```

Các con số phải lấy từ benchmark thực tế, không tự đặt để làm đẹp README.

---

# 12. Dashboard

Grafana nên có ít nhất:

### Infrastructure Dashboard

```text
CPU
RAM
Disk
Network
```

### Kubernetes Dashboard

```text
Nodes
Pods
Restarts
CPU
Memory
```

### PostgreSQL Dashboard

```text
Connections
QPS
Latency
Cache Hit Ratio
Locks
Replication Lag
WAL
```

### IoT Dashboard

```text
Devices Online
Devices Offline
Energy Consumption
Water Consumption
Temperature
Anomalies
```

---

# 13. AI Dashboard

```text
┌──────────────────────────────────┐
│ AI ANOMALY DETECTION             │
├──────────────────────────────────┤
│ Devices analyzed: 1,000          │
│ Anomalies today: 17              │
│ High severity: 3                 │
├──────────────────────────────────┤
│ Latest anomaly                   │
│ Apartment: 302                   │
│ Device: electric-302             │
│ Expected: 1.4 kW                 │
│ Actual:   9.7 kW                 │
│ Score:    -0.82                   │
└──────────────────────────────────┘
```

---

# 14. Definition of Done

Project được coi là hoàn thành khi:

- [ ] FastAPI hoạt động.
- [ ] PostgreSQL hoạt động.
- [ ] IoT simulator sinh dữ liệu.
- [ ] Kafka xử lý stream.
- [ ] Data được lưu vào PostgreSQL.
- [ ] Dashboard hiển thị realtime/historical data.
- [ ] AI phát hiện anomaly.
- [ ] Alert được tạo khi anomaly xảy ra.
- [ ] PostgreSQL có replica.
- [ ] Backup tự động.
- [ ] Restore đã được kiểm thử.
- [ ] Prometheus thu metrics.
- [ ] Grafana hiển thị metrics.
- [ ] Loki thu logs.
- [ ] Alertmanager gửi cảnh báo.
- [ ] Docker Compose chạy được local.
- [ ] Kubernetes deployment hoạt động.
- [ ] Terraform provision infrastructure.
- [ ] Ansible configure server.
- [ ] CI/CD hoạt động.
- [ ] Chaos test thành công.
- [ ] Có benchmark.
- [ ] Có architecture diagram.
- [ ] Có documentation.

---

# 15. Thứ tự triển khai khuyến nghị

Không làm theo thứ tự "Cloud → Kubernetes → AI".

Làm:

```text
1. FastAPI
       ↓
2. PostgreSQL
       ↓
3. CRUD + Database
       ↓
4. IoT Simulator
       ↓
5. Sensor ingestion
       ↓
6. Kafka
       ↓
7. Monitoring
       ↓
8. AI anomaly detection
       ↓
9. PostgreSQL HA
       ↓
10. Backup / Recovery
       ↓
11. Docker
       ↓
12. Kubernetes
       ↓
13. Terraform
       ↓
14. Ansible
       ↓
15. CI/CD
       ↓
16. Load Test
       ↓
17. Chaos Engineering
       ↓
18. Cloud Deployment
```

---

# 16. Portfolio Story

Project nên được mô tả theo hướng:

> Designed and implemented a cloud-native smart building platform for real-time IoT monitoring and infrastructure operations. Built a FastAPI backend with PostgreSQL, Kafka-based event ingestion, PostgreSQL HA and automated backup/recovery. Containerized and deployed services using Docker and Kubernetes, provisioned infrastructure with Terraform, automated server configuration with Ansible, and implemented observability using Prometheus, Grafana and Loki. Added machine-learning-based anomaly detection for abnormal energy consumption and validated system resilience through load and failure testing.

---

# 17. Nguyên tắc quan trọng

Không cố nhồi công nghệ.

Mỗi technology phải giải quyết một vấn đề:

```text
FastAPI
→ API

PostgreSQL
→ Persistent data

Kafka
→ Event streaming

Redis
→ Cache

AI
→ Anomaly detection

Prometheus
→ Metrics

Grafana
→ Visualization

Loki
→ Logs

Kubernetes
→ Orchestration

Terraform
→ Infrastructure as Code

Ansible
→ Configuration management

GitHub Actions
→ CI/CD

pgBackRest
→ Backup/recovery
```

Mục tiêu cuối cùng không phải là:

> "Project dùng 15 công nghệ."

Mà là:

> **"Tôi có thể thiết kế, triển khai, giám sát, backup, scale và recover một hệ thống production-like."**
