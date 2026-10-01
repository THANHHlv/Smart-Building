#!/usr/bin/env bash
# Run after IAM grants are staged and the reviewed image has been deployed.
set -Eeuo pipefail
umask 077
[[ "$EUID" -eq 0 ]] || { echo 'Run as root through SSM'; exit 1; }
exec 9>/var/lock/smart-building-deploy.lock
flock -n 9 || { echo 'Another deployment is active'; exit 1; }
cd /opt/smart-building
compose=(docker compose --project-name smart-building --env-file /opt/smart-building/.env.production -f /opt/smart-building/deployment/docker/docker-compose.ec2.yml)
"${compose[@]}" config --quiet
# Validate a genuine IAM connection with the new user before touching the live environment.
"${compose[@]}" run --rm --no-deps -T -e POSTGRES_USER=smart_building_app backend \
    python scripts/provision_app_role.py --check
backup=$(mktemp)
cp .env.production "$backup"
rollback() {
    trap - ERR
    set +e
    cp "$backup" .env.production
    chmod 0600 .env.production
    if "${compose[@]}" up -d --wait --wait-timeout 180 \
        && curl --fail --silent --show-error --max-time 60 --output /dev/null http://127.0.0.1:8080/ready; then
        echo 'Previous database login restored and ready'
    else
        echo 'Database login rollback failed; inspect the backend through SSM'
    fi
    rm -f "$backup"
    exit 1
}
trap rollback ERR
python3 - <<'PY'
from pathlib import Path
path = Path('.env.production')
lines = path.read_text().splitlines()
assert sum(line.startswith('POSTGRES_USER=') for line in lines) == 1, 'Expected one POSTGRES_USER setting'
path.write_text('\n'.join('POSTGRES_USER=smart_building_app' if line.startswith('POSTGRES_USER=') else line for line in lines) + '\n')
path.chmod(0o600)
PY
"${compose[@]}" up -d --wait --wait-timeout 180
curl --fail --silent --show-error --max-time 60 --retry 3 --retry-all-errors \
    --output /dev/null http://127.0.0.1:8080/ready
"${compose[@]}" exec -T backend python scripts/provision_app_role.py --check
trap - ERR
rm -f "$backup"
echo 'Backend now uses smart_building_app; remove the EC2 postgres IAM grant after verification'
