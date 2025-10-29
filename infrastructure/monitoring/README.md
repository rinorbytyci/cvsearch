# Monitoring and observability stack

This directory defines a self-hosted monitoring toolkit for CVSearch composed of Prometheus (metrics), Grafana (visualisation and alerting), Loki (log aggregation) and Promtail (log shipping). The stack is packaged through `docker-compose` for reproducible local environments and can be adapted to production deployments on Contabo or Kubernetes clusters.

## Components

| Service | Purpose | Ports |
| ------- | ------- | ----- |
| Prometheus | Scrapes metrics from the web application, worker jobs and the monitoring stack itself. Configured via [`prometheus/prometheus.yml`](./prometheus/prometheus.yml). | `9090` |
| Grafana | Dashboards, alert rules and on-call runbooks. Provisioned data sources connect to Prometheus and Loki automatically. | `3000` |
| Loki | Central log storage. Uses on-disk boltdb-shipper storage by default. | `3100` |
| Promtail | Collects logs from `/var/log` and `/var/log/cvsearch` and pushes them to Loki. | `9080` (metrics) |

## Usage

1. Create the required configuration directories if running outside the repository and copy the files from this folder.
2. Provide credentials for Grafana by setting `GF_SECURITY_ADMIN_USER` and `GF_SECURITY_ADMIN_PASSWORD` in an `.env` file.
3. Start the stack:

```bash
docker-compose up -d
```

4. Access Grafana at <http://localhost:3000>. Default credentials are `admin`/`admin` if env vars are not supplied.

5. Configure Promtail on your hosts to send CVSearch application logs to Loki. Update `promtail/config.yml` to include additional log paths as needed.

## Alerting

Prometheus rules and Grafana alerting can be added under `prometheus/rules/` and `grafana/provisioning`. Typical alert coverage includes:

- High error rate on API endpoints (`rate(http_requests_total{status=~"5.."}[5m])`).
- Worker job backlog growth for virus scanning or data retention queues.
- Loki log volume spikes or absence of logs from critical services.

Alert destinations (Slack, Opsgenie, email) can be configured through Grafana's unified alerting and contact points.

## Dashboards

The pre-provisioned dashboard `cvsearch-overview.json` displays request throughput and recent logs. Extend dashboards to surface:

- Consent API latency and error metrics.
- Data retention job throughput and purged record counts.
- S3 storage usage via CloudWatch exporter.

## Incident response and S3 restoration

Detailed recovery procedures are available in the runbook [`runbooks/contabo-s3-restoration.md`](./runbooks/contabo-s3-restoration.md). Keep the document updated with contact details, credentials vault paths and command snippets for restoring CV assets from Contabo Object Storage.
