terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = ">= 1.17.0"
    }
    contabo = {
      source  = "contabo/contabo"
      version = ">= 0.3.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

provider "mongodbatlas" {
  public_key  = var.mongodbatlas_public_key
  private_key = var.mongodbatlas_private_key
}

provider "contabo" {
  oauth2_client_id     = var.contabo_client_id
  oauth2_client_secret = var.contabo_client_secret
  oauth2_user          = var.contabo_user
  oauth2_pass          = var.contabo_password
}

module "network" {
  source                 = "./modules/network"
  vpc_cidr_block         = var.vpc_cidr_block
  private_subnet_cidr    = var.private_subnet_cidr
  public_subnet_cidr     = var.public_subnet_cidr
  aws_availability_zone  = var.aws_availability_zone
}

resource "mongodbatlas_project" "cvsearch" {
  name   = var.project_name
  org_id = var.mongodbatlas_org_id
}

resource "mongodbatlas_cluster" "cvsearch" {
  project_id   = mongodbatlas_project.cvsearch.id
  name         = "cvsearch-cluster"
  cluster_type = "REPLICASET"

  provider_name               = "TENANT"
  backing_provider_name       = "AWS"
  provider_region_name        = var.aws_region
  provider_instance_size_name = var.mongodb_instance_size
  replication_specs {
    num_shards = 1
    regions_config {
      region_name     = var.aws_region
      electable_nodes = 3
      priority        = 7
      read_only_nodes = 0
    }
  }
}

resource "mongodbatlas_database_user" "cvsearch" {
  project_id         = mongodbatlas_project.cvsearch.id
  username           = var.mongodb_username
  password           = var.mongodb_password
  auth_database_name = "admin"

  roles {
    role_name     = "readWrite"
    database_name = var.mongodb_database
  }
}

resource "contabo_object_storage" "cvsearch" {
  display_name = "cvsearch-storage"
  region       = var.contabo_region
  quota        = 200
}

resource "contabo_object_storage_user" "cvsearch" {
  object_storage_id = contabo_object_storage.cvsearch.id
  username          = var.contabo_storage_user
  description       = "Service account for CV Search"
}

resource "contabo_object_storage_access_key" "cvsearch" {
  object_storage_id = contabo_object_storage.cvsearch.id
  user_id           = contabo_object_storage_user.cvsearch.id
}

output "mongodb_connection_string" {
  description = "MongoDB Atlas connection string"
  value       = mongodbatlas_cluster.cvsearch.connection_strings.standard_srv
}

output "contabo_s3_endpoint" {
  description = "Contabo S3 endpoint URL"
  value       = contabo_object_storage.cvsearch.s3_endpoint
}
