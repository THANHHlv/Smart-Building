# Step 1: application access, database login and HTTPS

## Local implementation status

The code now denies device listing and reading access for residents without an
apartment. Both reading endpoints use the same sensor authorization dependency.
Residents can query only their apartment's readings; query pagination counts use
the same apartment filter. Non-resident staff must have `sensor.read` (or the
administrator wildcard), including when requesting a device's history directly.

The runtime database provisioner, cutover script and HTTPS activation script are
prepared for deployment. They have not yet been applied to EC2/Aurora. Record
the applied commit, verification results and date here after deployment.

Local verification on 2026-10-02: 22 relevant tests passed across sensor access,
reading endpoints, devices, RBAC, the existing data-isolation regression and
runtime database privileges. The role tests performed real CRUD operations and
confirmed PostgreSQL rejects schema changes, TRUNCATE and migration-marker
updates. Ruff and Bash syntax checks passed. Live IAM authentication, certificate
issuance, public HTTPS and renewal remain pending AWS access and verification of
the current public address. The user has no domain; the prepared HTTPS script also
supports a public IPv4 certificate.

## Prerequisites and release order

1. Authenticate the administrative AWS CLI identity in `us-east-2`, confirm the
   account and EC2 instance, and inspect the current Nginx site and service health.
2. Deploy the reviewed application image containing the access fixes and scripts.
   Keep the existing database administrator login during this release. The normal
   GitHub-to-SSM release does not install privileged host scripts or change IAM.
3. Provision the runtime database role and stage the EC2 IAM grant as below. Verify
   the new login before switching the live backend.
4. Activate HTTPS after the chosen hostname or public IPv4 reaches EC2 and ports 80/443 are
   reachable. Verify publicly and update the payment return URL before real use.

## Least-privilege database login

The application login is `smart_building_app`. It receives `CONNECT`, public schema
`USAGE`, and `SELECT/INSERT/UPDATE/DELETE` on the ORM application tables. It can read
`alembic_version` for release verification but cannot change it. It receives no
object ownership, schema creation, role administration, replication, RLS bypass,
table truncation or migration privileges. The IAM membership is `rds_iam`.

Provisioning is an operational database-role change, not a schema migration.
All application schema changes continue through Alembic under a separate
administrative/migration identity. New tables require rerunning the grant script;
blanket future-table grants are intentionally avoided.

The script checks the migration head before writing grants. Role creation and
grants are one transaction, which rolls back if validation fails. It refuses to
reuse unmanaged roles and detects CREATE privileges inherited from PUBLIC.
If PUBLIC grants require changes, review their effect on other database users
before changing them. The script does not revoke privileges from other users.

From `/opt/smart-building` on EC2, with the existing administrative database login:

```sh
docker compose --project-name smart-building --env-file .env.production \
  -f deployment/docker/docker-compose.ec2.yml run --rm --no-deps -T backend \
  python scripts/provision_app_role.py

docker compose --project-name smart-building --env-file .env.production \
  -f deployment/docker/docker-compose.ec2.yml run --rm --no-deps -T backend \
  python scripts/provision_app_role.py --apply
```

Temporarily allow the EC2 role to connect as both the previous `postgres` login
and `smart_building_app` so rollback is possible during cutover. Preserve the
existing IAM policy as a private backup. The final reviewed policy is
`deployment/aws/ec2-app-db-policy.json`; it permits only the runtime login on
the specific Aurora cluster. Do not attach that final policy before confirming
the cutover if it replaces the administrator login's permission.

Install the reviewed `deployment/docker/switch-db-user.sh` as a root-owned host
script through the administrative SSM session, then run it. It tests an actual
IAM connection with the new user, backs up the private environment, switches
`POSTGRES_USER`, checks Compose health and `/ready`, and audits the running
backend's database privileges. Failure restores the previous environment/login.
It does not log the environment or authentication tokens.

After successful cutover and representative authenticated application requests,
restrict the EC2 role to the final policy. Verify `/ready` and application requests
again. Keep the database administrator identity available only for administration;
do not delete it. Review all EC2 IAM policies for other `rds-db:connect` grants
that would still allow the `postgres` login. A rollback after final IAM restriction
requires temporarily restoring the previous IAM grant before reverting the user.

Use the same role grant audit after every schema migration. The production
environment example now names `smart_building_app`; this does not edit the live
private `.env.production`.

Reference: [AWS IAM database account setup](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/UsingWithRDS.IAMDBAuth.DBAccounts.html)
and [IAM connection policy](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/UsingWithRDS.IAMDBAuth.IAMPolicy.html).

## HTTPS activation

The user currently has no domain. Use the verified current EC2 public IPv4 with
a Let's Encrypt IP certificate. Certbot 5.4 or newer is required for IP webroot
issuance. These certificates last 160 hours, so automatic renewal is mandatory.
Check that EC2 still owns this IP before issuance. Stop/start can change it;
then obtain a certificate for the new IP and update application return URLs.
An Elastic IP is a separate cloud-cost decision and is not created by this step.

```sh
sudo bash /opt/smart-building/deployment/nginx/configure-https.sh \
  <verified-current-public-ip>
```

The optional second argument is an ACME contact email. Without it, Certbot
registers without email. Existing ACME accounts are reused. Certificate lifetime
and renewal should be monitored regardless of the contact email.

For a DNS hostname, supply the hostname and optional email. Confirm all A/AAAA
records point to the host that serves the ACME challenge. A changing EC2 public
IP needs an updated DNS record before issuance or renewal.

For a hostname, the Ubuntu Certbot package can be installed through the
administrative session. For an IP certificate, use the current official Certbot
installation method (such as the classic snap) and verify `certbot --version` is
at least 5.4; Ubuntu's package may be too old. The activation script supports both
the package and snap renewal timers. Install the
reviewed HTTPS script and its template together in a root-owned directory.
Then run, replacing the sample values:

```sh
sudo bash /opt/smart-building/deployment/nginx/configure-https.sh \
  smartbuilding.example.com admin@example.com
```

The script requires the existing reviewed HTTP site. It issues a certificate
using the ACME webroot, activates TLS 1.2/1.3, preserves sanitized proxy headers,
redirects HTTP to the selected hostname, and enables a renewal timer/reload hook.
It checks the real hostname and trusted certificate chain against localhost,
checks `/ready`, and runs a renewal dry-run. A failed activation restores the
previous Nginx configuration. Certificate files may remain after rollback.
Use a trusted public certificate; TLS verification is never disabled.

From an external machine, verify the public route as well:

```sh
curl --fail --head https://smartbuilding.example.com/
curl --fail https://smartbuilding.example.com/ready
curl --head http://smartbuilding.example.com/
```

The HTTP response must redirect to the HTTPS hostname. Verify login and a
representative API request through HTTPS. Set `VNPAY_RETURN_URL` to the actual
HTTPS frontend return route before live payments and verify the provider's return
configuration. The script does not infer a domain or payment account configuration.

Reference: [Certbot Nginx instructions and renewal verification](https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal)
and [Let's Encrypt IP certificates with Certbot](https://letsencrypt.org/2026/03/11/shorter-certs-certbot).
