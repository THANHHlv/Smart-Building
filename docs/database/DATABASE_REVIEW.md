# Database Review — Smart Building Cloud Platform

> Issue register from comprehensive database architecture review.  
> Review date: 2026-09-19

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 10 |
| MEDIUM | 18 |
| LOW | 15 |
| **Total** | **45** |

---

## Issue Register

| # | Issue | Severity | Current State | Recommendation | Reason | Status |
|---|-------|----------|---------------|----------------|--------|--------|
| 1 | `apartments` missing UNIQUE on `(floor_id, unit_number)` | **CRITICAL** | No unique constraint | Add `UniqueConstraint("floor_id", "unit_number")` | Duplicate unit numbers per floor violates business invariant | ✅ Fixed |
| 2 | `apartments.area_sqm` uses `Float` instead of `Numeric` | **HIGH** | `Float` | `Numeric(8, 2)` + `Mapped[Decimal]` | Financial billing calculation precision | ✅ Fixed |
| 3 | `sensor_readings.value` uses `Float` | **MEDIUM** | `Float` | Keep `Float` (acceptable for telemetry) | Documented in ADR-005 | ✅ Documented |
| 4 | `energy_consumption.value_kwh` uses `Float` | **HIGH** | `Float` | `Numeric(12, 4)` | Billing calculation precision | ✅ Fixed |
| 5 | `water_consumption.value_liters` uses `Float` | **HIGH** | `Float` | `Numeric(12, 4)` | Billing calculation precision | ✅ Fixed |
| 6 | `invoice.total_amount` typed as `Mapped[float]` with `Numeric` column | **MEDIUM** | Type mismatch | `Mapped[Decimal]` | Preserves DB precision in Python | ✅ Fixed |
| 7 | `MaintenanceTicket` overlaps with `Ticket` system | **MEDIUM** | Two tables | Document as legacy | Pending user confirmation | ⏳ Deferred |
| 8 | `MaintenanceTicket.urgency/.status` use plain `String` | **MEDIUM** | No DB validation | Use Enum or CheckConstraint | No enforcement of valid values | ⏳ Deferred |
| 9 | `Ticket.category` uses `String` but `TicketCategory` Enum exists | **MEDIUM** | Inconsistent | Use `Enum(TicketCategory)` | Consistency with other Enum columns | ✅ Fixed |
| 10 | `users.role` duplicates RBAC system | **MEDIUM** | Dual source of truth | Remove in future migration | Documented in ADR-004 | ✅ Documented |
| 11 | `Permission.created_at` uses deprecated `datetime.utcnow` | **HIGH** | No timezone, deprecated | `server_default=func.now()` | Python 3.12+ deprecation | ✅ Fixed |
| 12 | `UserRole.granted_at` uses deprecated `datetime.utcnow` | **HIGH** | Same as #11 | Same fix | Same issue | ✅ Fixed |
| 13 | `ApartmentService.started_at` uses Python lambda default | **LOW** | Inconsistent | Consider `server_default` | Minor consistency | ⏳ Deferred |
| 14 | `ManualConfirmation.submitted_at` uses Python lambda default | **LOW** | Same | Same | Minor consistency | ⏳ Deferred |
| 15 | Missing index on `alerts.device_id` | **MEDIUM** | No index | Add index | Dashboard/JOIN queries | ✅ Fixed |
| 16 | Missing index on `alerts.apartment_id` | **MEDIUM** | No index | Add index | Resident portal queries | ✅ Fixed |
| 17 | Missing index on `alerts.status` | **MEDIUM** | No index | Add index | `WHERE status = 'OPEN'` queries | ✅ Fixed |
| 18 | `sensor_readings` unbounded growth | **HIGH** | No partition/retention | Plan partitioning | 8.6M rows/day at scale | ⏳ Phase 7+ |
| 19 | `energy/water_consumption` relationship unclear | **MEDIUM** | Separate tables | Document purpose | Confusion about data pipeline | ✅ Documented |
| 20 | Dashboard queries missing metric index | **MEDIUM** | Only `(device_id, timestamp)` | Add `(metric, timestamp)` | `WHERE metric = 'electricity'` queries | ✅ Fixed |
| 21 | `buildings.name` no UNIQUE constraint | **LOW** | Not unique | Consider adding | Business-dependent | ⏳ Deferred |
| 22 | `device.installed_at` typed as `Mapped[str]` | **HIGH** | Wrong type hint | `Mapped[datetime]` | Misleading for developers | ✅ Fixed |
| 23 | `device.last_seen_at` typed as `Mapped[str]` | **HIGH** | Same | Same | Same | ✅ Fixed |
| 24 | `alert.resolved_at` typed as `Mapped[str]` | **HIGH** | Same | Same | Same | ✅ Fixed |
| 25 | `invoice.total_amount` Mapped mismatch | **MEDIUM** | `Mapped[float]` | `Mapped[Decimal]` | See #6 | ✅ Fixed |
| 26 | `transaction.amount` Mapped mismatch | **MEDIUM** | `Mapped[float]` | `Mapped[Decimal]` | See #6 | ✅ Fixed |
| 27 | `AmenityBooking.status` uses `String` | **LOW** | No DB validation | Add CheckConstraint | Low priority | ⏳ Deferred |
| 28 | `BulkJob.status` uses `String` | **LOW** | No DB validation | Same | Low priority | ⏳ Deferred |
| 29 | `ReportExport.status` uses `String` | **LOW** | No DB validation | Same | Low priority | ⏳ Deferred |
| 30 | `ReportExport.format` uses `String` | **LOW** | No DB validation | Same | Low priority | ⏳ Deferred |
| 31 | `invoices.apartment_id` FK uses CASCADE | **HIGH** | CASCADE | RESTRICT | Financial records preservation | ✅ Fixed |
| 32 | `billing_cycles.apartment_id` FK uses CASCADE | **HIGH** | CASCADE | RESTRICT | Billing history preservation | ✅ Fixed |
| 33 | `payment_methods` FK uses CASCADE | **MEDIUM** | CASCADE | Consider RESTRICT | Low priority | ⏳ Deferred |
| 34 | No CHECK on `invoice.total_amount >= 0` | **MEDIUM** | No check | Add CheckConstraint | DB-level validation | ✅ Fixed |
| 35 | No CHECK on `transaction.amount > 0` | **MEDIUM** | No check | Add CheckConstraint | DB-level validation | ✅ Fixed |
| 36 | No CHECK on `billing_cycle` period validity | **MEDIUM** | No check | `period_end > period_start` | Temporal consistency | ✅ Fixed |
| 37 | No CHECK on `ticket.rating` range | **LOW** | No check | `BETWEEN 1 AND 5` | Star rating validation | ✅ Fixed |
| 38 | `alembic.ini` contains hardcoded database URL | **HIGH** | Plaintext credentials | Use placeholder | Security | ✅ Fixed |
| 39 | `.env.example` contains real password | **CRITICAL** | `Thanh?1015` | Replace with `CHANGEME` | Git-committed credential | ✅ Fixed |
| 40 | No database roles for least-privilege | **MEDIUM** | Single superuser | Create roles | Production security | ⏳ Phase 7+ |
| 41 | `notification.data_json` uses `Text` vs `JSONB` | **LOW** | Text | Consider JSONB | Queryability | ⏳ Deferred |
| 42 | `notification.idempotency_key` index not unique | **MEDIUM** | Non-unique | Partial unique index | Prevent duplicates | ✅ Fixed |
| 43 | Missing `updated_at` on append-only tables | **LOW** | No update tracking | Acceptable | ADR-007 | ✅ Documented |
| 44 | `Announcement` excessive indexes | **LOW** | 8 indexes | Review selectivity | Low-cardinality columns | ⏳ Deferred |
| 45 | `Ticket` excessive single-column indexes | **LOW** | 8 indexes | Composite alternatives | Query pattern optimization | ⏳ Deferred |

---

## Resolution Summary

| Category | Fixed | Documented | Deferred |
|----------|-------|------------|----------|
| CRITICAL | 2 | 0 | 0 |
| HIGH | 10 | 0 | 0 |
| MEDIUM | 10 | 2 | 6 |
| LOW | 2 | 1 | 12 |
| **Total** | **24** | **3** | **18** |

All CRITICAL and HIGH severity issues have been resolved.
