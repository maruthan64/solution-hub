import type {
  AppUser,
  AuditEntry,
  Capability,
  Connector,
  DocTemplate,
  GeneratedDocument,
  KnowledgeDoc,
  Project,
  Quote,
  ServicePackage,
} from "@/lib/types";

export interface CurrentUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "Owner" | "Architect" | "Reviewer" | "Viewer";
}

export const getCurrentUser = () => apiFetch<CurrentUser>("/api/auth/me");

export class ApiError extends Error {}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.detail ?? `Request to ${path} failed with ${res.status}`);
  }

  return res.json();
}

export const getProjects = () => apiFetch<Project[]>("/api/projects");
export const getProject = (id: string) => apiFetch<Project>(`/api/projects/${id}`);
export const getDocuments = () => apiFetch<GeneratedDocument[]>("/api/documents");
export const getDocument = (id: string) => apiFetch<GeneratedDocument>(`/api/documents/${id}`);
export const updateDocument = (id: string, content: string) =>
  apiFetch<GeneratedDocument>(`/api/documents/${id}`, { method: "PUT", body: JSON.stringify({ content }) });
export const assistDocument = (id: string, instruction: string) =>
  apiFetch<{ suggestion: string }>(`/api/documents/${id}/assist`, {
    method: "POST",
    body: JSON.stringify({ instruction }),
  });
export const submitDocumentForReview = (id: string) =>
  apiFetch<GeneratedDocument>(`/api/documents/${id}/submit-review`, { method: "POST" });
export const approveDocument = (id: string) =>
  apiFetch<GeneratedDocument>(`/api/documents/${id}/approve`, { method: "POST" });
export const requestDocumentChanges = (id: string, note: string) =>
  apiFetch<GeneratedDocument>(`/api/documents/${id}/request-changes`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });

export interface DocumentDiagram {
  xml: string;
  hasImage: boolean;
}

export const getDocumentDiagram = (id: string) => apiFetch<DocumentDiagram>(`/api/documents/${id}/diagram`);
export const saveDocumentDiagram = (id: string, xml: string) =>
  apiFetch<DocumentDiagram>(`/api/documents/${id}/diagram`, { method: "PUT", body: JSON.stringify({ xml }) });
export const assistDocumentDiagram = (id: string, instruction: string) =>
  apiFetch<{ xml: string }>(`/api/documents/${id}/diagram/assist`, {
    method: "POST",
    body: JSON.stringify({ instruction }),
  });
export function uploadDiagramImage(id: string, file: Blob): Promise<DocumentDiagram> {
  const form = new FormData();
  form.set("file", file, "diagram.png");
  return postForm<DocumentDiagram>(`/api/documents/${id}/diagram/image`, form, "Failed to save diagram image");
}
export const diagramImageUrl = (id: string) => `/api/documents/${id}/diagram/image`;

export const getTemplates = () => apiFetch<DocTemplate[]>("/api/templates");
export const getTemplate = (id: string) => apiFetch<DocTemplate>(`/api/templates/${id}`);
export const updateTemplate = (id: string, content: string) =>
  apiFetch<DocTemplate>(`/api/templates/${id}`, { method: "PUT", body: JSON.stringify({ content }) });
export const getKnowledgeDocs = () => apiFetch<KnowledgeDoc[]>("/api/knowledge-base");
export const deleteKnowledgeDoc = (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/knowledge-base/${id}`, { method: "DELETE" });
export const getUsers = () => apiFetch<AppUser[]>("/api/users");
export const getAuditLog = () => apiFetch<AuditEntry[]>("/api/audit-logs");

export interface CreateUserResult {
  user: AppUser;
  username: string;
}

export const createUser = (name: string, email: string | undefined, username: string, role: string, password: string) =>
  apiFetch<CreateUserResult>("/api/users", {
    method: "POST",
    body: JSON.stringify({ name, email: email || null, username, role, password }),
  });
export const deleteUser = (id: string) => apiFetch<{ ok: boolean }>(`/api/users/${id}`, { method: "DELETE" });
export const updateUserRole = (id: string, role: string) =>
  apiFetch<AppUser>(`/api/users/${id}/role`, { method: "PUT", body: JSON.stringify({ role }) });
export const resetUserPassword = (id: string, password: string) =>
  apiFetch<AppUser>(`/api/users/${id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) });
