# CloudSolution Hub on AWS — single EC2 instance in its own dedicated VPC, no
# load balancer. TLS terminates on the instance itself via nginx + a free
# Let's Encrypt certificate (certbot) — this is the same "minimal-cost shape"
# docs/deployment/deploy-aws.md documents as manual copy-paste steps; this file just
# automates the provisioning half of it (network, instance, DB init, nginx +
# certbot package install). Route 53 is optional: leave domain_name /
# route53_zone_name unset to get a plain http://<elastic-ip> instance for
# testing, and wire up a real domain (+ run certbot) later.

terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ---------------------------------------------------------------------------
# Variables
# ---------------------------------------------------------------------------

variable "aws_region" {
  description = "AWS region to deploy into."
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Used to name and tag every resource."
  type        = string
  default     = "sa-generator"
}

variable "instance_type" {
  description = "t4g.micro (Graviton/ARM, cheapest) or t3.micro (x86) — either is plenty for a low-traffic internal tool."
  type        = string
  default     = "t4g.micro"
}

variable "key_name" {
  description = "Name of an EC2 key pair that already exists in this AWS account/region — used for SSH access."
  type        = string
}

variable "ssh_allowed_cidr" {
  description = "CIDR allowed to reach port 22, e.g. \"203.0.113.4/32\" — your own IP, never 0.0.0.0/0. No default on purpose: you must set this deliberately."
  type        = string
}

variable "root_volume_gb" {
  description = "Root EBS volume size in GB — 20GB covers the OS, app, Postgres data directory, and uploaded documents for a while."
  type        = number
  default     = 20
}

variable "db_name" {
  description = "PostgreSQL database name (installed natively on the instance, not RDS)."
  type        = string
  default     = "sagenerator"
}

variable "db_user" {
  description = "PostgreSQL app user."
  type        = string
  default     = "sagen"
}

variable "db_password" {
  description = "PostgreSQL password for db_user. No default on purpose — pass it via TF_VAR_db_password or a .tfvars file that isn't committed, never hardcode it here."
  type        = string
  sensitive   = true
}

variable "vpc_cidr" {
  description = "CIDR block for this app's dedicated VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the single public subnet the instance lives in."
  type        = string
  default     = "10.0.1.0/24"
}

variable "domain_name" {
  description = "Full hostname to point at this instance, e.g. \"app.yourdomain.com\". Leave empty to skip Route 53 entirely and just use the instance's Elastic IP (e.g. for testing before a domain is ready)."
  type        = string
  default     = ""
}

variable "route53_zone_name" {
  description = "Name of an existing Route 53 hosted zone, e.g. \"yourdomain.com\" — the parent zone domain_name lives in. Required only if domain_name is set."
  type        = string
  default     = ""
}

locals {
  create_dns = var.domain_name != "" && var.route53_zone_name != ""
}

# ---------------------------------------------------------------------------
# AMI — latest Ubuntu 24.04 LTS (Noble), arm64 to match t4g instance types.
# Published by Canonical (owner 099720109477, their well-known AWS account).
# ---------------------------------------------------------------------------

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# ---------------------------------------------------------------------------
# Networking — dedicated VPC (not the account's default one, which may hold
# unrelated resources from other projects) with a single public subnet.
# ---------------------------------------------------------------------------

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw"
  }
}

resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-subnet"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.project_name}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------------------
# Security group — nginx on the instance is the only thing exposed to the
# internet (80/443); SSH is restricted to a single CIDR. No load balancer, so
# no separate ALB security group.
# ---------------------------------------------------------------------------

resource "aws_security_group" "app" {
  name        = "${var.project_name}-sg"
  description = "nginx (80/443) exposed publicly, SSH restricted to a single CIDR"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP - nginx itself, and the certbot ACME HTTP-01 challenge"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "SSH - restricted to a single CIDR, never open to the internet"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_allowed_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-sg"
  }
}

# ---------------------------------------------------------------------------
# IAM — lets the instance read its own app secrets (DB URL, JWT secret, etc.)
# from SSM Parameter Store at deploy time instead of those living only in a
# hand-copied backend/.env file. Scoped to this app's own parameter path and
# read-only (ssm:PutParameter is deliberately not granted here — the one-time
# migration of existing secrets into SSM is done interactively with a
# temporarily broader policy, then narrowed back to this).
# ---------------------------------------------------------------------------

resource "aws_iam_role" "app" {
  name = "${var.project_name}-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Name = "${var.project_name}-instance-role"
  }
}

resource "aws_iam_role_policy" "app_ssm_read" {
  name = "${var.project_name}-ssm-read"
  role = aws_iam_role.app.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        # ssm:GetParametersByPath authorizes against the queried path itself,
        # not a child under it — needs both the bare path (for that call) and
        # the wildcard (for individual ssm:GetParameter calls on each key).
        Effect = "Allow"
        Action = ["ssm:GetParameter", "ssm:GetParametersByPath"]
        Resource = [
          "arn:aws:ssm:${var.aws_region}:*:parameter/${var.project_name}/prod",
          "arn:aws:ssm:${var.aws_region}:*:parameter/${var.project_name}/prod/*"
        ]
      },
      {
        # SecureString parameters are encrypted with the account's default
        # AWS-managed SSM key (alias/aws/ssm). IAM resource-matching on KMS
        # alias ARNs is unreliable, so this scopes kms:Decrypt the way AWS's
        # own SSM docs recommend instead: any key, but only when the call
        # actually originates from SSM decrypting a parameter on this role's
        # behalf — the tight scoping is the ssm:GetParameter* path above.
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "*"
        Condition = {
          StringEquals = { "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com" }
        }
      }
    ]
  })
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.project_name}-instance-profile"
  role = aws_iam_role.app.name
}

