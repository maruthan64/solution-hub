from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import (
    AuditEntry,
    Capability,
    DocTemplate,
    GeneratedDocument,
    KnowledgeDoc,
    Project,
    ServicePackage,
    SolutionPackage,
    User,
)

# Official Well-Architected pillar names per cloud, used to ground each SDD
# variant in that vendor's actual framework rather than a generic swap:
#   AWS   -> https://aws.amazon.com/architecture/well-architected/
#   Azure -> https://learn.microsoft.com/en-us/azure/well-architected/pillars
#   GCP   -> https://docs.cloud.google.com/architecture/framework
WELL_ARCHITECTED_PILLARS = {
    "AWS": {
        "source": "AWS Well-Architected Framework",
        "url": "https://aws.amazon.com/architecture/well-architected/",
        "pillars": [
            "Operational Excellence",
            "Security",
            "Reliability",
            "Performance Efficiency",
            "Cost Optimization",
            "Sustainability",
        ],
    },
    "Azure": {
        "source": "Microsoft Azure Well-Architected Framework",
        "url": "https://learn.microsoft.com/en-us/azure/well-architected/pillars",
        "pillars": [
            "Reliability",
            "Security",
            "Cost Optimization",
            "Operational Excellence",
            "Performance Efficiency",
        ],
    },
    "GCP": {
        "source": "Google Cloud Well-Architected Framework",
        "url": "https://docs.cloud.google.com/architecture/framework",
        "pillars": [
            "Operational Excellence",
            "Security, Privacy, and Compliance",
            "Reliability",
            "Cost Optimization",
            "Performance Optimization",
            "Sustainability",
        ],
    },
}


def well_architected_section(cloud: str) -> str:
    fw = WELL_ARCHITECTED_PILLARS[cloud]
    checklist = "\n".join(f"- [ ] **{pillar}**: [How this design addresses it.]" for pillar in fw["pillars"])
    return f"""## 3. {fw['source']} Alignment
- **Reference**: [{fw['source']}]({fw['url']})
{checklist}
"""


# Adapted from the "Software Design Document (SDD)" gist by iamhenry:
# https://gist.github.com/iamhenry/2dbabd0d59051eae360d8cfa6a2782bd
def sdd_content(cloud: str) -> str:
    return f"""# Solution Design Document (SDD)

## 1. Introduction
- **Purpose**: [Describe the purpose of this document. E.g., to define the design of the XYZ system.]
- **Scope**: [Summarize the system's objectives and what is in/out of scope.]
- **Definitions and Acronyms**: [List and define important terms.]
- **References**: [Link to related documents: requirements, API specs, etc.]

---

## 2. System Overview
- **System Description**: [High-level overview of the system.]
- **Design Goals**: [E.g., scalability, maintainability, security.]
- **Architecture Summary**: [Monolith, microservices, serverless, etc.]
- **System Context Diagram**:
  - *Use Mermaid diagram here.*

---

{well_architected_section(cloud)}
---

## 4. Architectural Design
- **System Architecture Diagram**:
  - *Use Mermaid diagram here.*
- **Component Breakdown**:
  - [Component 1]: [Responsibilities, interactions.]
  - [Component 2]: [Responsibilities, interactions.]
- **Technology Stack**: [Languages, frameworks, databases.]
- **Data Flow and Control Flow**:
  - *Use Mermaid sequence or flow diagrams here.*

---

## 5. Detailed Design
For each module/component:

### [Component Name]
- **Responsibilities**: [What does it do?]
- **Interfaces/APIs**: [Inputs, outputs, error handling.]
- **Data Structures**: [Key models/schemas.]
- **Algorithms/Logic**: [Design patterns or important logic.]
- **State Management**: [How is state handled?]

---

## 6. Networking and IAM
- **VPC / CIDR Design**: [Address ranges, subnets, routing.]
- **IAM Roles and Policies**: [Least-privilege roles per component.]
- **Security Groups / Firewall Rules**: [Ingress/egress rules.]

---

## 7. Security Considerations
- **Authentication**: [Method used.]
- **Authorization**: [Role/permission models.]
- **Data Protection**: [Encryption in transit and at rest.]
- **Compliance**: [GDPR, HIPAA, etc.]

---

## 8. Performance and Scalability
- **Expected Load**: [Requests per second, data volume.]
- **Caching Strategy**: [Describe caches used.]
- **Scaling Strategy**: [Vertical/horizontal, auto-scaling policy.]

---

## 9. Deployment Architecture
- **Environments**: [Dev, staging, production.]
- **CI/CD Pipeline**: [Tools and stages.]
- **Infrastructure Diagram**:
  - *Use Mermaid diagram here.*
- **Cloud/Hosting**: {cloud}
- **Containerization/Orchestration**: [Docker, Kubernetes, etc.]

---

## 10. Disaster Recovery and Backup
- **RTO / RPO Targets**: [Define targets.]
- **Backup Strategy**: [Frequency, retention, storage location.]
- **Failover Plan**: [Multi-AZ / multi-region strategy.]

---

## 11. Cost Estimate
- **Monthly Cost Breakdown**: [By service.]
- **Cost Optimization Notes**: [Reserved instances, savings plans.]

---

## 12. Deployment and Rollback
- **Deployment Steps**: [Ordered steps.]
- **Rollback Plan**: [How to revert safely.]

---

## 13. Testing Strategy
- **Unit / Integration / E2E Testing**: [Tools, coverage goals.]

---

## 14. Appendices
- **Diagrams**: [All referenced diagrams.]
- **Glossary**: [Terms and definitions.]
- **Change History**: [Version, Date, Author, Changes]

---

> **Tip**: Use Mermaid diagrams throughout to make architecture, data flow, and interfaces clear and easy to maintain.
"""


