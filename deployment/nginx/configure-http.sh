#!/usr/bin/env bash
set -Eeuo pipefail
[[ "$EUID" -eq 0 ]] || { echo 'Run as root through SSM'; exit 1; }
config="${1:?Provide the reviewed HTTP config file}"
[[ -f "$config" ]] || { echo 'Config file not found'; exit 1; }
if ! command -v nginx >/dev/null; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
fi
site='/etc/nginx/sites-available/smart-building'
enabled='/etc/nginx/sites-enabled/smart-building'
default='/etc/nginx/sites-enabled/default'
if [[ -f "$site" ]] && grep -q 'ssl_certificate' "$site"; then
    echo 'Existing HTTPS configuration detected; refusing to replace it with HTTP'
    exit 1
fi
backup=$(mktemp)
had_site=false
removed_default=false
if [[ -f "$site" ]]; then cp "$site" "$backup"; had_site=true; fi
restore() {
    trap - ERR
    set +e
    if "$had_site"; then cp "$backup" "$site"; else rm -f "$enabled" "$site"; fi
    if "$removed_default"; then ln -s /etc/nginx/sites-available/default "$default"; fi
    nginx -t && systemctl reload nginx
    rm -f "$backup"
    echo 'Nginx configuration failed; previous site restored'
    exit 1
}
trap restore ERR
install -m 0644 "$config" "$site"
ln -sfn "$site" "$enabled"
if [[ -L "$default" ]] && [[ "$(readlink -f "$default")" == /etc/nginx/sites-available/default ]]; then
    unlink "$default"
    removed_default=true
fi
nginx -t
systemctl enable --now nginx
systemctl reload nginx
curl --fail --silent --show-error --max-time 15 --output /dev/null --write-out 'HTTP proxy: %{http_code}\n' http://127.0.0.1/
trap - ERR
rm -f "$backup"
echo 'HTTP proxy enabled; backend and Compose frontend remain on private interfaces'
