# EC2 deployment with Aurora Express

This deployment uses Docker Hub images for the backend and frontend, Redis in
Docker Compose, and the existing Aurora PostgreSQL Express cluster. The Compose
file does not create another PostgreSQL database. GitHub Actions tests, builds,
publishes images, and deploys main releases using OIDC and a restricted SSM command.

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

### Initial rollout evidence (2026-09-28)

SSM command `92b7fd8c-7ef1-48b3-aa27-defcbcefa94a` completed with exit code 0.
The deployed image commit is `fb0cbf74448d69b201d6187871f4251866e57202`.
The working checkout is `/opt/smart-building`; the Compose project is
`smart-building`. Backend, frontend, and Redis reported healthy. The frontend
listens on EC2 loopback `127.0.0.1:8080`; public HTTPS is not configured.

- EC2 role credentials were verified from the backend image.
- Aurora migration marker `b3c4d5e6f7a8` matched the image migration head.
- Read-only counts: buildings = 1, users = 64, devices = 466. These have not been
  compared with the source database, so the data transfer is not fully verified.
- `/ready` returned `ready` / `database: connected`. Its `redis: not_configured`
  field is a default schema value and does not check Redis connectivity.
- The initial database connection had two timeout retries before succeeding.
- At rollout, backend memory was 118.5 MiB, frontend 5.152 MiB, Redis 4.039 MiB;
  root disk had 3.1 GiB available. These are a snapshot, not load-test results.

No database migrations or public network rule changes were applied.

Aurora Express uses a public Internet Access Gateway and is outside the EC2 VPC
by design. The EC2 host therefore needs outbound Internet access and must be
allowed to connect to the cluster. There is no VPC peering step for this cluster.
Do not add inbound port 5432 to the EC2 security group. Check the Aurora
cluster's access controls separately. The Compose frontend stays on loopback;
the host Nginx proxy exposes HTTP for testing through the public IP.

## Public HTTP and future HTTPS

`http://3.145.19.43/` and `/ready` returned HTTP 200 on 2026-09-28.
Host Nginx listens on port 80 and forwards to `127.0.0.1:8080`.
Backend port 8000 and Redis are not published. The host proxy replaces incoming
forwarded headers; the frontend preserves the HTTP/HTTPS scheme for the backend.
Same-origin `/api/v1` requests need no additional CORS origins.

Reviewed configuration: `deployment/nginx/smart-building-http.conf`.
The root installer is `deployment/nginx/configure-http.sh`; it validates Nginx
before reloading and refuses to replace an existing HTTPS site with HTTP.
Port 443 has a security-group rule but does not serve HTTPS yet. Use HTTP for
initial testing; configure TLS before using real credentials or live payments.

When a domain is available:

1. Point its DNS A record to the EC2 public address. Stop/start can change this
   address; choose a stable address before relying on DNS.
2. Install Certbot with its Nginx plugin following the official Ubuntu/Nginx
   instructions and obtain a certificate for that domain.
3. Use `deployment/nginx/smart-building-https.conf.example` as the reviewed
   target: replace `DOMAIN`, use the issued certificate, validate with `nginx -t`,
   reload, and verify HTTPS plus the HTTP redirect and renewal dry run.
4. Configure any absolute payment return URLs for the HTTPS domain before
   enabling payments. The template is not active or certificate-tested yet.

Session Manager works without inbound SSH. The current SSH 22 rule can be
removed when administration uses SSM; keep the EC2 SSM role, agent, outbound
HTTPS connectivity, and administrator Session Manager permissions. No SSH rule
was removed during this setup.

## GitHub Actions releases through OIDC and SSM

The IAM role `smart-building-github-deploy-role` trusts only this repository's
`main` branch, with audience `sts.amazonaws.com`. The trust file includes both
the legacy subject and the immutable owner/repository ID subject used by newer
GitHub repositories. No AWS access key is stored in GitHub.

The role may send only `SmartBuildingDeploy` to this EC2 instance and read command
results. It cannot send the generic `AWS-RunShellScript` document. The custom
document accepts only a 40-character lowercase commit SHA and calls the
root-owned `/opt/smart-building-deploy/deploy-release.sh` outside the checkout.
IAM and SSM definitions are under `deployment/aws/`.

After tests and image publication pass, the workflow assumes the role, submits
the command, and waits for its result. The host serializes releases, rejects
commits other than current `origin/main`, pulls commit-tagged images, checks the
Aurora migration head without changing schema, and waits for Compose health
and HTTP readiness. A failed release restores the previous checkout and private
environment; after activation it also starts and checks the previous images.
Uploads remain in the existing volume. Deployment cannot automatically apply
schema migrations; review those separately.

Changes to the privileged host release script, custom document, or IAM policies
need administrator review and installation through SSM. An ordinary GitHub
release does not replace those controls. Rollback is implemented; failure
recovery has not yet been exercised against this EC2 instance.

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

### Automated initial rollout through SSM

The local `deployment/docker/invoke-ec2-bootstrap.ps1` script sends
`bootstrap-ec2.sh` to the known instance through SSM Run Command. Authenticate
the AWS CLI on the Windows workstation (not EC2) using a temporary console
session, then run from the repository root:

```powershell
aws login --profile smart-building-deploy --region us-east-2
./deployment/docker/invoke-ec2-bootstrap.ps1 -Profile smart-building-deploy
```

The signed-in identity needs SSM read and Run Command permissions for the target
instance. The wrapper checks the AWS account and SSM status. It returns a command
ID and a command for inspecting the result; submission alone is not deployment
success. No local AWS credentials are transmitted to EC2.

The remote script uses `/opt/smart-building`, checks out the exact image commit,
creates a private `.env.production` file, preserves its secret on retries, pulls
the images, verifies EC2 role credentials inside the container, and compares the
Aurora migration marker with the image's migration heads before starting Compose.
It reports representative row counts but does not verify them against the source.
It does not apply migrations or open public network ports. The final gate is an
HTTP request to `/ready`. This script is for initial rollout; automatic release
rollback and GitHub-to-SSM deployment are not configured by it.

### Manual alternative

Use a checkout of this repository on EC2. Copy `.env.production.example` to
`.env.production` on the host, fill in `DOCKERHUB_REPOSITORY`, a published
`IMAGE_TAG` commit SHA, a strong `SECRET_KEY`, and real frontend origins/URLs.
Keep `.env.production` out of Git and readable only by the deployment user.
Leave `CORS_ORIGINS=[]` for same-origin requests and keep the Compose web
port on loopback behind the host proxy. Configure `VNPAY_RETURN_URL` before enabling live payments.
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
to the service. The frontend binds to `127.0.0.1:8080` by default; the host proxy
provides public HTTP for initial testing and HTTPS after a domain is configured.

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
