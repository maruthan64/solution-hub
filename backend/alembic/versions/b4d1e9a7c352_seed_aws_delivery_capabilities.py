"""seed AWS delivery capabilities from the practice capability matrix

Revision ID: b4d1e9a7c352
Revises: 7c6dd0c94313
Create Date: 2026-08-14 00:00:00.000000

Imports the full AWS capability catalog (90 entries across Infrastructure,
Networking & Security, Database, Migration, Applications, and Operations)
that previously only existed as a standalone HTML document
(aws-capabilities-master.html) never wired into the app. Ids are stable,
readable slugs (matching seed.py's convention) rather than random hex, so
this migration is easy to read a diff of and re-run safely — downgrade()
removes exactly these ids and nothing else.
"""
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4d1e9a7c352'
down_revision: Union[str, Sequence[str], None] = '7c6dd0c94313'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


CAPABILITIES = [
    # Infrastructure
    ("cap-cloud-readiness-assessment", "Cloud readiness assessment",
     "Current-state review of the estate and the target operating model — workload inventory, "
     "dependency and constraint mapping, and a costed target-state design with the migration "
     "approach recommended per workload.",
     ["Well-Architected Review", "Migration Evaluator", "TCO Analysis"]),
    ("cap-landing-zone-build", "Landing zone build",
     "The multi-account foundation workloads land on — account structure, guardrails, "
     "centralised logging, and the network and security baseline in place before the first "
     "workload arrives.",
     ["Landing Zone", "Organizations", "Log Archive"]),
    ("cap-aws-control-tower", "AWS Control Tower",
     "Governed account provisioning with controls applied at enrolment, so every new account "
     "starts compliant rather than being retrofitted.",
     ["Control Tower", "Account Factory", "Guardrails"]),
    ("cap-account-structure-and-organisational-units", "Account structure and organisational units",
     "OU design that reflects how the business is actually run, with service control policies "
     "expressing what each tier may do.",
     ["Organizations", "OUs", "SCPs"]),
    ("cap-identity-and-access-design", "Identity and access design",
     "Federated access from the corporate directory, role design per environment, and permission "
     "boundaries that survive an audit.",
     ["IAM Identity Center", "IAM Roles", "Permission Boundaries"]),
    ("cap-guardrails-and-policy", "Guardrails and policy",
     "Preventive and detective controls applied across accounts, with drift surfaced rather than "
     "discovered later.",
     ["SCPs", "Config", "Security Hub"]),
    ("cap-cost-governance", "Cost governance",
     "Tagging standards enforced at account level, budgets and alerts per environment, and "
     "periodic right-sizing review.",
     ["Cost Explorer", "Budgets", "Tag Policies"]),
    ("cap-compute-platform-build", "Compute platform build",
     "Instance sizing and image strategy, scaling policy, and the operating baseline applied to "
     "every server at launch.",
     ["EC2", "Auto Scaling", "Systems Manager"]),
    ("cap-infrastructure-as-code", "Infrastructure as Code",
     "Environments defined and version-controlled as code, so a rebuild produces the same result "
     "and changes are reviewable.",
     ["Terraform", "CloudFormation"]),
    ("cap-storage-design", "Storage design",
     "Block, file, and object storage selected against the access pattern, with lifecycle rules "
     "and encryption applied by default.",
     ["EBS", "EFS", "FSx", "S3"]),
    ("cap-active-directory-on-aws", "Active Directory on AWS",
     "Managed domain services in AWS with a trust back to the existing forest, so servers "
     "domain-join and group policy applies exactly as it did on-premises.",
     ["AWS Managed Microsoft AD", "AD Connector", "Forest Trust"]),
    ("cap-windows-file-services", "Windows file services",
     "SMB file shares with AD integration, DFS namespaces, and the share and NTFS permissions "
     "carried across from the existing file servers.",
     ["FSx for Windows File Server", "DFS Namespaces"]),
    ("cap-windows-server-migration-and-licensing", "Windows Server migration and licensing",
     "Move Windows workloads with the licensing position decided up front — license-included "
     "versus bring-your-own, and where dedicated hosts are required.",
     ["License Manager", "BYOL", "Dedicated Hosts"]),
    ("cap-sql-server-on-ec2", "SQL Server on EC2",
     "Self-managed SQL Server where RDS does not fit — Always On availability groups, custom "
     "instance configuration, and the licensing that goes with it.",
     ["SQL Server", "Always On", "License Mobility"]),

    # Networking & Security
    ("cap-on-premises-firewall-migration-to-aws", "On-premises firewall migration to AWS",
     "Move an existing perimeter onto AWS. We review and translate the rule base, retire what "
     "the estate has outgrown, then land it either on the vendor's virtual appliance in AWS or "
     "on AWS Network Firewall — whichever fits the operating model. Hands-on with Palo Alto and "
     "FortiGate estates.",
     ["Palo Alto VM-Series", "FortiGate VM", "AWS Network Firewall"]),
    ("cap-palo-alto-vm-series-on-aws", "Palo Alto VM-Series on AWS",
     "Deploy and configure VM-Series in AWS — HA pairs across Availability Zones, zone and NAT "
     "policy, Panorama management, and licensing.",
     ["VM-Series", "Panorama", "BYOL / PAYG"]),
    ("cap-fortigate-on-aws", "FortiGate on AWS",
     "FortiGate VM deployment with active-passive or active-active HA, and central management "
     "where the customer already runs FortiManager.",
     ["FortiGate VM", "FortiManager", "HA Pair"]),
    ("cap-aws-network-firewall", "AWS Network Firewall",
     "Native managed firewall as the inspection layer — stateless and stateful rule groups, "
     "Suricata-compatible rules, and a centralised inspection VPC.",
     ["Network Firewall", "Suricata Rules"]),
    ("cap-centralised-inspection-and-egress", "Centralised inspection and egress",
     "Route east-west and outbound traffic through a single inspection path, so appliance "
     "insertion is not repeated per VPC.",
     ["Gateway Load Balancer", "Inspection VPC"]),
    ("cap-application-layer-protection", "Application-layer protection",
     "Managed and custom rule sets in front of public applications, plus DDoS protection at the "
     "edge.",
     ["AWS WAF", "Shield"]),
    ("cap-threat-detection", "Threat detection",
     "Continuous detection across accounts with findings routed to an owner, so alerts are "
     "triaged rather than accumulated.",
     ["GuardDuty", "Security Hub", "EventBridge"]),
    ("cap-vulnerability-management", "Vulnerability management",
     "Automated scanning of instances and container images, with findings prioritised by "
     "exposure rather than raw CVE count.",
     ["Inspector", "ECR Scanning"]),
    ("cap-encryption-and-key-management", "Encryption and key management",
     "Customer-managed keys, rotation policy, and encryption at rest applied by default across "
     "storage, databases, and backups.",
     ["KMS", "Customer Managed Keys", "Key Rotation"]),
    ("cap-secrets-management", "Secrets management",
     "Application credentials held in a managed store with automatic rotation, so nothing "
     "sensitive lives in code or configuration files.",
     ["Secrets Manager", "Parameter Store"]),
    ("cap-audit-trail", "Audit trail",
     "Organisation-wide API logging to a separate, restricted account, with log file validation "
     "so the trail is defensible.",
     ["CloudTrail", "Organisation Trail", "Log Archive"]),
    ("cap-security-posture-and-compliance", "Security posture and compliance",
     "Config rules and posture scoring across accounts, with drift from the agreed baseline "
     "surfaced rather than discovered at audit.",
     ["Security Hub", "AWS Config", "Conformance Packs"]),
    ("cap-application-load-balancer", "Application Load Balancer",
     "Layer 7 distribution — host and path routing, TLS termination with managed certificates, "
     "target groups, and health checks tied to real application state.",
     ["ALB", "ACM", "Target Groups"]),
    ("cap-network-load-balancer", "Network Load Balancer",
     "Layer 4 distribution where static IPs, extreme throughput, or TLS passthrough are "
     "required.",
     ["NLB", "Static IP", "PrivateLink"]),
    ("cap-gateway-load-balancer", "Gateway Load Balancer",
     "Transparent insertion of third-party security appliances into the traffic path, with "
     "health checking and scaling of the appliance fleet.",
     ["GWLB", "GWLB Endpoints"]),
    ("cap-existing-load-balancer-migration", "Existing load balancer migration",
     "Translate configuration from existing hardware or virtual load balancers into the "
     "equivalent AWS listener, rule, and health-check design.",
     ["ALB", "NLB"]),
    ("cap-cloudfront-distribution-design", "CloudFront distribution design",
     "CDN in front of applications and static content — origin and cache behaviour design, TLS "
     "certificates, and origin access controls so the origin is not reachable directly.",
     ["CloudFront", "ACM", "Origin Access Control"]),
    ("cap-static-content-and-object-hosting", "Static content and object hosting",
     "Object storage as an origin, with lifecycle rules and the access model that goes with it.",
     ["S3", "CloudFront"]),
    ("cap-global-traffic-acceleration", "Global traffic acceleration",
     "Anycast entry points for non-HTTP workloads that need consistent global latency and fast "
     "regional failover.",
     ["Global Accelerator"]),
    ("cap-vpc-and-ip-address-design", "VPC and IP address design",
     "Subnet and CIDR planning across Availability Zones and accounts, sized for growth and free "
     "of overlap with the existing on-premises range.",
     ["VPC", "Subnets", "IPAM"]),
    ("cap-transit-gateway-architecture", "Transit Gateway architecture",
     "Multi-VPC and multi-account routing with route table segmentation, so environments stay "
     "separated without a mesh of peering connections.",
     ["Transit Gateway", "Route Tables", "RAM"]),
    ("cap-hybrid-connectivity", "Hybrid connectivity",
     "Connect AWS to the data centre and branch estate, with resilient paths and routing that "
     "fails over cleanly.",
     ["Direct Connect", "Site-to-Site VPN", "BGP"]),
    ("cap-private-service-access", "Private service access",
     "Reach AWS and partner services without traversing the internet, using endpoints in the "
     "consumer VPC.",
     ["PrivateLink", "VPC Endpoints"]),
    ("cap-outbound-access-control", "Outbound access control",
     "Managed egress with address translation and allow-listing, so outbound traffic is "
     "deliberate rather than default.",
     ["NAT Gateway", "Egress Filtering"]),
    ("cap-segmentation-controls", "Segmentation controls",
     "Security group and network ACL design that expresses the intended trust boundaries and "
     "stays reviewable.",
     ["Security Groups", "NACLs"]),
    ("cap-route-53-zones-and-records", "Route 53 zones and records",
     "Public and private hosted zones, split-horizon resolution, and record management as part "
     "of the cutover plan.",
     ["Route 53", "Private Hosted Zones"]),
    ("cap-hybrid-dns-resolution", "Hybrid DNS resolution",
     "Forwarding rules in both directions so AWS and on-premises resolve each other's names "
     "during and after migration.",
     ["Route 53 Resolver", "Inbound / Outbound Endpoints"]),
    ("cap-failover-and-weighted-routing", "Failover and weighted routing",
     "Health-check driven DNS routing for failover, weighted cutover, and latency-based "
     "distribution.",
     ["Health Checks", "Routing Policies"]),

    # Database
    ("cap-amazon-rds-build-and-configuration", "Amazon RDS build and configuration",
     "Provision and harden managed instances — Multi-AZ for resilience, parameter and option "
     "groups, backup retention, and maintenance windows agreed with the application owner.",
     ["RDS", "Multi-AZ", "SQL Server", "Oracle", "PostgreSQL", "MySQL"]),
    ("cap-aurora-clusters", "Aurora clusters",
     "Cluster design with reader endpoints and failover behaviour, where the workload justifies "
     "it over standard RDS.",
     ["Aurora PostgreSQL", "Aurora MySQL", "Reader Endpoints"]),
    ("cap-resilience-and-recovery-design", "Resilience and recovery design",
     "Standby topology and replica placement per workload, and the engine-level recovery "
     "procedure documented and rehearsed. Estate-wide backup policy and DR patterns are covered "
     "under Disaster Recovery & Backup.",
     ["Multi-AZ", "Read Replicas", "Point-in-Time Recovery"]),
    ("cap-engine-management", "Engine management",
     "Version and patch management within agreed maintenance windows, plus performance review "
     "using the platform's own instrumentation rather than guesswork.",
     ["Performance Insights", "Maintenance Windows", "Parameter Groups"]),
    ("cap-dynamodb", "DynamoDB",
     "Table and key design, capacity mode, and access patterns defined before the data model is "
     "fixed.",
     ["DynamoDB", "GSI", "On-Demand"]),
    ("cap-in-memory-caching", "In-memory caching",
     "Managed cache layer with the failover and eviction behaviour the application expects.",
     ["ElastiCache", "Redis", "Memcached"]),
    ("cap-application-search", "Application search",
     "Full-text and faceted search for applications — index and analyzer design, relevance "
     "tuning, and the shard strategy and cluster sizing that keep it stable as the index grows.",
     ["OpenSearch Service", "Index Design", "Relevance Tuning"]),
    ("cap-homogeneous-and-heterogeneous-migration", "Homogeneous and heterogeneous migration",
     "Migration with change data capture, so the cutover window is measured in minutes rather "
     "than hours.",
     ["DMS", "CDC", "Full Load + CDC"]),
    ("cap-schema-conversion", "Schema conversion",
     "Convert schema and stored logic when the target engine differs from the source, and work "
     "through what does not convert cleanly.",
     ["Schema Conversion Tool"]),
    ("cap-cutover-validation", "Cutover validation",
     "Row counts, checksums, and application-level verification before the source is retired.",
     ["Validation Tasks"]),

    # Migration
    ("cap-discovery-and-dependency-mapping", "Discovery and dependency mapping",
     "Server and application inventory with the traffic between them mapped, so nothing moves "
     "without the things it depends on.",
     ["Application Discovery Service", "Dependency Mapping"]),
    ("cap-wave-planning", "Wave planning",
     "Group workloads into waves by dependency and business risk, with a cutover schedule and "
     "rollback criteria per wave.",
     ["Wave Plan", "Runbooks"]),
    ("cap-server-migration", "Server migration",
     "Lift-and-shift of physical and virtual servers into AWS — replication, test cutover, then "
     "production cutover with a rollback path.",
     ["Application Migration Service (MGN)", "EC2"]),
    ("cap-migration-and-replication-infrastructure", "Migration and replication infrastructure",
     "Build and operate the replication servers and staging environment that carry the waves.",
     ["MGN Replication Servers", "Staging VPC"]),
    ("cap-cutover-management", "Cutover management",
     "Run the cutover — sequencing, validation checkpoints, and the decision to go or roll back.",
     ["Cutover Runbook"]),
    ("cap-vmware-workload-migration", "VMware workload migration",
     "Move virtual machines from vSphere onto native AWS compute, sized from real vCenter "
     "utilisation data rather than the allocation on paper.",
     ["vSphere", "MGN", "EC2"]),
    ("cap-hypervisor-estate-assessment", "Hypervisor estate assessment",
     "Export and analyse vCenter inventory to establish what is actually running, what is idle, "
     "and what can be retired instead of migrated.",
     ["vCenter Export", "Migration Evaluator"]),
    ("cap-vmware-cloud-on-aws", "VMware Cloud on AWS",
     "Where the customer wants to keep vSphere operationally, migrate the estate onto VMware "
     "running in AWS and modernise afterwards.",
     ["VMware Cloud on AWS", "HCX"]),
    ("cap-online-data-transfer", "Online data transfer",
     "Scheduled and incremental file and object transfer with verification, so the final sync "
     "before cutover is small.",
     ["DataSync", "S3", "EFS"]),
    ("cap-hybrid-file-access", "Hybrid file access",
     "On-premises access to AWS storage during the transition, so applications keep working "
     "while the data moves.",
     ["Storage Gateway", "File Gateway", "Volume Gateway"]),
    ("cap-offline-bulk-transfer", "Offline bulk transfer",
     "Physical transfer for large datasets or sites where the link cannot carry the volume in "
     "the available window.",
     ["Snowball Edge"]),
    ("cap-managed-file-transfer", "Managed file transfer",
     "Replace existing SFTP and FTPS servers with a managed endpoint backed by object storage.",
     ["Transfer Family", "SFTP", "FTPS"]),

    # Applications
    ("cap-solution-design-and-architecture", "Solution design and architecture",
     "Target-state architecture for the workload, with the trade-offs behind each decision and "
     "the cost profile it implies stated up front.",
     ["Well-Architected Review"]),
    ("cap-application-development-and-modernisation", "Application development and modernisation",
     "Build new services on AWS, or refactor existing applications toward managed and "
     "container-based platforms.",
     ["ECS", "Lambda", "API Gateway"]),
    ("cap-delivery-pipelines", "Delivery pipelines",
     "Build and release automation so changes reach production the same way every time.",
     ["CodePipeline", "GitHub Actions"]),
    ("cap-application-email-delivery", "Application email delivery",
     "Outbound email for applications — sending domain and identity verification, DKIM and SPF "
     "records, and reputation monitoring so mail is not silently dropped.",
     ["SES", "DKIM", "SPF"]),
    ("cap-application-identity-and-sign-in", "Application identity and sign-in",
     "End-user authentication for customer-facing applications — sign-up and sign-in flows, "
     "federation with social or enterprise identity providers, multi-factor, and token handling. "
     "Separate concern from the staff and workload access covered under Identity & Governance.",
     ["Cognito", "User Pools", "OIDC / SAML"]),
    ("cap-amazon-eks-cluster-build", "Amazon EKS cluster build",
     "Managed Kubernetes clusters with the networking, node strategy, and pod-level IAM decided "
     "up front, so the platform can be upgraded without a rebuild.",
     ["EKS", "VPC CNI", "IRSA", "Managed Node Groups"]),
    ("cap-amazon-ecs-and-fargate", "Amazon ECS and Fargate",
     "Container workloads where a full Kubernetes platform is more than the application needs — "
     "task definitions, service discovery, and serverless compute.",
     ["ECS", "Fargate", "Cloud Map"]),
    ("cap-image-pipeline-and-registry", "Image pipeline and registry",
     "Private registry with vulnerability scanning on push and a promotion path from build "
     "through to production.",
     ["ECR", "Image Scanning"]),
    ("cap-cluster-operations", "Cluster operations",
     "Version upgrades within the supported window, node autoscaling, and cluster-level "
     "observability handed over with the platform.",
     ["Karpenter", "Cluster Autoscaler", "Container Insights"]),
    ("cap-queuing-and-notification", "Queuing and notification",
     "Decouple services with managed queues and publish-subscribe messaging, including "
     "dead-letter queues so one malformed message cannot stall everything behind it.",
     ["SQS", "SNS", "Dead-Letter Queues"]),
    ("cap-workflow-orchestration", "Workflow orchestration",
     "Long-running and multi-step processes modelled as a state machine, with retries, "
     "timeouts, and error paths declared rather than hand-coded — and the current step visible "
     "while it runs.",
     ["Step Functions", "State Machines"]),
    ("cap-event-routing", "Event routing",
     "Route events between AWS services, custom applications, and SaaS products using rules "
     "rather than point-to-point integrations, so adding a consumer does not mean changing the "
     "producer.",
     ["EventBridge", "Event Rules", "Schema Registry"]),
    ("cap-data-streaming", "Data streaming",
     "Ingest continuous high-volume data — telemetry, clickstream, application events — with "
     "multiple independent consumers and the ability to replay a window if a consumer fails.",
     ["Kinesis Data Streams", "Kinesis Firehose"]),

    # Operations
    ("cap-post-migration-support", "Post-migration support",
     "Hypercare through the period after cutover, then ongoing run support once the estate is "
     "steady.",
     ["Hypercare", "Managed Services"]),
    ("cap-monitoring-and-alerting", "Monitoring and alerting",
     "Metric and log pipelines, with alerts that map to an owner and a documented response.",
     ["CloudWatch", "EventBridge"]),
    ("cap-patching-and-maintenance", "Patching and maintenance",
     "Patch baselines and maintenance windows agreed per environment, applied on a schedule "
     "rather than on demand.",
     ["Systems Manager Patch Manager"]),
    ("cap-centralised-logging", "Centralised logging",
     "Application, system, and platform logs collected into a central account with retention "
     "set per log type rather than one blanket policy.",
     ["CloudWatch Logs", "Log Archive Account", "Retention Policies"]),
    ("cap-api-and-audit-logging", "API and audit logging",
     "Organisation-wide API activity captured to restricted storage, so the record is available "
     "even if the source account is compromised.",
     ["CloudTrail", "S3 Object Lock"]),
    ("cap-log-analytics-and-search", "Log analytics and search",
     "Searchable log storage with dashboards, for the cases where native log queries are not "
     "enough — index lifecycle management moving older data onto cheaper storage, and retention "
     "set per index rather than one blanket rule.",
     ["OpenSearch Service", "OpenSearch Dashboards", "Index State Management"]),
    ("cap-siem-integration", "SIEM integration",
     "Forward logs and security findings into the customer's existing SIEM rather than asking "
     "them to watch a second console.",
     ["Splunk", "Kinesis Firehose", "Security Hub"]),
    ("cap-dashboards-and-alerting", "Dashboards and alerting",
     "Metrics that reflect what the business cares about, with alerts that map to an owner and "
     "a documented response.",
     ["CloudWatch Dashboards", "Alarms", "EventBridge"]),
    ("cap-dr-strategy-and-design", "DR strategy and design",
     "Recovery objectives agreed per workload, then the pattern chosen to match — backup and "
     "restore, pilot light, warm standby, or active-active — rather than one approach applied "
     "to everything.",
     ["RPO / RTO", "Pilot Light", "Warm Standby"]),
    ("cap-aws-elastic-disaster-recovery", "AWS Elastic Disaster Recovery",
     "Continuous replication of servers into a recovery region, with failover and failback both "
     "tested before the plan is signed off.",
     ["Elastic Disaster Recovery (DRS)", "Failover", "Failback"]),
    ("cap-centralised-backup", "Centralised backup",
     "Backup policy applied across accounts and services from one place, with cross-region and "
     "cross-account copies for isolation.",
     ["AWS Backup", "Cross-Region Copy", "Cross-Account Copy"]),
    ("cap-immutable-backup", "Immutable backup",
     "Retention that cannot be shortened or deleted by a compromised account — the control that "
     "matters when the incident is ransomware.",
     ["Vault Lock", "S3 Object Lock"]),
    ("cap-recovery-testing", "Recovery testing",
     "Scheduled restore and failover tests with the results documented, so the recovery time "
     "quoted to the business is one that has actually been measured.",
     ["DR Runbook", "Restore Testing"]),
]


