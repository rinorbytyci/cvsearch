variable "aws_region" {
  description = "AWS region where the OpenSearch domain should be provisioned"
  type        = string
}

variable "aws_account_id" {
  description = "AWS account ID hosting the OpenSearch domain"
  type        = string
}

variable "domain_name" {
  description = "Name for the OpenSearch domain"
  type        = string
  default     = "cvsearch-opensearch"
}

variable "instance_type" {
  description = "OpenSearch instance type"
  type        = string
  default     = "t3.small.search"
}

variable "instance_count" {
  description = "Number of data nodes"
  type        = number
  default     = 2
}

variable "volume_size" {
  description = "EBS volume size in GiB"
  type        = number
  default     = 50
}

variable "engine_version" {
  description = "OpenSearch engine version"
  type        = string
  default     = "OpenSearch_2.11"
}

variable "master_username" {
  description = "Master user for fine-grained access control"
  type        = string
}

variable "master_password" {
  description = "Master password for the OpenSearch domain"
  type        = string
  sensitive   = true
}

variable "allowed_cidr_blocks" {
  description = "CIDR blocks allowed to access the domain"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "kms_key_id" {
  description = "KMS key used to encrypt data at rest"
  type        = string
  default     = ""
}
