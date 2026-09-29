# Aurora Serverless v2 idle operation

## Evidence and limits of attribution (2026-09-29)

This is a repository audit, not a live AWS diagnosis. The workstation AWS CLI
returned `NoCredentials`; no production SQL, SSM command, AWS change, or deployment
was performed. The reported pause at 15:52 and resume at 21:27 on September 28,
ACUUtilization ~12.5%, and CommitThroughput ~3.45/s are user-provided observations.
Confirm the RDS console timezone before comparing these times with UTC logs.
CommitThroughput alone does not identify the client or prove application writes.

| Source | Repository evidence | Consequence |
| --- | --- | --- |
| SQLAlchemy pool | `backend/app/core/database.py`: pool_size=20, overflow=10, recycle=300 before this change | Sessions close logically but physical PostgreSQL connections remain in the pool. Recycling occurs on checkout, not by an idle timer. An open idle connection alone prevents pause; it does not explain continuous commits. |
| Request transactions | `get_db()` commits at the end of each successful DB-backed request | Read requests also finish transactions with COMMIT. Polling can therefore contribute to CommitThroughput without data changes. Existing business transaction behavior is retained. |
| Dashboard polling | `frontend/src/App.tsx`: autoRefresh defaults to true; every 5 seconds, an administrator loads eight API endpoints and announcements | An open authenticated tab can produce continuous queries/commits, even with no clicks. This proves a possible source, not the exact production rate. |
| Notifications | `NotificationCenter.tsx`: every 30 seconds | Additional DB requests while a tab is mounted. |
| Bulk job progress | `BillingInvoices.tsx`: every 1.5 seconds after invoice generation until completed/failed | Work-related status reads; previously timer lacked unmount cleanup. |
| Docker health | `backend/Dockerfile`: `/health` every 30 seconds; frontend checks local static `/` | These checks do not use the DB. Redis health checks also do not use PostgreSQL. |
| DB readiness | `/ready` executes SELECT 1; bootstrap/release scripts call it for their deployment gate | Each probe can resume Aurora. No continuous `/ready` monitor is configured in this repo; inspect external uptime checks separately. The probe now rolls back its read transaction rather than committing it. |
| Scheduler | `backend/app/main.py`: monthly invoices on configured day/hour (defaults day 1, hour 2); overdue check daily at hour 8 | Necessary scheduled DB work, not a seconds-level commit loop. The scheduler uses the EC2/container local timezone; confirm it on the host. These jobs remain enabled. |
| Consumers | Kafka consumers await `getone()`; fallback bus awaits queue.get(); DB session opens only when handling an event | Idle waiting does not poll PostgreSQL. Genuine notifications/alerts will resume the DB. Kafka offset auto-commit is a broker operation, not a PostgreSQL commit. |
| Background jobs | `bulk_job_service.py`, report exports are request-triggered | Active jobs legitimately use DB even after the browser closes. Do not cancel business jobs solely because there are no visitors. |
| Simulator | `backend/scripts/iot_simulator.py`: finite configurable cycles, one commit per cycle | Not launched by EC2 Compose or backend lifespan. A manually launched simulator is a possible writer; inspect actual host processes. |

The retained connection pool is a confirmed application obstacle to auto-pause.
The exact source of the reported continuous commits remains unverified. Check
the live deployed SHA, process list, external monitors, pgAdmin and other clients,
as well as any local/cloud DB jobs or exporters before attributing the rate.

## Exact application changes

* `POSTGRES_POOL_MODE=auto` (default) selects SQLAlchemy NullPool for IAM. `null`
  explicitly disconnects for password connections too; `pooled` preserves the
  previous pooling behavior and is incompatible with this idle objective.
  NullPool closes physical connections on checkin after a transaction/session.
  It does not forcibly interrupt requests or jobs holding a transaction open.
* Every physical IAM connection attempt runs `aws rds generate-db-auth-token`
  anew using the existing EC2 role/CLI configuration. Tokens are not cached,
  printed, added to URLs, or persisted. CA verification and hostname checking
  remain enabled. CLI output is captured privately; stderr is discarded.
* Connect timeout is 35s, at most 3 attempts with 1s/2s delays, and a total 50s
  budget including token generation. The CLI has its own 15s limit and its child
  process is killed/reaped on timeout/cancellation. Configuration validates
  positive timeouts, a budget <=50s and attempts <=3.