export const unlockUser = (id: string) => apiFetch<AppUser>(`/api/users/${id}/unlock`, { method: "POST" });

// No Content-Type header here — the browser sets multipart/form-data with the
// correct boundary itself; setting it manually breaks the upload.
async function postForm<T>(path: string, form: FormData, errorFallback: string): Promise<T> {
  const res = await fetch(path, { method: "POST", body: form });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.detail ?? errorFallback);
  }

  return res.json();
}

export interface NewProjectInput {
  name: string;
  customer: string;
  cloud: string;
  description: string;
  templateId?: string | null;
  capabilityId?: string | null;
  document?: File | null;
}

export function createProject(input: NewProjectInput): Promise<Project> {
  const form = new FormData();
  form.set("name", input.name);
  form.set("customer", input.customer);
  form.set("cloud", input.cloud);
  form.set("description", input.description);
  if (input.templateId) form.set("templateId", input.templateId);
  if (input.capabilityId) form.set("capabilityId", input.capabilityId);
  if (input.document) form.set("document", input.document);
  return postForm<Project>("/api/projects", form, "Failed to create project");
}

export const deleteProject = (id: string) => apiFetch<{ ok: boolean }>(`/api/projects/${id}`, { method: "DELETE" });
export const getProjectQuotes = (id: string) => apiFetch<Quote[]>(`/api/projects/${id}/quotes`);
export const createCostEstimate = (projectId: string, packageIds: string[]) =>
  apiFetch<GeneratedDocument>(`/api/projects/${projectId}/cost-estimate`, {
    method: "POST",
    body: JSON.stringify({ packageIds }),
  });

export interface NewTemplateInput {
  name: string;
  cloud: string;
  description: string;
  document?: File | null;
}

export function createTemplate(input: NewTemplateInput): Promise<DocTemplate> {
  const form = new FormData();
  form.set("name", input.name);
  form.set("cloud", input.cloud);
  form.set("description", input.description);
  if (input.document) form.set("document", input.document);
  return postForm<DocTemplate>("/api/templates", form, "Failed to create template");
}

export function uploadKnowledgeDoc(category: string, file: File): Promise<KnowledgeDoc> {
  const form = new FormData();
  form.set("category", category);
  form.set("file", file);
  return postForm<KnowledgeDoc>("/api/knowledge-base", form, "Failed to upload file");
}

export const assistTemplate = (id: string, instruction: string) =>
  apiFetch<{ suggestion: string }>(`/api/templates/${id}/assist`, {
    method: "POST",
    body: JSON.stringify({ instruction }),
  });

export type AiProvider = "claude_cli" | "bedrock";

export interface AppSettings {
  aiProvider: AiProvider;
  orgName: string;
  defaultCloud: string;
  defaultExportFormat: string;
  bedrockApiKeyPreview: string | null;
  bedrockRegion: string | null;
  bedrockModel: string | null;
}

export const getSettings = () => apiFetch<AppSettings>("/api/settings");
export const updateSettings = (aiProvider: AiProvider) =>
  apiFetch<AppSettings>("/api/settings", { method: "PUT", body: JSON.stringify({ aiProvider }) });

export const updateOrgSettings = (orgName: string, defaultCloud: string, defaultExportFormat: string) =>
  apiFetch<AppSettings>("/api/settings/organization", {
    method: "PUT",
    body: JSON.stringify({ orgName, defaultCloud, defaultExportFormat }),
  });

export interface BedrockCredentialsInput {
  apiKey?: string;
  region?: string;
  model?: string;
}

export const updateBedrockCredentials = (input: BedrockCredentialsInput) =>
  apiFetch<AppSettings>("/api/settings/bedrock", { method: "POST", body: JSON.stringify(input) });

