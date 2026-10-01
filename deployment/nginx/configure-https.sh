#!/usr/bin/env bash
# Enable HTTPS for a DNS hostname or public IPv4 after AWS/network prerequisites.
set -Eeuo pipefail
umask 077
[[ "$EUID" -eq 0 ]] || { echo 'Run as root through SSM'; exit 1; }
domain="${1:?Provide the DNS hostname or public IPv4}"
email="${2:-}"
identifiers=(--domain "$domain")
is_ip=false
if [[ "$domain" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    python3 - "$domain" <<'PY'
import ipaddress
import sys
address = ipaddress.IPv4Address(sys.argv[1])
if not address.is_global:
    raise SystemExit('A publicly routable IPv4 is required')
PY
    is_ip=true
    identifiers=(--ip-address "$domain" --preferred-profile shortlived)
else
    [[ "$domain" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$ ]] || { echo 'Invalid DNS hostname'; exit 1; }
fi
contact=(--register-unsafely-without-email)
if [[ -n "$email" ]]; then
    [[ "$email" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] || { echo 'Invalid contact email'; exit 1; }
    contact=(--email "$email")
fi
template="$(dirname "$(readlink -f "$0")")/smart-building-https.conf.example"
[[ -f "$template" ]] || { echo 'HTTPS template missing'; exit 1; }
site='/etc/nginx/sites-available/smart-building'
enabled='/etc/nginx/sites-enabled/smart-building'
[[ -f "$site" && -L "$enabled" && "$(readlink -f "$enabled")" == "$site" ]] || { echo 'Configure the reviewed HTTP site first'; exit 1; }
command -v nginx >/dev/null || { echo 'Nginx is not installed'; exit 1; }
command -v certbot >/dev/null || { echo 'Install certbot before running this script'; exit 1; }
if "$is_ip"; then
    python3 - "$(certbot --version)" <<'PY'
import re
import sys
match = re.search(r'(\d+)\.(\d+)', sys.argv[1])
if not match or tuple(map(int, match.groups())) < (5, 4):
    raise SystemExit('IP certificates require Certbot 5.4 or newer (webroot support)')
PY
fi
command -v curl >/dev/null || { echo 'curl is not installed'; exit 1; }
if ! "$is_ip"; then
    getent ahosts "$domain" >/dev/null || { echo 'DNS hostname does not resolve'; exit 1; }
fi
exec 9>/var/lock/smart-building-deploy.lock
flock -n 9 || { echo 'Another deployment is active'; exit 1; }
nginx -t
curl --fail --silent --show-error --max-time 60 --output /dev/null http://127.0.0.1:8080/ready
backup=$(mktemp)
rendered=$(mktemp)
cp "$site" "$backup"
restore() {
    trap - ERR
    set +e
    cp "$backup" "$site"
    if nginx -t && systemctl reload nginx; then
        echo 'HTTPS activation failed; previous Nginx configuration restored'
    else
        echo 'Nginx restoration failed; inspect service through SSM'
    fi
    rm -f "$backup" "$rendered"
    exit 1
}
trap restore ERR
install -d -m 0755 /var/lib/letsencrypt/.well-known/acme-challenge
if grep -q 'ssl_certificate' "$site"; then
    # Avoid replacing any active HTTPS site during certificate issuance.
    grep -Fq '/var/lib/letsencrypt' "$site" || { echo 'Existing HTTPS site lacks the reviewed ACME webroot'; false; }
else
    cat >"$rendered" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $domain;
    server_tokens off;
    client_max_body_size 20m;
    location ^~ /.well-known/acme-challenge/ {
        root /var/lib/letsencrypt;
        default_type text/plain;
    }
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    install -m 0644 "$rendered" "$site"
    nginx -t
    systemctl reload nginx
fi
certbot certonly --webroot --webroot-path /var/lib/letsencrypt \
    --cert-name "$domain" "${identifiers[@]}" "${contact[@]}" \
    --non-interactive --agree-tos --keep-until-expiring
[[ -s "/etc/letsencrypt/live/$domain/fullchain.pem" && -s "/etc/letsencrypt/live/$domain/privkey.pem" ]]
sed "s/DOMAIN/$domain/g" "$template" >"$rendered"
install -m 0644 "$rendered" "$site"
nginx -t
systemctl reload nginx
# Verify the hostname and CA chain against this host, without disabling TLS validation.
curl --fail --silent --show-error --max-time 60 --resolve "$domain:443:127.0.0.1" \
    --output /dev/null "https://$domain/ready"
redirect=$(curl --silent --show-error --max-time 15 --resolve "$domain:80:127.0.0.1" \
    --output /dev/null --write-out '%{http_code} %{redirect_url}' "http://$domain/")
[[ "$redirect" == "301 https://$domain/" ]]
install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy
printf '%s\n' '#!/usr/bin/env bash' 'set -euo pipefail' 'nginx -t' 'systemctl reload nginx' \
    >/etc/letsencrypt/renewal-hooks/deploy/smart-building-nginx
chmod 0755 /etc/letsencrypt/renewal-hooks/deploy/smart-building-nginx
if systemctl cat certbot.timer >/dev/null 2>&1; then
    systemctl enable --now certbot.timer
    systemctl is-active --quiet certbot.timer
elif systemctl cat snap.certbot.renew.timer >/dev/null 2>&1; then
    systemctl start snap.certbot.renew.timer
    systemctl is-active --quiet snap.certbot.renew.timer
else
    echo 'No supported Certbot renewal timer found; automatic renewal is required'
    false
fi
certbot renew --cert-name "$domain" --dry-run
trap - ERR
rm -f "$backup" "$rendered"
echo "HTTPS enabled and renewal dry-run passed for $domain; verify https://$domain/ externally"
