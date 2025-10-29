# Search Infrastructure

This Terraform stack provisions a dedicated Amazon OpenSearch cluster for semantic and keyword CV search.

## Usage

1. Ensure the AWS provider is configured with credentials that can create OpenSearch domains.
2. Supply the required variables, for example via a `terraform.tfvars` file:

```hcl
aws_region        = "eu-central-1"
aws_account_id    = "123456789012"
master_username   = "cvsearch-admin"
master_password   = "change-me"
allowed_cidr_blocks = ["198.51.100.0/24"]
```

3. Initialise and apply the stack:

```bash
terraform init
terraform apply
```

After provisioning, expose the `opensearch_endpoint` via environment variables (`OPENSEARCH_HOST`, `OPENSEARCH_API_KEY`) so the application can combine Atlas Search with vector suggestions.