# ---------------------------------------------------------------------------
# EC2 instance — installs app runtime deps (Python, Node), PostgreSQL natively
# (no Docker, no RDS), nginx, and certbot; initializes Postgres and creates the
# app database/user; writes the nginx reverse-proxy config from
# docs/deployment/deploy-aws.md §6 (server_name is the real domain if one was given,
# otherwise nginx's "_" catch-all so plain-IP access still works).
#
# NOT automated here, on purpose: cloning the repo, building the app, the
# systemd units for the frontend/backend, and actually running
# `certbot --nginx -d <domain>` (needs DNS to have already propagated to the
# Elastic IP this same apply creates — racing that from user_data would fail
# unpredictably). Those stay the manual step-by-step in docs/deployment/deploy-aws.md.
# ---------------------------------------------------------------------------

resource "aws_instance" "app" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_gb
  }

  user_data = <<-EOF
    #!/bin/bash
    set -e
    export DEBIAN_FRONTEND=noninteractive

    # t4g.micro/t3.micro only has 1GB RAM and ships with no swap — `next build`
    # alone regularly exceeds that and gets SIGKILLed by the OOM killer. A 2GB
    # swapfile is enough headroom to get through the frontend build.
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab

    apt-get update -y
    apt-get install -y python3.12 python3.12-venv python3-pip git postgresql nginx certbot python3-certbot-nginx

    # Ubuntu 24.04's own nodejs package is v18, which is too old for
    # @tailwindcss/oxide (requires Node >= 20) and fails the frontend build with
    # a "Cannot find native binding" error. Install Node 20 LTS via NodeSource
    # instead of the apt-provided nodejs/npm packages.
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs

    # Ubuntu's postgresql package auto-initializes and starts a cluster on install
    # (unlike Amazon Linux's postgresqlNN-server, which needs an explicit initdb step).
    # Force TCP auth on 127.0.0.1 to scram-sha-256 regardless of whatever the
    # packaged default is — the app connects via a postgresql:// URL, not peer auth.
    # Path is 3 levels deep (/etc/postgresql/<version>/main/pg_hba.conf) — no maxdepth
    # limit here, a previous version of this script hardcoded maxdepth 2 and silently
    # matched nothing, which fed sed an empty filename and aborted the rest of the script.
    PG_HBA=$(find /etc/postgresql -name pg_hba.conf | head -n1)
    sed -i -E "s/^(host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1\/32[[:space:]]+)\S+$/\1scram-sha-256/" "$PG_HBA"
    systemctl restart postgresql

    sudo -u postgres psql -c "CREATE USER ${var.db_user} WITH PASSWORD '${var.db_password}';"
    sudo -u postgres createdb -O ${var.db_user} ${var.db_name}

    # Ubuntu's nginx package ships its own default site (also server_name "_") already
    # enabled on port 80 — remove it, or it silently wins the default_server slot over
    # ours and every request just serves nginx's stock welcome page instead of proxying.
    rm -f /etc/nginx/sites-enabled/default

    cat > /etc/nginx/conf.d/sagen.conf <<'NGINXCONF'
    server {
        listen 80 default_server;
        server_name ${var.domain_name != "" ? var.domain_name : "_"};

        location / {
            proxy_pass http://127.0.0.1:3000;
            proxy_set_header Host $host;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    NGINXCONF
    systemctl enable --now nginx
  EOF

  tags = {
    Name = var.project_name
  }
}

# The actual public entry point for the app (nginx listens here), not just SSH.
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-eip"
  }
}

# ---------------------------------------------------------------------------
# Route 53 — optional. Skipped entirely if domain_name or route53_zone_name
# is left unset, e.g. for testing straight against the Elastic IP.
# ---------------------------------------------------------------------------

data "aws_route53_zone" "this" {
  count = local.create_dns ? 1 : 0
  name  = var.route53_zone_name
}

resource "aws_route53_record" "app" {
  count   = local.create_dns ? 1 : 0
  zone_id = data.aws_route53_zone.this[0].zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [aws_eip.app.public_ip]
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "instance_id" {
  value = aws_instance.app.id
}

output "instance_ip" {
  description = "The app's public entry point (nginx listens here on 80/443) and SSH target."
  value       = aws_eip.app.public_ip
}

output "app_url" {
  description = "Where to reach the app once nginx (and, if a domain is set, certbot) is up."
  value       = var.domain_name != "" ? "https://${var.domain_name}" : "http://${aws_eip.app.public_ip}"
}

output "ssh_command" {
  value = "ssh -i <your-key.pem> ubuntu@${aws_eip.app.public_ip}"
}
