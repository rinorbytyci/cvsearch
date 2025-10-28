# Infrastructure

This Terraform configuration provisions the core infrastructure for the CV Search platform.

## Components

- **Networking** – Creates a dedicated VPC with public and private subnets and security groups for compute workloads.
- **MongoDB Atlas** – Configures a project, replica set cluster, and database user.
- **Contabo Object Storage** – Allocates an S3-compatible bucket, user, and access keys for binary assets.

## Usage

1. Install the required Terraform providers by running `terraform init` from this directory.
2. Create a `terraform.tfvars` file (or provide variables via CLI) with values for the variables defined in `variables.tf`.
3. Review the execution plan with `terraform plan`.
4. Apply the configuration with `terraform apply`.

> **Note**: Provider credentials for MongoDB Atlas and Contabo must be kept secure. Use a secrets manager or environment variables when running Terraform in CI.
