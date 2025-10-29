# Contabo S3 backup and restoration runbook

This runbook explains how to recover CV documents and audit archives stored in Contabo Object Storage. Keep it accessible to on-call engineers and update credentials in the secret management system (1Password/HashiCorp Vault).

## Prerequisites

- Contabo Object Storage access key and secret key with `s3:ListBucket`, `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` permissions.
- Knowledge of the target bucket name (`$S3_BUCKET`).
- Configured `aws` CLI with the Contabo endpoint (<https://eu2.contabostorage.com>) or the `s3cmd` client.
- Latest inventory of legal-hold requests to avoid purging protected data.

## Verify backups

```bash
export AWS_ACCESS_KEY_ID=***
export AWS_SECRET_ACCESS_KEY=***
aws --endpoint-url=https://eu2.contabostorage.com s3 ls s3://$S3_BUCKET/backups/
```

Check that daily snapshots exist for the desired time range. Each snapshot should contain:

- `cvs/` – CV binary assets.
- `metadata/` – MongoDB dumps or JSON exports.
- `audit/` – Audit log archives.

## Restoration workflow

1. **Isolate the incident** – determine whether restoration is needed because of accidental deletion, corruption, or ransomware. Freeze relevant consultant consent records by enabling legal hold.
2. **Prepare staging area** – create a temporary bucket or local directory where restored files will be downloaded before re-ingestion.

```bash
aws --endpoint-url=https://eu2.contabostorage.com s3 sync s3://$S3_BUCKET/backups/2024-03-15 ./restoration-2024-03-15
```

3. **Restore MongoDB data** – use `mongorestore` or Atlas import tools to rehydrate consent and CV metadata. Review the data retention policy before applying.

```bash
mongorestore --uri "$MONGODB_URI" ./restoration-2024-03-15/metadata/
```

4. **Restore CV assets** – upload binary files back to the primary bucket. Run the virus scan worker afterwards to revalidate hashes.

```bash
aws --endpoint-url=https://eu2.contabostorage.com s3 sync ./restoration-2024-03-15/cvs/ s3://$S3_BUCKET/cvs/ --storage-class STANDARD
```

5. **Validate consent and retention** – call `/api/consultants/<id>/consent` to confirm consent status and inspect audit logs to ensure document access compliance.
6. **Purge staging data** – after validation and sign-off from compliance, delete the temporary restoration folder.

## Post-incident actions

- Update the incident ticket with a summary and attach Grafana dashboards showing request and error rates during the incident.
- Run the data retention worker manually to recalculate purge/flag schedules.
- Review Prometheus alerts and adjust thresholds if the incident was not captured automatically.
- Schedule a retro to discuss process improvements, including faster detection of failed uploads or unexpected deletions.
