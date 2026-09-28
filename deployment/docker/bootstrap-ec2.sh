#!/usr/bin/env bash
# Initial EC2 rollout. Run as root through SSM; no database migrations are applied.
set -Eeuo pipefail
umask 077

IMAGE_TAG="${1:-fb0cbf74448d69b201d6187871f4251866e57202}"
[[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]] || { echo 'Expected a full commit SHA'; exit 1; }
[[ "$EUID" -eq 0 ]] || { echo 'Run through SSM Run Command or sudo bash'; exit 1; }
exec 9>/var/lock/smart-building-deploy.lock
flock -n 9 || { echo 'Another deployment is running'; exit 1; }

command -v docker >/dev/null
docker info >/dev/null
docker compose version
if ! command -v git >/dev/null; then
    apt-get update
    apt-get install -y git
fi
command -v python3 >/dev/null
command -v curl >/dev/null

REPO_URL='https://github.com/THANHHlv/Smart-Building.git'
DEPLOY_DIR='/opt/smart-building'
if [[ ! -e "$DEPLOY_DIR" ]]; then
    git clone --no-checkout "$REPO_URL" "$DEPLOY_DIR"
else
    [[ -d "$DEPLOY_DIR/.git" ]] || { echo 'Deployment path is not a Git checkout'; exit 1; }
    git -C "$DEPLOY_DIR" diff --quiet && git -C "$DEPLOY_DIR" diff --cached --quiet || { echo 'Tracked files have local edits; refusing to overwrite'; exit 1; }
fi
[[ -d "$DEPLOY_DIR/.git" ]] || { echo 'Deployment path is not a Git checkout'; exit 1; }
cd "$DEPLOY_DIR"
[[ "$(git remote get-url origin)" == "$REPO_URL" ]] || { echo 'Unexpected Git origin'; exit 1; }
git fetch --depth 1 origin "$IMAGE_TAG"
git checkout --detach "$IMAGE_TAG"

# Keep the existing application secret on retries. Never print it.
python3 - "$IMAGE_TAG" <<'PY'
from pathlib import Path
import secrets
import sys

path = Path('.env.production')
content = path.read_text() if path.exists() else Path('.env.production.example').read_text()
lines = content.splitlines()
existing = dict(line.split('=', 1) for line in lines if '=' in line and not line.startswith('#'))
updates = {
    'DOCKERHUB_REPOSITORY': 'thanhle9735/smart-building',
    'IMAGE_TAG': sys.argv[1],
}
if not existing.get('SECRET_KEY'):
    updates['SECRET_KEY'] = secrets.token_urlsafe(48)
for key, value in updates.items():
    found = False
    for index, line in enumerate(lines):
        if line.startswith(key + '='):
            lines[index] = key + '=' + value
            found = True
    if not found:
        lines.append(key + '=' + value)
path.write_text('\n'.join(lines) + '\n')
path.chmod(0o600)
PY

compose=(docker compose --project-name smart-building --env-file "$DEPLOY_DIR/.env.production" -f "$DEPLOY_DIR/deployment/docker/docker-compose.ec2.yml")
"${compose[@]}" config --quiet
"${compose[@]}" pull

echo 'Checking instance-role credentials inside the backend container'
account=$("${compose[@]}" run --rm --no-deps --entrypoint aws backend sts get-caller-identity --query Account --output text)
[[ "$account" == '473247067977' ]] || { echo 'Unexpected AWS account'; exit 1; }
role_arn=$("${compose[@]}" run --rm --no-deps --entrypoint aws backend sts get-caller-identity --query Arn --output text)
[[ "$role_arn" == arn:aws:sts::473247067977:assumed-role/smart-building-ec2-role/* ]] || { echo 'Unexpected instance role'; exit 1; }
echo 'EC2 role verified'

echo 'Checking Aurora schema and reporting representative row counts (read-only)'
"${compose[@]}" run --rm --no-deps -T backend python - <<'PY'
import asyncio
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from app.core.database import engine

async def main():
    try:
        expected = set(ScriptDirectory.from_config(Config('alembic.ini')).get_heads())
        async with engine.connect() as conn:
            actual = set((await conn.execute(text('SELECT version_num FROM alembic_version'))).scalars())
            if actual != expected:
                raise RuntimeError(f'Migration mismatch: database={sorted(actual)}, image={sorted(expected)}; no migrations applied')
            print(f'Migration revision: {sorted(actual)}', flush=True)
            for table in ('buildings', 'users', 'devices'):
                count = await conn.scalar(text(f'SELECT COUNT(*) FROM public.{table}'))
                print(f'{table}: {count} rows', flush=True)
    finally:
        await engine.dispose()

asyncio.run(main())
PY

echo 'Starting services on loopback'
"${compose[@]}" up -d --wait --wait-timeout 180
curl --fail --silent --show-error --max-time 60 --retry 3 --retry-all-errors http://127.0.0.1:8080/ready
printf '\n'
"${compose[@]}" ps
docker stats --no-stream --format 'table {{.Name}}\t{{.MemUsage}}' $("${compose[@]}" ps -q)
df -h /
echo 'Rollout passed readiness. Row counts still need comparison with the source to verify the data transfer.'