* Only connection establishment retries timeouts, network OSError (excluding
  TLS failures), CannotConnectNow, TooManyConnections, ConnectionDoesNotExist
  and ConnectionFailure errors. Password/authorization/TLS/SQL errors are not
  retried. Queries, transactions and COMMIT are never replayed. Exhausted
  transient connection attempts return a sanitized HTTP 503. Do not blindly
  retry a payment/write after an uncertain commit outcome.
* Dashboard, notifications and invoice job status polling pause for hidden tabs,
  refresh on visibility return, and wait for each refresh to finish before
  scheduling the next interval. Unmount cleans up timers/listeners. Server-side
  business work continues. A visible authenticated tab is still an active user;
  it intentionally keeps fresh data and can prevent auto-pause.
* `/health` and `/metrics` stay DB-free. `/ready` remains an explicit DB
  connectivity test returning 503 on failure; use it only for deployment/manual
  diagnosis, not recurring uptime monitoring. No schema or AWS changes.
* EC2 Compose defaults the new settings; an existing private environment needs
  no edit. The example environment lists non-secret settings. GitHub Actions
  additionally runs `npm test` before publishing/deploying existing images.

NullPool trades connection/IAM signing overhead for idle savings. It also removes
the pool's concurrency cap: monitor IAM connection rate, CPU and DatabaseConnections
under actual load. Do not introduce RDS Proxy/PgBouncer with persistent backend
connections for this pause use case. The current two Nginx layers use 60s read
timeouts, leaving a margin above the 50s connection budget; application query time
also consumes that margin. A failed first request returns 503; a later request
can succeed once the DB is available. If long cold starts exceed the budget,
review both proxy layers and the privileged release gate before raising it.

## Required business schedules and operating trade-off

Keep monthly billing, daily overdue checks, real payment callbacks, bulk jobs and
notification/alert consumption enabled. They may wake Aurora with zero visitors.
After they complete, NullPool releases their connections and the idle countdown
can restart. Continuous real IoT ingestion cannot coexist with long DB pauses;
choose an explicit demo ingestion window if appropriate, rather than dropping
events. Run large imports, reports and administrative tasks in the same planned
window when possible. The current schedule defaults remain unchanged; disabling
or changing billing deadlines needs a separate business decision. Run a single
backend worker with this in-process scheduler to avoid duplicate scheduled jobs.

## Deployment review and release

Review the full diff and local verification results before authorizing rollout.
Do not push/merge to `main` for review: the existing `Containers` workflow
automatically deploys passing main builds through OIDC + `SmartBuildingDeploy`
SSM to EC2. A feature branch/PR runs tests and image builds without deployment.
After approval, merge the reviewed change to main, wait for backend-test,
frontend-check, image-build, publish and deploy to succeed, and confirm the
deployed IMAGE_TAG/SHA without printing the private environment.

The existing root-owned `/opt/smart-building-deploy/deploy-release.sh` verifies
the migration head, performs an explicit `/ready` check and has rollback logic.
No migration or host-script replacement is required by this patch. A deploy
intentionally wakes Aurora for those DB checks. Verify that no private setting
overrides `POSTGRES_POOL_MODE` to `pooled`. Do not display `.env.production` or
resolved `docker compose config`; use `config --quiet` for validation.

After rollout, this inspection opens no DB connection and prints only the
non-secret pool/timeout settings:

```sh
docker compose --env-file .env.production -f deployment/docker/docker-compose.ec2.yml exec -T backend python -c "from app.core.database import engine, settings; print(type(engine.pool).__name__, settings.postgres_connect_timeout_seconds, settings.postgres_connect_budget_seconds, settings.postgres_connect_attempts)"
```

Expected output: `NullPool 35.0 50.0 3` (the numeric formatting may differ).

## Local verification (2026-09-29)

* Full backend suite: 133 passed in 269.80s on isolated PostgreSQL 17 listening
  only on 127.0.0.1:55432. It included 15 new connection unit tests and one real
  PostgreSQL connection lifecycle test. Existing JWT utcnow deprecation warnings
  remain (203 warnings); no failures.
