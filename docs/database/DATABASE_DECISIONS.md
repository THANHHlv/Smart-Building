# Database Architecture Decisions — Smart Building Cloud Platform

> Architecture Decision Records (ADR) for database design choices.

---

## ADR-001: UUID v4 Primary Keys

**Decision**: Use UUID v4 as primary key for all tables.

**Context**: The platform is designed for distributed event ingestion via Kafka consumers. Multiple consumers may insert data concurrently from different processes.

**Options Considered**:
| Option | Pros | Cons |
|--------|------|------|
| BIGINT SERIAL | Smallest index size (8B), fastest inserts | Requires centralized sequence, predictable IDs in API |
| UUID v4 | Client-side generation, non-predictable, distributed-safe | 16B index, random inserts cause B-tree page splits |
| UUID v7 | Time-sortable UUID, best of both worlds | Requires PostgreSQL 17+ or custom function |
| Composite Key | Natural keys where applicable | Complex JOINs, harder API design |

**Chosen**: UUID v4 via `uuid.uuid4()`.

**Reason**: The project needs client-side ID generation for Kafka consumer idempotency and API security (non-predictable IDs). The 2x index overhead over BIGINT is negligible at current scale.

**Trade-offs**:
- IDs are not time-sortable — pagination by `created_at` is required instead of by `id`.
- B-tree insert performance degrades with random UUIDs at very high volumes — mitigated by upgrading to UUIDv7 when PostgreSQL 17+ is adopted.

**Future**: Upgrade to UUIDv7 in `UUIDPrimaryKeyMixin` when PostgreSQL 17+ is available.

---

## ADR-002: Numeric Types for Financial Fields

**Decision**: Use `Numeric(12, 2)` for monetary amounts and `Numeric(12, 4)` for utility consumption values.

**Context**: IEEE 754 floating-point (`Float`) introduces rounding errors. For example, `0.1 + 0.2 = 0.30000000000000004` in Python float. When billing calculations multiply consumption × rate, these errors compound.

**Options Considered**:
| Option | Pros | Cons |
|--------|------|------|
| Float | Faster arithmetic, smaller storage | Rounding errors in financial calculations |
| Numeric/Decimal | Exact precision | Slightly slower, larger storage |
| Integer (store cents) | No rounding, very fast | Requires conversion at every boundary |

**Chosen**: `Numeric(12, 2)` for amounts, `Numeric(12, 4)` for consumption, `Numeric(8, 2)` for area.

**Reason**: Financial precision is a non-negotiable requirement for a billing system. The performance difference is insignificant. Python's `Decimal` type preserves the database precision.

**Trade-offs**: Slightly more complex Python code (must use `Decimal` instead of `float`).

---

## ADR-003: CASCADE vs RESTRICT Foreign Key Policies

**Decision**: Use `RESTRICT` for financial entity FKs, `CASCADE` for hierarchical entities.

**Context**: When an apartment is deactivated or deleted, what happens to its invoices and billing cycles?

**Policy**:
| Relationship | On Delete | Rationale |
|---|---|---|
| `Building → Floor → Apartment → Device → SensorReading` | CASCADE | Hierarchical — removing parent removes children |
| `Apartment → BillingCycle` | RESTRICT | Financial records must be preserved |
| `Apartment → Invoice` | RESTRICT | Legal/audit requirement — invoices cannot vanish |
| `Invoice → Transaction` | RESTRICT | Payment records must be preserved |
| `Transaction → PaymentAuditLog` | RESTRICT | Audit trail is immutable |
| `Device → DeviceType` | RESTRICT | Cannot delete a device type that has active devices |
| `Ticket → Attachments/Comments/History` | CASCADE | Ticket children are meaningless without parent |
| `User → PaymentMethod` | CASCADE | Acceptable — tokenized credentials have no audit value |

**Trade-offs**: RESTRICT means you cannot delete an apartment that has invoices. The application must handle this by soft-deleting (setting `is_active = false`) instead.

---

## ADR-004: Dual Role System (Legacy + RBAC)

**Decision**: Maintain backward compatibility via `users.role` column while transitioning to `user_roles` table.

**Context**: The initial schema used a simple `users.role` string column (`"admin"` / `"resident"`). Phase 4 added a full RBAC system with `roles`, `permissions`, `role_permissions`, and `user_roles` tables.

**Current state**: Both systems coexist. The `fetch_user_permissions()` function falls back to `users.role` when no `user_roles` records exist.

**Plan**:
1. ✅ Phase 4: RBAC tables created, backward-compat fallback in place.
2. Phase N: Migrate all users to have explicit `user_roles` records.
3. Phase N+1: Remove `users.role` column via Alembic migration.

**Trade-offs**: Temporary dual source of truth — acceptable during transition period.

---

## ADR-005: Sensor Data Float vs Numeric

**Decision**: Keep `Float` for `sensor_readings.value`, use `Numeric` for `energy_consumption.value_kwh` and `water_consumption.value_liters`.

**Context**: Sensor telemetry data (temperature, humidity, voltage) does not require exact decimal precision. Energy/water consumption values directly feed into billing calculations.

**Reason**:
- `sensor_readings` is the raw telemetry table — IEEE 754 precision (15-17 significant digits) is more than adequate for sensor measurements.
- `energy_consumption` / `water_consumption` are pre-aggregated values that flow into invoice calculations — must be exact.

**Trade-offs**: Mixed type conventions across related tables — documented here for clarity.

---

## ADR-006: Soft Delete via `is_active` Flag

**Decision**: Use `is_active = Boolean` for soft delete on entity tables (`buildings`, `apartments`, `devices`, `users`).

**Context**: Hard-deleting entities would cascade to historical data and break referential integrity.

**Pattern**:
- `is_active = True` → active entity
- `is_active = False` → soft-deleted / deactivated

**Not used**:
- `deleted_at TIMESTAMPTZ` pattern was considered but rejected because:
  1. The `is_active` pattern is already established across the codebase.
  2. No business requirement for "who deleted" or "when deleted" audit trail on core entities.
  3. UNIQUE constraint conflicts with `deleted_at` pattern are simpler to handle with `is_active`.

**Trade-offs**: Cannot track deletion time. Acceptable — if deletion auditing is needed later, add `deactivated_at` column.

---

## ADR-007: Append-Only Audit Tables

**Decision**: `payment_audit_log` and `ticket_status_history` are append-only.

**Context**: Financial and operational audit trails must be immutable for compliance and debugging.

**Implementation**:
- No `updated_at` column on these tables.
- Application code must never UPDATE or DELETE from these tables.
- The model docstrings explicitly state this constraint.

**Enforcement**: Currently enforced by convention and code review. For production, consider:
- PostgreSQL trigger to prevent UPDATE/DELETE.
- Database role restrictions (read-only on these tables for app user).

---

## ADR-008: Partial Unique Index for Amenity Booking

**Decision**: Use PostgreSQL partial unique index to prevent double-booking.

**Implementation**:
```sql
CREATE UNIQUE INDEX uq_amenity_slot_active
ON amenity_bookings(amenity_id, booking_date, time_slot)
WHERE status IN ('pending', 'confirmed');
```

**Reason**: Two residents cannot book the same slot on the same date for the same amenity — but cancelled bookings should not block future bookings.

**Trade-offs**: PostgreSQL-specific feature — not portable to other databases. Acceptable since PostgreSQL is the only supported database.
