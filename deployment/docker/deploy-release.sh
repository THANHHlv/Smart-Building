#!/usr/bin/env bash
# Installed root-owned on EC2; GitHub may only pass a validated commit SHA via SSM.
set -Eeuo pipefail
umask 077
target="${1:?Provide a published main commit SHA}"
[[ "$target" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid commit SHA'; exit 1; }
[[ "$EUID" -eq 0 ]] || { echo 'Run through SSM'; exit 1; }
exec 9>/var/lock/smart-building-deploy.lock
flock -n 9 || { echo 'Another deployment is active'; exit 1; }
cd /opt/smart-building
[[ "$(git remote get-url origin)" == 'https://github.com/THANHHlv/Smart-Building.git' ]] || exit 1
git diff --quiet && git diff --cached --quiet || { echo 'Local tracked edits detected'; exit 1; }
git fetch --depth 50 origin main:refs/remotes/origin/main
[[ "$target" == "$(git rev-parse origin/main)" ]] || { echo 'Stale/non-main release rejected'; exit 1; }
previous_commit=$(git rev-parse HEAD)
backup=$(mktemp /opt/smart-building-deploy/env-before-release.XXXXXX)
cp .env.production "$backup"
chmod 0600 "$backup"
activated=false
compose=(docker compose --project-name smart-building --env-file /opt/smart-building/.env.production -f /opt/smart-building/deployment/docker/docker-compose.ec2.yml)
rollback() {
    trap - ERR
    set +e
    echo 'Release failed; restoring the previous commit and environment'
    git checkout --detach "$previous_commit"
    cp "$backup" .env.production
    chmod 0600 .env.production
    if "$activated"; then
        if "${compose[@]}" up -d --wait --wait-timeout 180 && curl --fail --silent --show-error --max-time 60 http://127.0.0.1:8080/ready; then
            echo 'Previous release restored and ready'
        else
            echo 'ROLLBACK FAILED: inspect service health through SSM'
        fi
    fi
    rm -f "$backup"
    exit 1
}
trap rollback ERR
git checkout --detach "$target"
python3 - "$target" <<'PY'
from pathlib import Path
import sys
path = Path('.env.production')
lines = path.read_text().splitlines()
assert any(line.startswith('IMAGE_TAG=') for line in lines), 'IMAGE_TAG missing'
path.write_text('\n'.join('IMAGE_TAG=' + sys.argv[1] if line.startswith('IMAGE_TAG=') else line for line in lines) + '\n')
path.chmod(0o600)
PY
"${compose[@]}" config --quiet
"${compose[@]}" pull
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
            print(f'Aurora schema verified: {sorted(actual)}', flush=True)
    finally:
        await engine.dispose()

asyncio.run(main())
PY
activated=true
"${compose[@]}" up -d --wait --wait-timeout 180
curl --fail --silent --show-error --max-time 60 --retry 3 --retry-all-errors http://127.0.0.1:8080/ready
curl --fail --silent --show-error --max-time 10 --output /dev/null http://127.0.0.1/
"${compose[@]}" ps
trap - ERR
rm -f "$backup"
echo "Release $target ready; no database migrations applied"