# Canonical ADR template by Michael Nygard:
# https://github.com/joelparkerhenderson/architecture-decision-record
ADR_CONTENT = """# [short title of solution decision]

## Status

What is the status, such as proposed, accepted, rejected, deprecated, superseded, etc.?

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult to do because of this change?
"""

MIGRATION_CONTENT = """# Migration Document

## 1. Current State
- **Existing Architecture**: [Describe current systems.]
- **Pain Points**: [Why migrate?]

## 2. Target State
- **Proposed Architecture**: [Describe the destination.]
- **Benefits**: [Cost, performance, scalability.]

## 3. Migration Strategy
- **Approach**: [Rehost, replatform, refactor, etc.]
- **Phases**: [Wave plan.]

## 4. Cutover Plan
- **Steps**: [Ordered cutover steps.]
- **Downtime Window**: [Expected duration.]
- **Rollback Plan**: [How to revert.]

## 5. Validation
- **Smoke Tests**: [Post-migration checks.]
- **Sign-off Criteria**: [Who approves cutover completion.]
"""

BOM_CONTENT = """# Bill of Materials

| Service | Quantity | Purpose |
|---|---|---|
| VPC | 1 | Network |
| Public Subnet | 2 | Load Balancer |
| Private Subnet | 4 | Compute |
| NAT Gateway | 2 | Outbound internet access |
| Compute Cluster | 1 | Application workloads |
| Load Balancer | 1 | Ingress |
| Certificate | 1 | HTTPS |
| DNS Zone | 1 | Domain routing |
| Monitoring | 1 | Observability |
"""

RUNBOOK_CONTENT = """# Deployment Runbook

## 1. Prerequisites
- [Access, credentials, tooling versions required.]

## 2. Terraform Commands
```bash
terraform init
terraform plan -out=tfplan
terraform apply tfplan
```

## 3. Validation
- [What to check after apply completes.]

## 4. Rollback
- [How to revert to the previous known-good state.]

## 5. Smoke Test
- [Minimal checks to confirm the environment is healthy.]
"""

HANDOVER_CONTENT = """# Handover Document

## 1. Environment Details
- [Accounts/subscriptions, regions, naming conventions.]

## 2. Access
- [How to request access, roles, break-glass procedure.]

## 3. Contacts
- [Owning team, escalation path.]

## 4. Repository
- [Source repo links, branching strategy.]

## 5. CI/CD
- [Pipeline links, deployment triggers.]

## 6. Known Issues
- [Open items, workarounds, tracked tickets.]
"""

RISK_REGISTER_CONTENT = """# Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|---|---|---|---|---|---|
| R-1 | [Describe risk] | Low/Medium/High | Low/Medium/High | [Mitigation plan] | [Name] |
"""

ADR_004_CONTENT = """# ADR-004: ALB vs NLB Ingress

## Status
Accepted

## Context
The EKS Multi-Region Platform needs a Kubernetes ingress layer capable of terminating HTTPS at the edge, routing
based on host/path, and integrating with AWS WAF. Both an Application Load Balancer (ALB, Layer 7, via the AWS
Load Balancer Controller's Ingress resource) and a Network Load Balancer (NLB, Layer 4) were evaluated.

## Decision
Use ALB as the primary ingress for all HTTP/HTTPS workloads across both regions, provisioned via the AWS Load
Balancer Controller.

## Consequences
- Host/path-based routing and native WAF integration become straightforward.
- TLS termination is centralized at the ALB, simplifying certificate management via ACM.
- Workloads needing raw TCP/UDP or extreme low-latency (non-HTTP) will still use a dedicated NLB alongside the ALB.
- Slightly higher cost than NLB-only, accepted for the operational simplicity gained.
"""