capabilities_table = sa.table(
    "capabilities",
    sa.column("id", sa.String),
    sa.column("name", sa.String),
    sa.column("cloud", sa.String),
    sa.column("description", sa.Text),
    sa.column("key_services", sa.JSON),
    sa.column("status", sa.String),
    sa.column("github_url", sa.String),
    sa.column("certifications", sa.JSON),
    sa.column("case_studies", sa.JSON),
    sa.column("updated_at", sa.DateTime),
)


def upgrade() -> None:
    """Insert the 90 AWS capability entries, skipping any id already present
    (belt-and-braces — ids are unique to this migration, so this only
    matters if it is ever re-run against a DB that already has them)."""
    conn = op.get_bind()
    existing_ids = {
        row[0] for row in conn.execute(sa.text("SELECT id FROM capabilities")).fetchall()
    }
    now = datetime.now(timezone.utc)
    rows = [
        {
            "id": cap_id,
            "name": name,
            "cloud": "AWS",
            "description": description,
            "key_services": key_services,
            "status": "Active",
            "github_url": None,
            "certifications": [],
            "case_studies": [],
            "updated_at": now,
        }
        for cap_id, name, description, key_services in CAPABILITIES
        if cap_id not in existing_ids
    ]
    if rows:
        op.bulk_insert(capabilities_table, rows)


def downgrade() -> None:
    """Remove exactly the ids this migration added."""
    ids = [cap_id for cap_id, *_ in CAPABILITIES]
    conn = op.get_bind()
    conn.execute(
        sa.text("DELETE FROM capabilities WHERE id IN :ids").bindparams(
            sa.bindparam("ids", expanding=True)
        ),
        {"ids": ids},
    )
