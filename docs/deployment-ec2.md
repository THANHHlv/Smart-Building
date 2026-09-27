# EC2 deployment with Aurora Express

This deployment uses Docker Hub images for the backend and frontend, Redis in
Docker Compose, and the existing Aurora PostgreSQL Express cluster. The Compose
file does not create another PostgreSQL database. GitHub Actions currently tests,
builds, and publishes images; automatic EC2 rollout is not configured yet.

## Known AWS resources

- Region: `us-east-2`
- AWS account: `473247067977`
- EC2: `i-0ac056f3c25c1949a` (Ubuntu 24.04, x86_64, `t3.micro`)
- Current public IP: `3.145.19.43` (changes after stop/start without Elastic IP)
- EC2 VPC: `vpc-05eb22b0d7a1f667d`
- Security group: `sg-027311d93c616dbfe`
- EC2 role: `smart-building-ec2-role`, currently reported with
  `AmazonSSMManagedInstanceCore` and `AuroraPostgresConnect`
- SSM Agent is online and a Session Manager terminal opened successfully
- Aurora endpoint: `database-1.cluster-c3smkq2uaysz.us-east-2.rds.amazonaws.com`
- Aurora cluster resource ID: `cluster-NPTLGZA5XZYTHTYRSDMGL5HDG4`
- Aurora database/user: `postgres` / `postgres`, port `5432`, IAM authentication

Aurora Express uses a public Internet Access Gateway and is outside the EC2 VPC
by design. The EC2 host therefore needs outbound Internet access and must be
allowed to connect to the cluster. There is no VPC peering step for this cluster.
Do not add inbound port 5432 to the EC2 security group. Check the Aurora
cluster's access controls separately. Keep the frontend bound to loopback until
HTTPS and a stable address or domain are available.

## AWS prerequisites

1. Confirm EC2 has Internet egress for Aurora Express and Docker Hub. Check the
   instance subnet's route, NAT/Internet Gateway as applicable, and outbound
   security rules.
2. Check the reported `AuroraPostgresConnect` policy on the EC2 role. Its
   `rds-db:connect` resource should be exactly:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Action": "rds-db:connect",
       "Resource": "arn:aws:rds-db:us-east-2:473247067977:dbuser:cluster-NPTLGZA5XZYTHTYRSDMGL5HDG4/postgres"
     }]
   }
   ```

3. If EC2 requires IMDSv2, set the instance metadata **response hop limit to 2**
   so the backend container can receive instance-role credentials. Do not place
   access keys in `.env.production` or the image.
4. Confirm Docker Engine and Compose plugin are installed on Ubuntu. Follow the
   [official Ubuntu installation guide](https://docs.docker.com/engine/install/ubuntu/)
   if either is missing. Since the
   instance has only 1 GiB RAM, monitor memory while pulling and starting images.
   Increase to at least `t3.small` if the services are killed for memory pressure.

The current `postgres` database user has broad privileges. After the first
working deployment, create a dedicated IAM-enabled application role with only
the required permissions and change `POSTGRES_USER` plus the IAM policy resource.

From the Session Manager terminal, make these read-only checks first:

```sh
docker version
docker compose version
python3 -c "import socket; socket.create_connection(('database-1.cluster-c3smkq2uaysz.us-east-2.rds.amazonaws.com', 5432), timeout=5).close(); print('Aurora TCP reachable')"
```

The TCP check proves only network reachability. A generated IAM token also does
not by itself prove `rds-db:connect`; the database connection check below does.

## GitHub and Docker Hub

Create one Docker Hub repository. Set GitHub Actions variable
`DOCKERHUB_REPOSITORY=username/repository` and secrets `DOCKERHUB_USERNAME` and
`DOCKERHUB_TOKEN` (a token with push permission). Pull requests and pushes to
`main` run backend tests, frontend checks, and both Docker builds. A passing
`main` run publishes `backend-<full commit SHA>` and `frontend-<full commit SHA>`.
The backend Ruff check is not a CI gate yet because existing lint violations
remain. Publishing requires the Docker Hub variable and secrets. No deployment
to EC2 is currently triggered by the workflow.

## Database verification before rollout

The reported data upload is not yet verified. From an authenticated database
session, inspect the migration version and representative tables without
changing data:

```sql
SELECT version_num FROM alembic_version;
SELECT COUNT(*) FROM buildings;
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM devices;
```

Compare the results with the source database or migration record. Do not run
`alembic upgrade head` against Aurora until the restored schema and migration
state are understood; a migration changes the live database. Verify backups and
a restore procedure separately.

## Manual deployment after prerequisites pass

Use a checkout of this repository on EC2. Copy `.env.production.example` to
`.env.production` on the host, fill in `DOCKERHUB_REPOSITORY`, a published
`IMAGE_TAG` commit SHA, a strong `SECRET_KEY`, and real frontend origins/URLs.
Keep `.env.production` out of Git and readable only by the deployment user.
Until a domain and TLS are configured, leave `CORS_ORIGINS=[]` and keep the web
port on loopback. Configure `VNPAY_RETURN_URL` before enabling live payments.
If the Docker Hub repository is private, run `docker login` on EC2 using a
read-only access token. Then run from the repository root:

```sh
docker compose --env-file .env.production -f deployment/docker/docker-compose.ec2.yml config --quiet
docker compose --env-file .env.production -f deployment/docker/docker-compose.ec2.yml pull
docker compose --env-file .env.production -f deployment/docker/docker-compose.ec2.yml run --rm --no-deps --entrypoint aws backend sts get-caller-identity
docker compose --env-file .env.production -f deployment/docker/docker-compose.ec2.yml up -d
curl --fail http://127.0.0.1:8080/health
curl --fail http://127.0.0.1:8080/ready
```

`/health` checks the backend process. `/ready` returns HTTP 503 when its database
query fails. A successful `/ready` checks connectivity only, not restored data.
The `sts get-caller-identity` command should show account `473247067977` and
an assumed role based on `smart-building-ec2-role`; it checks that credentials
reach the container. If it cannot reach instance metadata, inspect the IMDSv2
response hop limit.
If it fails, inspect `docker compose ... logs backend` without exposing tokens.
Verify an application request and the restored row counts before sending users
to the service. The frontend binds to `127.0.0.1:8080` by default; add a TLS
reverse proxy and stable DNS/EIP before making it public.

To verify the migration marker and representative row counts through the same
container configuration, run this read-only check from the repository root:

```sh
docker compose --env-file .env.production -f deployment/docker/docker-compose.ec2.yml run --rm --no-deps -T backend python - <<'PY'
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def main():
    async with engine.connect() as conn:
        for table in ("alembic_version", "buildings", "users", "devices"):
            exists = await conn.scalar(text("SELECT to_regclass(:name)"), {"name": f"public.{table}"})
            if not exists:
                print(f"{table}: missing")
            elif table == "alembic_version":
                print(f"{table}: {await conn.scalar(text('SELECT version_num FROM alembic_version'))}")
            else:
                print(f"{table}: {await conn.scalar(text(f'SELECT COUNT(*) FROM {table}'))}")
    await engine.dispose()

asyncio.run(main())
PY
```

Compare these counts with the source database before treating the upload as
verified. Do not paste IAM tokens or application secrets into logs or chat.

`uploads_data` is a persistent Docker volume. Existing `backend/uploads` files
are excluded from the image and need a separate transfer if users need them.
The volume is not a backup. This single EC2 host is not highly available.
