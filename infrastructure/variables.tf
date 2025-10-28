variable "project_name" {
  type        = string
  description = "Name of the CV Search project"
}

variable "aws_region" {
  type        = string
  description = "AWS region for MongoDB Atlas and network resources"
}

variable "aws_availability_zone" {
  type        = string
  description = "Availability zone for VPC subnets"
}

variable "vpc_cidr_block" {
  type        = string
  description = "CIDR block for the VPC"
}

variable "public_subnet_cidr" {
  type        = string
  description = "CIDR block for the public subnet"
}

variable "private_subnet_cidr" {
  type        = string
  description = "CIDR block for the private subnet"
}

variable "mongodbatlas_org_id" {
  type        = string
  description = "MongoDB Atlas organization ID"
}

variable "mongodbatlas_public_key" {
  type        = string
  description = "MongoDB Atlas public API key"
}

variable "mongodbatlas_private_key" {
  type        = string
  description = "MongoDB Atlas private API key"
  sensitive   = true
}

variable "mongodb_instance_size" {
  type        = string
  default     = "M0"
  description = "Atlas instance size"
}

variable "mongodb_username" {
  type        = string
  description = "MongoDB database user"
}

variable "mongodb_password" {
  type        = string
  description = "MongoDB database password"
  sensitive   = true
}

variable "mongodb_database" {
  type        = string
  description = "Primary MongoDB database name"
}

variable "contabo_client_id" {
  type        = string
  description = "Contabo API OAuth client ID"
}

variable "contabo_client_secret" {
  type        = string
  description = "Contabo API OAuth client secret"
  sensitive   = true
}

variable "contabo_user" {
  type        = string
  description = "Contabo API username"
}

variable "contabo_password" {
  type        = string
  description = "Contabo API password"
  sensitive   = true
}

variable "contabo_region" {
  type        = string
  description = "Contabo object storage region"
}

variable "contabo_storage_user" {
  type        = string
  description = "Contabo object storage user name"
}