COST_ESTIMATE_CONTENT = """# Monthly Cost Estimate

## GKE Data Platform Migration — GCP

| Service | Est. Monthly Cost | Notes |
|---|---|---|
| GKE Cluster (Autopilot) | $450 | Control plane + pooled compute |
| Compute Engine (n2-standard-4 x 6) | $1,050 | Data processing nodes |
| Cloud SQL (PostgreSQL, HA) | $620 | Primary metadata store |
| BigQuery | $380 | Analytics queries, on-demand pricing |
| Cloud Storage | $90 | Data lake, standard tier |
| Cloud Load Balancing | $45 | HTTP(S) load balancer |
| Cloud Monitoring & Logging | $60 | Observability |
| **Total** | **$2,695/mo** | |

## Notes
- Estimate assumes steady-state production load; the migration/dual-run period will run ~15% higher for 4-6 weeks.
- Committed-use discounts (1-year) could reduce Compute Engine and Cloud SQL costs by roughly 25%.
"""


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add_all(
                [
                    User(
                        id="u-1",
                        username="admin",
                        name="M. Maruthan",
                        email="maruthan64@gmail.com",
                        role="Owner",
                        status="Active",
                        password_hash=hash_password("admin123"),
                    ),
                    User(id="u-2", name="S. Iyer", email="s.iyer@example.com", role="Architect", status="Active"),
                    User(id="u-3", name="R. Chen", email="r.chen@example.com", role="Reviewer", status="Active"),
                    User(id="u-4", name="A. Patel", email="a.patel@example.com", role="Viewer", status="Invited"),
                ]
            )

        if db.query(Project).count() == 0:
            db.add_all(
                [
                    Project(id="prj-101", name="EKS Multi-Region Platform", customer="Northwind Retail", cloud="AWS", status="In Review", owner="M. Maruthan", updated="2026-08-01", docs_generated=6),
                    Project(id="prj-102", name="AKS Landing Zone", customer="Contoso Health", cloud="Azure", status="Draft", owner="M. Maruthan", updated="2026-07-29", docs_generated=2),
                    Project(id="prj-103", name="GKE Data Platform Migration", customer="Fabrikam Logistics", cloud="GCP", status="Approved", owner="S. Iyer", updated="2026-07-22", docs_generated=9),
                    Project(id="prj-104", name="Hybrid DR - VPN + Transit GW", customer="Northwind Retail", cloud="AWS", status="Approved", owner="M. Maruthan", updated="2026-07-18", docs_generated=5),
                    Project(id="prj-105", name="Shared Services Landing Zone", customer="Globex Corp", cloud="Multi-Cloud", status="Archived", owner="R. Chen", updated="2026-06-30", docs_generated=11),
                ]
            )

        if db.query(GeneratedDocument).count() == 0:
            db.add_all(
                [
                    GeneratedDocument(id="doc-1", project="EKS Multi-Region Platform", type="SDD", title="Solution Design Document", version="v1.3", updated="2026-08-01", status="Draft", content=sdd_content("AWS")),
                    GeneratedDocument(id="doc-2", project="EKS Multi-Region Platform", type="BOM", title="Bill of Materials", version="v1.1", updated="2026-07-31", status="Draft", content=BOM_CONTENT),
                    GeneratedDocument(id="doc-3", project="EKS Multi-Region Platform", type="ADR", title="ADR-004: ALB vs NLB Ingress", version="v1.0", updated="2026-07-30", status="Final", content=ADR_004_CONTENT),
                    GeneratedDocument(id="doc-4", project="GKE Data Platform Migration", type="Cost Estimate", title="Monthly Cost Estimate", version="v2.0", updated="2026-07-22", status="Final", content=COST_ESTIMATE_CONTENT),
                    GeneratedDocument(id="doc-5", project="Hybrid DR - VPN + Transit GW", type="Runbook", title="Deployment Runbook", version="v1.0", updated="2026-07-18", status="Final", content=RUNBOOK_CONTENT),
                    GeneratedDocument(id="doc-6", project="Shared Services Landing Zone", type="Handover", title="Handover Document", version="v1.4", updated="2026-06-30", status="Final", content=HANDOVER_CONTENT),
                ]
            )

        if db.query(DocTemplate).count() == 0:
            sdd_source = ("iamhenry/Software-Design-Document-Template", "https://gist.github.com/iamhenry/2dbabd0d59051eae360d8cfa6a2782bd")
            db.add_all(
                [
                    DocTemplate(id="tpl-1", name="AWS Solution Design Document", cloud="AWS", sections=14, description="Full SDD covering architecture, security, networking, IAM, DR, and cost — with an AWS Well-Architected Framework alignment checklist.", source_label=sdd_source[0], source_url=sdd_source[1], content=sdd_content("AWS")),
                    DocTemplate(id="tpl-2", name="Azure Solution Design Document", cloud="Azure", sections=14, description="SDD tailored to Azure landing zone and governance conventions — with an Azure Well-Architected Framework alignment checklist.", source_label=sdd_source[0], source_url=sdd_source[1], content=sdd_content("Azure")),
                    DocTemplate(id="tpl-3", name="GCP Solution Design Document", cloud="GCP", sections=14, description="SDD covering VPC design, IAM, GKE, and BigQuery patterns — with a Google Cloud Well-Architected Framework alignment checklist.", source_label=sdd_source[0], source_url=sdd_source[1], content=sdd_content("GCP")),
                    DocTemplate(id="tpl-4", name="Migration Document", cloud="Any", sections=5, description="Current-state to target-state migration plan with cutover steps.", content=MIGRATION_CONTENT),
                    DocTemplate(id="tpl-5", name="Bill of Materials", cloud="Any", sections=1, description="Resource-by-resource inventory with quantity and purpose.", content=BOM_CONTENT),
                    DocTemplate(id="tpl-6", name="Deployment Runbook", cloud="Any", sections=5, description="Prerequisites, Terraform commands, validation, rollback, smoke test.", content=RUNBOOK_CONTENT),
                    DocTemplate(id="tpl-7", name="Handover Document", cloud="Any", sections=6, description="Environment details, access, contacts, repo, CI/CD, known issues.", content=HANDOVER_CONTENT),
                    DocTemplate(id="tpl-8", name="Risk Register", cloud="Any", sections=1, description="Structured risk log with likelihood, impact, and mitigation.", content=RISK_REGISTER_CONTENT),
                    DocTemplate(id="tpl-9", name="Architecture Decision Record", cloud="Any", sections=4, description="Problem, options, decision, pros, cons, risks.", source_label="Michael Nygard's ADR template", source_url="https://github.com/joelparkerhenderson/architecture-decision-record", content=ADR_CONTENT),
                ]
            )

        if db.query(KnowledgeDoc).count() == 0:
            db.add_all(
                [
                    KnowledgeDoc(id="kb-1", name="AWS Well-Architected Framework - Internal Notes.pdf", category="Best Practices", uploaded_by="M. Maruthan", uploaded="2026-07-10", size="1.2 MB"),
                    KnowledgeDoc(id="kb-2", name="Terraform Module Standards v3.docx", category="Terraform Standards", uploaded_by="S. Iyer", uploaded="2026-07-12", size="340 KB"),
                    KnowledgeDoc(id="kb-3", name="Company Naming Conventions.md", category="Naming Standards", uploaded_by="M. Maruthan", uploaded="2026-06-28", size="18 KB"),
                    KnowledgeDoc(id="kb-4", name="Security Baseline - CIS Benchmarks.pdf", category="Security Standards", uploaded_by="R. Chen", uploaded="2026-06-15", size="2.4 MB"),
                    KnowledgeDoc(id="kb-5", name="Network CIDR Allocation Policy.docx", category="Networking Standards", uploaded_by="S. Iyer", uploaded="2026-05-30", size="96 KB"),
                ]
            )

        if db.query(AuditEntry).count() == 0:
            db.add_all(
                [
                    AuditEntry(id="a-1", actor="M. Maruthan", action="Generated document", target="SDD - EKS Multi-Region Platform v1.3", timestamp="2026-08-01 14:22"),
                    AuditEntry(id="a-2", actor="M. Maruthan", action="Logged in", target="-", timestamp="2026-08-01 09:03"),
                    AuditEntry(id="a-3", actor="S. Iyer", action="Uploaded knowledge base file", target="Terraform Module Standards v3.docx", timestamp="2026-07-12 11:47"),
                    AuditEntry(id="a-4", actor="R. Chen", action="Approved document", target="Handover Document - Shared Services Landing Zone", timestamp="2026-06-30 16:05"),
                    AuditEntry(id="a-5", actor="A. Patel", action="Invited to organization", target="a.patel@example.com", timestamp="2026-06-20 10:00"),
                ]
            )

        if db.query(ServicePackage).count() == 0:
            db.add_all(
                [
                    ServicePackage(
                        id="basic",
                        category="tier",
                        name="Basic",
                        tagline="Lift-and-shift migration bundle for small estates - 5 VMs, single AZ, with connectivity and backup included.",
                        monthly_price="$900/mo (estimate - confirm pricing)",
                        resources=[
                            {"service": "Virtual Machine (t3.large)", "quantity": 5, "purpose": "Migrated application workloads"},
                            {"service": "VPC", "quantity": 1, "purpose": "Network isolation"},
                            {"service": "Subnets (1 public + 1 private)", "quantity": 2, "purpose": "Network segmentation"},
                            {"service": "Application Load Balancer", "quantity": 1, "purpose": "Traffic distribution across migrated VMs"},
                            {"service": "RDS (single-AZ, db.t3.medium)", "quantity": 1, "purpose": "Relational database"},
                            {"service": "CloudWatch Monitoring", "quantity": 1, "purpose": "Infrastructure and application monitoring"},
                            {"service": "AWS Backup", "quantity": 1, "purpose": "Automated backup and retention"},
                            {"service": "VPN Gateway or Direct Connect (customer choice)", "quantity": 1, "purpose": "Secure connectivity back to the customer network"},
                            {"service": "S3 or Storage Gateway (customer choice)", "quantity": 1, "purpose": "Backup and archival storage"},
                        ],
                    ),
                    ServicePackage(
                        id="intermediate",
                        category="tier",
                        name="Intermediate",
                        tagline="Lift-and-shift migration bundle for mid-size estates - 15 VMs across two AZs, with connectivity and backup included.",
                        monthly_price="$2,200/mo (estimate - confirm pricing)",
                        resources=[
                            {"service": "Virtual Machine (t3.large)", "quantity": 15, "purpose": "Migrated application workloads"},
                            {"service": "VPC", "quantity": 1, "purpose": "Network isolation"},
                            {"service": "Subnets (2 public + 2 private, 2 AZs)", "quantity": 4, "purpose": "Multi-AZ network segmentation"},
                            {"service": "Application Load Balancer", "quantity": 1, "purpose": "Traffic distribution across migrated VMs"},
                            {"service": "RDS (Multi-AZ, db.r5.large)", "quantity": 1, "purpose": "Highly available relational database"},
                            {"service": "NAT Gateway", "quantity": 2, "purpose": "Outbound internet access per AZ"},
                            {"service": "CloudWatch Monitoring", "quantity": 1, "purpose": "Infrastructure and application monitoring"},
                            {"service": "AWS Backup", "quantity": 1, "purpose": "Automated backup and retention"},
                            {"service": "VPN Gateway or Direct Connect (customer choice)", "quantity": 1, "purpose": "Secure connectivity back to the customer network"},
                            {"service": "S3 or Storage Gateway (customer choice)", "quantity": 1, "purpose": "Backup and archival storage"},
                        ],
                    ),
                    ServicePackage(
                        id="advanced",
                        category="tier",
                        name="Advanced",
                        tagline="Lift-and-shift migration bundle for large estates - 20 VMs across two AZs, HA database, with connectivity and backup included.",
                        monthly_price="$2,900/mo (estimate - confirm pricing)",
                        resources=[
                            {"service": "Virtual Machine (t3.xlarge)", "quantity": 20, "purpose": "Migrated application workloads"},
                            {"service": "VPC (2 AZs)", "quantity": 1, "purpose": "Network isolation"},
                            {"service": "Subnets (2 public + 2 private, 2 AZs)", "quantity": 4, "purpose": "Multi-AZ network segmentation"},
                            {"service": "Application Load Balancer", "quantity": 1, "purpose": "Traffic distribution across migrated VMs"},
                            {"service": "RDS (Multi-AZ, db.r5.xlarge)", "quantity": 1, "purpose": "Highly available relational database"},
                            {"service": "NAT Gateway", "quantity": 2, "purpose": "Outbound internet access per AZ"},
                            {"service": "CloudWatch Monitoring", "quantity": 1, "purpose": "Infrastructure and application monitoring"},
                            {"service": "AWS Backup", "quantity": 1, "purpose": "Automated backup and retention"},
                            {"service": "VPN Gateway or Direct Connect (customer choice)", "quantity": 1, "purpose": "Secure connectivity back to the customer network"},
                            {"service": "S3 or Storage Gateway (customer choice)", "quantity": 1, "purpose": "Backup and archival storage"},
                        ],
                    ),
                    ServicePackage(
                        id="eks-service",
                        category="container",
                        name="EKS as a Service",
                        tagline="Managed Kubernetes for teams that need full container orchestration control.",
                        monthly_price="$600/mo",
                        resources=[
                            {"service": "EKS Cluster", "quantity": 1, "purpose": "Managed Kubernetes control plane"},
                            {"service": "Node Group (system)", "quantity": 1, "purpose": "Cluster add-ons and system workloads"},
                            {"service": "Node Group (application)", "quantity": 1, "purpose": "Application workloads, autoscaling"},
                            {"service": "ALB Ingress Controller", "quantity": 1, "purpose": "Kubernetes ingress"},
                            {"service": "ECR Repository", "quantity": 1, "purpose": "Container image registry"},
                            {"service": "Cluster Autoscaler", "quantity": 1, "purpose": "Automatic node scaling"},
                            {"service": "CloudWatch Container Insights", "quantity": 1, "purpose": "Cluster and pod-level monitoring"},
                        ],
                    ),
                    ServicePackage(
                        id="ecs-service",
                        category="container",
                        name="ECS as a Service",
                        tagline="Simpler, serverless container hosting with less operational overhead than EKS.",
                        monthly_price="$350/mo",
                        resources=[
                            {"service": "ECS Cluster (Fargate)", "quantity": 1, "purpose": "Serverless container orchestration"},
                            {"service": "ECS Service + Task Definitions", "quantity": 1, "purpose": "Application deployment unit"},
                            {"service": "Application Load Balancer", "quantity": 1, "purpose": "Ingress and traffic distribution"},
                            {"service": "ECR Repository", "quantity": 1, "purpose": "Container image registry"},
                            {"service": "CloudWatch Container Insights", "quantity": 1, "purpose": "Task and service-level monitoring"},
                            {"service": "Auto Scaling Policy", "quantity": 1, "purpose": "Scale tasks based on load"},
                        ],
                    ),
                    ServicePackage(
                        id="apprunner-service",
                        category="container",
                        name="App Runner as a Service",
                        tagline="The simplest way to run a containerized app — push an image, get a URL. No cluster to manage.",
                        monthly_price="$200/mo",
                        resources=[
                            {"service": "App Runner Service", "quantity": 1, "purpose": "Fully managed container hosting with built-in auto-scaling"},
                            {"service": "ECR Repository", "quantity": 1, "purpose": "Container image registry"},
                            {"service": "Custom Domain + ACM Certificate", "quantity": 1, "purpose": "HTTPS on your own domain"},
                            {"service": "VPC Connector", "quantity": 1, "purpose": "Private connectivity to RDS/internal resources"},
                            {"service": "CloudWatch Logs", "quantity": 1, "purpose": "Application and access logs"},
                            {"service": "Auto Scaling Configuration", "quantity": 1, "purpose": "Scale to zero, or on concurrency"},
                        ],
                    ),
                    ServicePackage(
                        id="managed-database-service",
                        category="addon",
                        name="Managed Database as a Service",
                        tagline="A dedicated, fully-managed database independent of your compute tier — add it to any plan.",
                        monthly_price="$400/mo",
                        resources=[
                            {"service": "RDS Aurora (Multi-AZ)", "quantity": 1, "purpose": "Primary relational database cluster"},
                            {"service": "Read Replica", "quantity": 1, "purpose": "Read scaling and reporting offload"},
                            {"service": "Automated Backups (35-day retention)", "quantity": 1, "purpose": "Point-in-time recovery"},
                            {"service": "Secrets Manager", "quantity": 1, "purpose": "Credential rotation"},
                            {"service": "Performance Insights", "quantity": 1, "purpose": "Query-level monitoring"},
                        ],
                    ),
                    ServicePackage(
                        id="backup-dr-service",
                        category="addon",
                        name="Backup & DR as a Service",
                        tagline="Cross-region backup vaults and a tested failover runbook for any tier.",
                        monthly_price="$300/mo",
                        resources=[
                            {"service": "AWS Backup Vault (cross-region)", "quantity": 1, "purpose": "Centralized, encrypted backup storage"},
                            {"service": "Automated Snapshot Schedule", "quantity": 1, "purpose": "Daily/weekly snapshot policy"},
                            {"service": "Cross-Region Replication", "quantity": 1, "purpose": "Secondary-region recovery copy"},
                            {"service": "DR Runbook + Quarterly Failover Test", "quantity": 1, "purpose": "Verified recovery procedure"},
                        ],
                    ),
                    ServicePackage(
                        id="security-compliance-service",
                        category="addon",
                        name="Security & Compliance as a Service",
                        tagline="Threat detection and audit-ready logging for customers not yet on the Advanced tier.",
                        monthly_price="$550/mo",
                        resources=[
                            {"service": "GuardDuty", "quantity": 1, "purpose": "Threat detection"},
                            {"service": "Security Hub", "quantity": 1, "purpose": "Centralized compliance posture"},
                            {"service": "WAF", "quantity": 1, "purpose": "Web application firewall"},
                            {"service": "Centralized Logging (CloudWatch Logs + S3 archive)", "quantity": 1, "purpose": "Audit trail"},
                            {"service": "Quarterly Access Review Report", "quantity": 1, "purpose": "IAM audit for compliance"},
                        ],
                    ),
                ]
            )

        if db.query(Capability).count() == 0:
            db.add_all(
                [
                    Capability(
                        id="cap-aws-contact-center",
                        name="AWS Contact Center",
                        cloud="AWS",
                        description=(
                            "Design and delivery of cloud contact center solutions built on Amazon Connect — "
                            "omnichannel routing, IVR, agent workspace, and analytics."
                        ),
                        key_services=["Amazon Connect", "Amazon Lex", "Amazon Polly", "Amazon Chime SDK", "Contact Lens"],
                        status="Active",
                    ),
                    Capability(
                        id="cap-vmware-hyperv-azure-migration",
                        name="VMware & Hyper-V Migration to Azure",
                        cloud="Azure",
                        description=(
                            "Discovery, assessment, and migration of on-premises VMware and Hyper-V virtual "
                            "machines to Azure IaaS, including dependency mapping and a rehost/replatform "
                            "decision framework."
                        ),
                        key_services=["Azure Migrate", "Azure Site Recovery", "Azure Database Migration Service"],
                        status="Active",
                    ),
                    Capability(
                        id="cap-cloud-cost-optimization",
                        name="Cloud Cost & Billing Optimization",
                        cloud="Multi-Cloud",
                        description=(
                            "Ongoing cost governance across AWS and Azure — rightsizing, commitment-based "
                            "discounts, anomaly detection, and cost allocation reporting to control cloud spend."
                        ),
                        key_services=[
                            "AWS Cost Explorer",
                            "AWS Trusted Advisor",
                            "AWS Savings Plans",
                            "AWS Compute Optimizer",
                            "Azure Cost Management",
                            "Azure Advisor",
                        ],
                        status="Active",
                    ),
                    Capability(
                        id="cap-kubernetes-container-platforms",
                        name="Kubernetes & Container Platforms",
                        cloud="Multi-Cloud",
                        description=(
                            "Design and operation of managed container platforms across clouds — cluster "
                            "architecture, autoscaling, ingress, and CI/CD integration for containerized workloads."
                        ),
                        key_services=[
                            "Amazon EKS",
                            "Amazon ECS",
                            "Azure Kubernetes Service (AKS)",
                            "Google Kubernetes Engine (GKE)",
                        ],
                        status="Active",
                    ),
                ]
            )

        if db.query(SolutionPackage).count() == 0:
            db.add_all(
                [
                    SolutionPackage(
                        id="sol-sap-on-aws-migration",
                        name="SAP on AWS Migration",
                        cloud="AWS",
                        tagline="Move SAP ECC/S4HANA off legacy infrastructure onto AWS without a re-implementation.",
                        outcome=(
                            "Customers running SAP on aging on-prem hardware face a hardware refresh they don't want "
                            "to pay for twice. This package moves the existing SAP landscape onto AWS as-is — same "
                            "version, same customizations — then right-sizes it on SAP-certified instances, cutting "
                            "infrastructure spend while removing the refresh cycle entirely."
                        ),
                        assumptions=[
                            "Customer has an existing AWS account, or one will be provisioned as part of the landing zone.",
                            "The current SAP version and customizations are supported on AWS-certified instance types (no SAP version upgrade in scope).",
                            "Customer can provide a maintenance window for cutover per environment (sandbox, QA, production).",
                            "Network connectivity (VPN or Direct Connect) to the customer's SAP GUI users is established before cutover.",
                        ],
                        services=[
                            {"service": "SAP-certified EC2 instances (X2iedn / U-series)", "purpose": "SAP application and HANA database tiers"},
                            {"service": "EBS (io2 Block Express)", "purpose": "High-IOPS storage for the HANA database"},
                            {"service": "AWS Backint Agent", "purpose": "SAP HANA-native backup"},
                            {"service": "AWS Launch Wizard for SAP", "purpose": "Guided, SAP-validated deployment"},
                            {"service": "Direct Connect", "purpose": "Low-latency link back to the customer's SAP GUI users"},
                        ],
                        reference_architecture=(
                            "Landing zone with a dedicated SAP account, HANA on X2iedn in a Multi-AZ pair, "
                            "application servers behind an internal load balancer, Backint-based backup to S3, "
                            "and Direct Connect for on-prem connectivity during and after cutover."
                        ),
                        pricing_note="Scoped per SAP landscape size — starting at $25,000 for the migration engagement.",
                    ),
                    SolutionPackage(
                        id="sol-disaster-recovery",
                        name="Disaster Recovery Solution",
                        cloud="AWS",
                        tagline="Pilot-light DR in AWS for an on-prem or single-region production estate.",
                        outcome=(
                            "Most customers asking for this have no DR plan at all today, or one that's never been "
                            "tested. This package stands up a pilot-light environment in a second AWS region — "
                            "data replicated continuously, compute scaled to zero until a failover is declared — so "
                            "recovery is a runbook, not a scramble, and the ongoing cost stays low between drills."
                        ),
                        assumptions=[
                            "Source estate is either already on AWS (single region) or reachable from AWS via VPN/Direct Connect for replication.",
                            "Customer defines and signs off on an RPO/RTO target before the architecture is finalized.",
                            "A DR drill (failover test) is run at least twice a year to validate the runbook — not included as one-time setup.",
                            "Source servers meet the DRS agent's supported OS versions.",
                        ],
                        services=[
                            {"service": "AWS Elastic Disaster Recovery (DRS)", "purpose": "Continuous block-level replication from the source estate"},
                            {"service": "RDS Cross-Region Read Replica", "purpose": "Warm-standby database in the DR region"},
                            {"service": "Route 53 (failover routing)", "purpose": "DNS cutover on failover declaration"},
                            {"service": "S3 Cross-Region Replication", "purpose": "Object storage replicated to the DR region"},
                            {"service": "AWS Backup", "purpose": "Point-in-time recovery independent of replication"},
                        ],
                        reference_architecture=(
                            "Source estate replicated via DRS into a staging subnet in the DR region; RDS read "
                            "replica promoted on failover; Route 53 health-check-based failover routing; runbook-"
                            "driven failback once the primary region recovers."
                        ),
                        pricing_note="Starting at $12,000 setup, plus ongoing replication and standby costs.",
                    ),
                    SolutionPackage(
                        id="sol-vdi-rollout",
                        name="VDI Rollout",
                        cloud="AWS",
                        tagline="Cloud-hosted virtual desktops for a distributed or contractor-heavy workforce.",
                        outcome=(
                            "Customers with remote or contractor staff who can't be issued corporate laptops, or "
                            "who need to keep sensitive data off local disks, end up managing this ad hoc with VPN "
                            "plus RDP. This package replaces that with managed virtual desktops — provisioned per "
                            "user group, patched centrally, and with no data ever landing on the endpoint."
                        ),
                        assumptions=[
                            "Customer has (or will procure) an Active Directory to join WorkSpaces to — this package doesn't stand up a new identity source.",
                            "End users have internet access sufficient to reach the WorkSpaces client or browser (no dedicated network build included).",
                            "Application licensing for anything delivered via WAM is the customer's responsibility.",
                            "Per-seat pricing assumes standard bundle sizing — GPU or power-user bundles are priced separately.",
                        ],
                        services=[
                            {"service": "Amazon WorkSpaces", "purpose": "Managed persistent virtual desktops"},
                            {"service": "AWS Managed Microsoft AD", "purpose": "Directory services and desktop authentication"},
                            {"service": "FSx for Windows File Server", "purpose": "Redirected user profiles and shared drives"},
                            {"service": "WorkSpaces Application Manager", "purpose": "Centralized application packaging and delivery"},
                        ],
                        reference_architecture=(
                            "WorkSpaces provisioned per department in a dedicated VPC, joined to AWS Managed "
                            "Microsoft AD, with FSx-backed profile redirection and app delivery through WAM — no "
                            "local persistence, all access over the WorkSpaces client or browser."
                        ),
                        pricing_note="Per-seat monthly, from $35/user — no upfront project cost.",
                    ),
                    SolutionPackage(
                        id="sol-migration-basic",
                        name="Migration-Basic",
                        cloud="AWS",
                        tagline="Lift-and-shift migration for a small estate — 5 VMs, single AZ.",
                        outcome=(
                            "For customers with a small, well-understood estate who want off legacy infrastructure "
                            "without redesigning anything. Servers move as-is onto right-sized EC2 instances, with "
                            "the database, load balancing, and monitoring in place from day one — no re-architecture, "
                            "no application changes."
                        ),
                        assumptions=[
                            "Operating systems and applications being migrated are owned and licensed by the customer — no OS or software licensing included.",
                            "Reaching and coordinating with individual business/application owners is the customer's responsibility.",
                            "Source servers are compatible with AWS Application Migration Service (MGN) agent requirements.",
                            "Total data migration volume is under 2TB — larger volumes need AWS DataSync or Snowball, priced separately.",
                        ],
                        services=[
                            {"service": "Virtual Machine (t3.large) x5", "purpose": "Migrated application workloads"},
                            {"service": "AWS Application Migration Service (MGN)", "purpose": "Lift-and-shift replication and cutover"},
                            {"service": "VPC", "purpose": "Network isolation"},
                            {"service": "RDS (single-AZ, db.t3.medium)", "purpose": "Relational database"},
                            {"service": "Application Load Balancer", "purpose": "Traffic distribution across migrated VMs"},
                            {"service": "CloudWatch Monitoring", "purpose": "Infrastructure and application monitoring"},
                            {"service": "AWS Backup", "purpose": "Automated backup and retention"},
                        ],
                        reference_architecture=(
                            "Single-AZ VPC with public and private subnets, MGN-based replication from source "
                            "servers to EC2, single-AZ RDS database, ALB in front of the application tier."
                        ),
                        pricing_note="Starting at $8,000 for the migration engagement (estimate — confirm pricing).",
                    ),
                    SolutionPackage(
                        id="sol-migration-intermediate",
                        name="Migration-Intermediate",
                        cloud="AWS",
                        tagline="Lift-and-shift migration for a mid-size estate — 10 VMs, Multi-AZ database.",
                        outcome=(
                            "For customers past the point where a single-AZ, single-instance setup is acceptable, "
                            "but not yet running at a scale that needs a CDN or edge layer. Adds Multi-AZ database "
                            "resilience and autoscaling so the estate survives an AZ failure and absorbs normal "
                            "traffic variation without manual intervention."
                        ),
                        assumptions=[
                            "Operating systems and applications being migrated are owned and licensed by the customer — no OS or software licensing included.",
                            "Reaching and coordinating with individual business/application owners is the customer's responsibility.",
                            "Source servers are compatible with AWS Application Migration Service (MGN) agent requirements.",
                            "Total data migration volume is under 5TB — larger volumes need AWS DataSync or Snowball, priced separately.",
                        ],
                        services=[
                            {"service": "Virtual Machine (t3.large, Auto Scaling Group) x10", "purpose": "Migrated application workloads with autoscaling"},
                            {"service": "AWS Application Migration Service (MGN)", "purpose": "Lift-and-shift replication and cutover"},
                            {"service": "VPC (2 AZs)", "purpose": "Network isolation"},
                            {"service": "Subnets (2 public + 2 private, 2 AZs)", "purpose": "Multi-AZ network segmentation"},
                            {"service": "RDS (Multi-AZ, db.r5.large)", "purpose": "Highly available relational database"},
                            {"service": "Application Load Balancer", "purpose": "Traffic distribution across migrated VMs"},
                            {"service": "Auto Scaling Policy", "purpose": "Scale VM count with load"},
                            {"service": "CloudWatch Monitoring", "purpose": "Infrastructure and application monitoring"},
                            {"service": "AWS Backup", "purpose": "Automated backup and retention"},
                        ],
                        reference_architecture=(
                            "Multi-AZ VPC across 2 AZs, MGN-based replication from source servers to an Auto "
                            "Scaling Group, Multi-AZ RDS database, ALB distributing traffic across both AZs."
                        ),
                        pricing_note="Starting at $16,000 for the migration engagement (estimate — confirm pricing).",
                    ),
                    SolutionPackage(
                        id="sol-migration-advanced",
                        name="Migration-Advanced",
                        cloud="AWS",
                        tagline="Lift-and-shift migration for a large estate — 20 VMs, Multi-AZ, CDN, and autoscaling.",
                        outcome=(
                            "For customers with a large, customer-facing estate who need edge performance and "
                            "read-scaling on top of the resilience a mid-size migration already gets. Adds a CDN "
                            "for static/cacheable content and a read replica so the database isn't the bottleneck "
                            "as traffic grows."
                        ),
                        assumptions=[
                            "Operating systems and applications being migrated are owned and licensed by the customer — no OS or software licensing included.",
                            "Reaching and coordinating with individual business/application owners is the customer's responsibility.",
                            "Source servers are compatible with AWS Application Migration Service (MGN) agent requirements.",
                            "Total data migration volume is under 10TB — larger volumes need AWS DataSync or Snowball, priced separately.",
                        ],
                        services=[
                            {"service": "Virtual Machine (t3.xlarge, Auto Scaling Group) x20", "purpose": "Migrated application workloads with autoscaling"},
                            {"service": "AWS Application Migration Service (MGN)", "purpose": "Lift-and-shift replication and cutover"},
                            {"service": "VPC (2 AZs)", "purpose": "Network isolation"},
                            {"service": "Subnets (2 public + 2 private, 2 AZs)", "purpose": "Multi-AZ network segmentation"},
                            {"service": "RDS (Multi-AZ, db.r5.xlarge) + read replica", "purpose": "Highly available database with read scaling"},
                            {"service": "Application Load Balancer", "purpose": "Traffic distribution across migrated VMs"},
                            {"service": "CloudFront", "purpose": "CDN for static and cacheable content"},
                            {"service": "Auto Scaling Policy", "purpose": "Scale VM count with load"},
                            {"service": "CloudWatch Monitoring", "purpose": "Infrastructure and application monitoring"},
                            {"service": "AWS Backup", "purpose": "Automated backup and retention"},
                        ],
                        reference_architecture=(
                            "Multi-AZ VPC across 2 AZs, MGN-based replication into an Auto Scaling Group, Multi-AZ "
                            "RDS with a read replica, ALB behind CloudFront for edge caching and CDN delivery."
                        ),
                        pricing_note="Starting at $28,000 for the migration engagement (estimate — confirm pricing).",
                    ),
                ]
            )

        db.commit()
        print("Seed complete.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
