# CloudSolution Hub on AWS — single EC2 instance behind an ALB that terminates
# HTTPS. TLS lives ONLY at the load balancer: the instance itself serves
# plain HTTP on port 3000 (Next.js), never exposed directly to the internet.
# PostgreSQL runs natively on the same instance (no Docker, no RDS) — see
# docs/deploy_aws.md for that reasoning and the "when you outgrow this"
# upgrade path. Adding the ALB back in here does bring back its ~$16-20/mo
# baseline cost versus the nginx+certbot-on-the-instance variant in that doc
# — a deliberate tradeoff for managed certificate rotation and the standard
# AWS TLS-termination pattern.

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
  default     = "us-east-1"
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

variable "certificate_arn" {
  description = "ARN of an ACM certificate for your domain, already issued and validated (ACM certs are free — validate it via Route 53 or email before running this)."
  type        = string
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

# ---------------------------------------------------------------------------
# AMI — latest Amazon Linux 2023, arm64 to match t4g instance types
# ---------------------------------------------------------------------------

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-arm64"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

# ---------------------------------------------------------------------------
# Networking — default VPC/subnets, two security groups (ALB public, app
# reachable only from the ALB)
# ---------------------------------------------------------------------------

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_security_group" "alb" {
  name        = "${var.project_name}-alb-sg"
  description = "Public HTTPS/HTTP entry point — the only thing exposed to the internet"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP — redirected straight to HTTPS by the listener rule below"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.project_name}-alb-sg"
  }
}

resource "aws_security_group" "app" {
  name        = "${var.project_name}-sg"
  description = "App instance: port 3000 reachable only from the ALB, SSH restricted to a single CIDR"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "Next.js — only from the ALB, never directly from the internet"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description = "SSH — restricted to a single CIDR, never open to the internet"
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
# EC2 instance — installs app runtime deps (Python, Node) and PostgreSQL
# natively on the same instance (no Docker, no RDS), initializes it, and
# creates the app database/user. Cloning the repo, building the app, and
# setting up the systemd units for the frontend/backend is still the manual
# step-by-step in docs/deploy_aws.md, since that needs your actual repo URL,
# which this file can't know. TLS is handled entirely by the ALB, not here.
# ---------------------------------------------------------------------------

resource "aws_instance" "app" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  subnet_id              = data.aws_subnets.default.ids[0]
  vpc_security_group_ids = [aws_security_group.app.id]

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_gb
  }

  user_data = <<-EOF
    #!/bin/bash
    set -e
    dnf install -y python3.12 nodejs git postgresql16-server postgresql16

    postgresql-16-setup --initdb
    systemctl enable --now postgresql-16

    # Password auth over TCP (127.0.0.1 only) instead of the default "ident" —
    # the app connects via a postgresql:// URL, not the postgres OS user.
    sed -i -E 's/^(host[[:space:]]+all[[:space:]]+all[[:space:]]+127\.0\.0\.1\/32[[:space:]]+)ident$/\1scram-sha-256/' /var/lib/pgsql/data/pg_hba.conf
    systemctl restart postgresql-16

    sudo -u postgres psql -c "CREATE USER ${var.db_user} WITH PASSWORD '${var.db_password}';"
    sudo -u postgres createdb -O ${var.db_user} ${var.db_name}
  EOF

  tags = {
    Name = var.project_name
  }
}

# Kept for stable SSH access even though the app itself is now reached via
# the ALB, not this IP directly — free while attached to a running instance.
resource "aws_eip" "app" {
  instance = aws_instance.app.id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-eip"
  }
}

# ---------------------------------------------------------------------------
# Load balancer — this is where HTTPS terminates. The instance behind it
# only ever sees plain HTTP on port 3000.
# ---------------------------------------------------------------------------

resource "aws_lb" "app" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.default.ids
}

resource "aws_lb_target_group" "app" {
  name     = "${var.project_name}-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = data.aws_vpc.default.id

  health_check {
    path                = "/api/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
  }
}

resource "aws_lb_target_group_attachment" "app" {
  target_group_arn = aws_lb_target_group.app.arn
  target_id        = aws_instance.app.id
  port             = 3000
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

resource "aws_lb_listener" "http_redirect" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------

output "alb_dns_name" {
  description = "Point your Route 53 record (as an ALIAS, not a plain CNAME) at this."
  value       = aws_lb.app.dns_name
}

output "instance_ssh_ip" {
  description = "For SSH only — the app itself is reached through the ALB, not this IP."
  value       = aws_eip.app.public_ip
}

output "instance_id" {
  value = aws_instance.app.id
}

output "ssh_command" {
  value = "ssh -i <your-key.pem> ec2-user@${aws_eip.app.public_ip}"
}