export interface TestConnectionResult {
  ok: boolean;
  reply: string;
}

export const testAiConnection = (provider: AiProvider) =>
  apiFetch<TestConnectionResult>("/api/settings/test-connection", {
    method: "POST",
    body: JSON.stringify({ provider }),
  });

export const getServiceCatalog = () => apiFetch<ServicePackage[]>("/api/service-catalog");
export const getServicePackage = (id: string) => apiFetch<ServicePackage>(`/api/service-catalog/${id}`);
export const updateServicePackage = (id: string, input: Omit<ServicePackage, "id" | "category">) =>
  apiFetch<ServicePackage>(`/api/service-catalog/${id}`, { method: "PUT", body: JSON.stringify(input) });
export const createServicePackage = (input: Omit<ServicePackage, "id">) =>
  apiFetch<ServicePackage>("/api/service-catalog", { method: "POST", body: JSON.stringify(input) });

export type QuoteFormat = "docx" | "pdf" | "proposal";

export async function generateQuote(
  customerName: string,
  description: string,
  packageIds: string[],
  format: QuoteFormat,
  projectId?: string,
): Promise<Blob> {
  const res = await fetch("/api/service-catalog/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ customerName, description, packageIds, format, projectId: projectId ?? null }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.detail ?? "Failed to generate quote");
  }

  return res.blob();
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const sendChatMessage = (messages: ChatMessage[]) =>
  apiFetch<{ reply: string }>("/api/chat", { method: "POST", body: JSON.stringify({ messages }) });

export interface ProjectExtraction {
  name: string;
  customer: string;
  cloud: string;
  description: string;
}

export const extractProjectFromChat = (messages: ChatMessage[]) =>
  apiFetch<ProjectExtraction>("/api/chat/extract-project", { method: "POST", body: JSON.stringify({ messages }) });

export interface CapabilityInput {
  name: string;
  cloud: string;
  description: string;
  keyServices: string[];
  status: "Active" | "Planned";
  githubUrl: string | null;
  certifications: string[];
  caseStudies: { customer: string; outcome: string }[];
}

export const getCapabilities = () => apiFetch<Capability[]>("/api/capabilities");
export const createCapability = (input: CapabilityInput) =>
  apiFetch<Capability>("/api/capabilities", { method: "POST", body: JSON.stringify(input) });
export const updateCapability = (id: string, input: CapabilityInput) =>
  apiFetch<Capability>(`/api/capabilities/${id}`, { method: "PUT", body: JSON.stringify(input) });
export const deleteCapability = (id: string) =>
  apiFetch<{ ok: boolean }>(`/api/capabilities/${id}`, { method: "DELETE" });
export const exportCapabilityMatrixUrl = (format: "docx" | "pdf") => `/api/capabilities/export?format=${format}`;

export const getConnectors = () => apiFetch<Connector[]>("/api/mcp/connectors");

export const startReauth = (name: string) =>
  apiFetch<{ sessionId: string; authUrl: string | null; output: string | null }>(
    `/api/mcp/connectors/${encodeURIComponent(name)}/reauth/start`,
    { method: "POST" },
  );

export const completeReauth = (sessionId: string, redirectUrl: string) =>
  apiFetch<{ success: boolean; output: string }>("/api/mcp/connectors/reauth/complete", {
    method: "POST",
    body: JSON.stringify({ sessionId, redirectUrl }),
  });

export interface AddServerInput {
  name: string;
  transport: "stdio" | "http" | "sse";
  commandOrUrl: string;
}

export const addServer = (input: AddServerInput) =>
  apiFetch<{ ok: boolean }>("/api/mcp/servers", { method: "POST", body: JSON.stringify(input) });

export const getServerDetail = (name: string) =>
  apiFetch<AddServerInput>(`/api/mcp/servers/${encodeURIComponent(name)}`);

export const removeServer = (name: string) =>
  apiFetch<{ ok: boolean }>(`/api/mcp/servers/${encodeURIComponent(name)}`, { method: "DELETE" });