* Three additional unit cases were then added for readiness rollback and idle
  startup/business schedules; the final `tests/unit` run passed all 18 cases.
  Thus all 136 final backend cases have passed, with the last three run separately.
* Frontend: all 3 behavioral polling tests passed; `npm run lint` exited 0 with
  existing warnings; `npm run build` passed with the existing large-chunk warning.
* Focused Ruff checks and application compileall passed. `git diff --check`
  passed. Docker daemon was unavailable, so local container builds were not run;
  the existing GitHub Actions image-build gate must pass before release.
* AWS credentials were unavailable. IAM CLI/driver behavior was mocked in unit
  tests; physical connection release was tested against local PostgreSQL. Live
  IAM authentication and Aurora pause/resume still require post-deploy validation.

## Post-deploy verification

1. Read the cluster settings without changing them or opening SQL:

   ```sh
   aws rds describe-db-clusters --region us-east-2 --db-cluster-identifier database-1 \
     --query 'DBClusters[0].{Version:EngineVersion,Scaling:ServerlessV2ScalingConfiguration,Members:DBClusterMembers[*].DBInstanceIdentifier}' --output json
   ```

   Verify MinCapacity=0, supported engine version, and the actual
   SecondsUntilAutoPause. Identify DB instance IDs from Members: CloudWatch
   capacity and pause/resume events are instance-level. No proposed AWS change
   is included; if settings prevent pause, review an exact change separately.
   AWS also documents other auto-pause blockers, including RDS Proxy and some
   replication/configuration combinations.

2. While Aurora is already awake, optionally inspect connections once, without
   dumping SQL text or credentials:

   ```sql
   SELECT application_name, backend_type, state, count(*) AS connections,
          min(backend_start) AS oldest_connection,
          min(xact_start) AS oldest_transaction
   FROM pg_stat_activity
   WHERE pid <> pg_backend_pid()
   GROUP BY application_name, backend_type, state
   ORDER BY connections DESC;
   ```

   New application IAM connections identify themselves as
   `smart-building-backend`. Compare grouped counts before/after stopping web
   traffic. Correlate API path counts (omit query strings/auth headers) with
   Nginx logs; inspect EC2 process names for simulator/exporter/cron work.
   This diagnostic session itself prevents pause: close it afterward. Do not
   keep polling pg_stat_activity throughout the idle test.

3. Close all Smart Building tabs and pgAdmin connections, stop any demo simulator
   you intentionally started, and allow in-flight business jobs to finish.
   Audit external uptime checks/exporters: periodic checks must target `/health`
   or static `/`, not `/ready`, login or DB-backed APIs. Do not stop the website,
   scheduler or legitimate event processing. Choose a test window between jobs.

4. Wait longer than SecondsUntilAutoPause **from the final DB connection closing**,
   plus metric/event reporting delay. View RDS instance Events and CloudWatch
   `AWS/RDS` / `ServerlessDatabaseCapacity`, using the actual
   `DBInstanceIdentifier`. Confirm a completed pause event and capacity 0.
   DatabaseConnections and CommitThroughput help confirm inactivity; 12.5%
   ACUUtilization alone is not proof of pause. Watching AWS metrics/events does
   not open a PostgreSQL connection. `/health` should still return 200 while asleep.

5. Reopen the website and perform login/dashboard access. Static HTML alone need
   not wake DB. Record first DB-backed request latency/status in browser Network
   without sharing tokens, and confirm RDS resume events plus capacity >0.
   Expect extra latency; AWS describes typical resume around 15s and longer after
   extended sleep. Confirm real data appears, notifications and billing pages
   work, and subsequent requests recover. If a bounded 503 occurs, retry a read
   after a short wait; investigate auth/TLS failures instead of retrying them.

6. Close clients again and confirm a second successful pause. Record deployed
   SHA, actual auto-pause seconds, UTC event times, capacity graphs, recovery
   latency/status and any scheduled wake-ups. Only this live check establishes
   that `database-1` actually pauses and resumes after rollout.

References: [AWS automatic pause/resume](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2-auto-pause.html),
[SQLAlchemy async connections](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html),
[SQLAlchemy NullPool](https://docs.sqlalchemy.org/en/20/core/pooling.html#sqlalchemy.pool.NullPool).
