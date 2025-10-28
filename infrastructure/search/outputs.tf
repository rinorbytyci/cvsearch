output "opensearch_endpoint" {
  description = "Public endpoint for the OpenSearch domain"
  value       = aws_opensearch_domain.cvsearch.endpoint
}

output "opensearch_dashboard_url" {
  description = "Dashboard URL"
  value       = aws_opensearch_domain.cvsearch.kibana_endpoint
}
