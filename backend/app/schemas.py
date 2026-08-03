from pydantic import BaseModel, ConfigDict, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    redirect_url: str = "/"


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    customer: str
    cloud: str
    status: str
    owner: str
    updated: str
    docsGenerated: int
    description: str = ""
    sourceDocument: str | None = None
    capabilityId: str | None = None
    capabilityName: str | None = None


class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    id: str
    project: str
    type: str
    title: str
    version: str
    updated: str
    status: str
    content: str
    reviewNote: str | None = Field(default=None, validation_alias="review_note", serialization_alias="reviewNote")


class TemplateSource(BaseModel):
    label: str
    url: str


class TemplateOut(BaseModel):
    id: str
    name: str
    cloud: str
    sections: int
    description: str
    source: TemplateSource | None = None
    content: str


class TemplateUpdate(BaseModel):
    content: str


class TemplateAssistRequest(BaseModel):
    instruction: str


class TemplateAssistResponse(BaseModel):
    suggestion: str


class DiagramOut(BaseModel):
    xml: str
    hasImage: bool


class DiagramSaveRequest(BaseModel):
    xml: str


class DiagramAssistResponse(BaseModel):
    xml: str


class ChatMessageIn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessageIn]


class ChatResponse(BaseModel):
    reply: str


class CurrentUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    username: str
    email: str
    role: str


class ReviewNoteRequest(BaseModel):
    note: str


class SettingsOut(BaseModel):
    aiProvider: str
    orgName: str
    defaultCloud: str
    defaultExportFormat: str
    apiKeyPreview: str | None = None


class SettingsUpdate(BaseModel):
    aiProvider: str


class OrgSettingsUpdate(BaseModel):
    orgName: str = Field(min_length=1)
    defaultCloud: str
    defaultExportFormat: str


class ApiKeyUpdate(BaseModel):
    apiKey: str = Field(min_length=1)


class ResourceLine(BaseModel):
    service: str
    quantity: int
    purpose: str


class ServicePackageOut(BaseModel):
    id: str
    category: str
    name: str
    tagline: str
    monthlyPrice: str
    resources: list[ResourceLine]


class ServicePackageUpdate(BaseModel):
    name: str
    tagline: str
    monthlyPrice: str
    resources: list[ResourceLine]


class ServicePackageCreate(BaseModel):
    category: str  # "tier" | "container" | "addon"
    name: str = Field(min_length=1)
    tagline: str = Field(min_length=1)
    monthlyPrice: str = Field(min_length=1)
    resources: list[ResourceLine] = []


class QuoteRequest(BaseModel):
    customerName: str = Field(min_length=1)
    description: str = Field(min_length=1)
    packageIds: list[str]
    format: str = "docx"  # "docx" | "pdf" | "proposal"
    projectId: str | None = None


class QuoteOut(BaseModel):
    id: str
    projectId: str
    customerName: str
    description: str
    packageIds: list[str]
    total: str
    format: str
    created: str
    createdBy: str


class KnowledgeDocOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    category: str
    uploadedBy: str
    uploaded: str
    size: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    email: str | None = None
    role: str
    status: str
    locked: bool = False


class UpdateUserRoleRequest(BaseModel):
    role: str


class ResetPasswordRequest(BaseModel):
    password: str = Field(min_length=8)


class CreateUserRequest(BaseModel):
    name: str = Field(min_length=1)
    email: str | None = None
    username: str = Field(min_length=3)
    role: str
    password: str = Field(min_length=8)


class CreateUserResponse(BaseModel):
    user: UserOut
    username: str


class AuditEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    actor: str
    action: str
    target: str
    timestamp: str


class ConnectorOut(BaseModel):
    name: str
    url: str
    status: str  # "connected" | "needs_auth" | "pending" | "unknown"
    statusText: str
    category: str  # "claude_ai" | "custom"


class ReauthStartResponse(BaseModel):
    sessionId: str
    authUrl: str | None
    output: str | None = None


class ReauthCompleteRequest(BaseModel):
    sessionId: str
    redirectUrl: str = Field(min_length=1)


class ReauthCompleteResponse(BaseModel):
    success: bool
    output: str


class AddServerRequest(BaseModel):
    name: str = Field(min_length=1)
    transport: str = "stdio"
    commandOrUrl: str = Field(min_length=1)


class CaseStudy(BaseModel):
    customer: str
    outcome: str


class CapabilityOut(BaseModel):
    id: str
    name: str
    cloud: str
    description: str
    keyServices: list[str]
    status: str
    githubUrl: str | None = None
    certifications: list[str] = Field(default_factory=list)
    caseStudies: list[CaseStudy] = Field(default_factory=list)


class CapabilityCreate(BaseModel):
    name: str = Field(min_length=1)
    cloud: str
    description: str = ""
    keyServices: list[str] = Field(default_factory=list)
    status: str = "Active"
    githubUrl: str | None = None
    certifications: list[str] = Field(default_factory=list)
    caseStudies: list[CaseStudy] = Field(default_factory=list)


class CapabilityUpdate(BaseModel):
    name: str = Field(min_length=1)
    cloud: str
    description: str = ""
    keyServices: list[str] = Field(default_factory=list)
    status: str = "Active"
    githubUrl: str | None = None
    certifications: list[str] = Field(default_factory=list)
    caseStudies: list[CaseStudy] = Field(default_factory=list)
