export type ProjectStatus = "Draft" | "In Review" | "Approved" | "Archived";

export interface Project {
  id: string;
  name: string;
  customer: string;
  cloud: "AWS" | "Azure" | "GCP" | "Multi-Cloud";
  status: ProjectStatus;
  owner: string;
  updated: string;
  docsGenerated: number;
  description: string;
  sourceDocument: string | null;
  capabilityId: string | null;
  capabilityName: string | null;
}

export type DocType = "SDD" | "ADR" | "BOM" | "Cost Estimate" | "Security Review" | "Runbook" | "Handover";

export type DocStatus = "Draft" | "In Review" | "Approved";

export interface GeneratedDocument {
  id: string;
  project: string;
  type: DocType;
  title: string;
  version: string;
  updated: string;
  status: DocStatus;
  content: string;
  reviewNote: string | null;
}

export interface KnowledgeDoc {
  id: string;
  name: string;
  category: string;
  uploadedBy: string;
  uploaded: string;
  size: string;
}

export interface DocTemplate {
  id: string;
  name: string;
  cloud: string;
  sections: number;
  description: string;
  source?: { label: string; url: string };
  content: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string | null;
  role: "Owner" | "Architect" | "Reviewer" | "Viewer";
  status: "Active" | "Invited";
  locked: boolean;
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
}

export interface ResourceLine {
  service: string;
  quantity: number;
  purpose: string;
}

export interface ServicePackage {
  id: string;
  category: "tier" | "container" | "addon";
  name: string;
  tagline: string;
  monthlyPrice: string;
  resources: ResourceLine[];
}

export interface Quote {
  id: string;
  projectId: string;
  customerName: string;
  description: string;
  packageIds: string[];
  total: string;
  format: string;
  created: string;
  createdBy: string;
}

export interface CaseStudy {
  customer: string;
  outcome: string;
}

export interface Capability {
  id: string;
  name: string;
  cloud: string;
  description: string;
  keyServices: string[];
  status: "Active" | "Planned";
  githubUrl: string | null;
  certifications: string[];
  caseStudies: CaseStudy[];
}

export interface Connector {
  name: string;
  url: string;
  status: "connected" | "needs_auth" | "pending" | "unknown";
  statusText: string;
  category: "claude_ai" | "custom";
}
