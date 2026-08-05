import {
  DashboardOutlined,
  ProjectOutlined,
  ShopOutlined,
  MessageOutlined,
  FileTextOutlined,
  BookOutlined,
  AppstoreOutlined,
  ApiOutlined,
  TeamOutlined,
  AuditOutlined,
  SettingOutlined,
  StarOutlined,
} from "@ant-design/icons";

export const NAV_ITEMS = [
  { key: "/", label: "Dashboard", icon: DashboardOutlined },
  { key: "/projects", label: "Projects", icon: ProjectOutlined },
  { key: "/capabilities", label: "Capabilities", icon: StarOutlined },
  { key: "/service-catalog", label: "Service Catalog", icon: ShopOutlined },
  { key: "/chat", label: "AI Chat", icon: MessageOutlined },
  { key: "/documents", label: "Documents", icon: FileTextOutlined },
  { key: "/knowledge-base", label: "Knowledge Base", icon: BookOutlined },
  { key: "/templates", label: "Templates", icon: AppstoreOutlined },
  { key: "/connectors", label: "Connectors", icon: ApiOutlined },
  { key: "/users", label: "Users", icon: TeamOutlined },
  { key: "/audit-logs", label: "Audit Logs", icon: AuditOutlined },
  { key: "/settings", label: "Settings", icon: SettingOutlined },
];
