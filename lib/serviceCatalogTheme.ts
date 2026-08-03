import {
  CrownOutlined,
  RocketOutlined,
  ThunderboltOutlined,
  ClusterOutlined,
  DeploymentUnitOutlined,
  DatabaseOutlined,
  SafetyOutlined,
  SecurityScanOutlined,
  CloudServerOutlined,
} from "@ant-design/icons";

export interface PackageTheme {
  accent: string;
  soft: string;
  icon: typeof RocketOutlined;
  popular?: boolean;
}

// Tier progression uses a deliberate cyan -> indigo -> violet ramp (calm/entry
// to premium), matching the common SaaS pattern of escalating color intensity
// across tiers. Container add-ons use their actual brand colors instead —
// Kubernetes blue for EKS, AWS orange for ECS — since those are recognizable
// product marks, not part of the tier ramp.
export const PACKAGE_THEME: Record<string, PackageTheme> = {
  basic: { accent: "#0891b2", soft: "#ecfeff", icon: RocketOutlined },
  intermediate: { accent: "#4f46e5", soft: "#eef2ff", icon: ThunderboltOutlined, popular: true },
  advanced: { accent: "#7c3aed", soft: "#f5f3ff", icon: CrownOutlined },
  "eks-service": { accent: "#326ce5", soft: "#eff6ff", icon: ClusterOutlined },
  "ecs-service": { accent: "#ff9900", soft: "#fff7ed", icon: DeploymentUnitOutlined },
  "apprunner-service": { accent: "#0d9488", soft: "#f0fdfa", icon: CloudServerOutlined },
  "managed-database-service": { accent: "#059669", soft: "#ecfdf5", icon: DatabaseOutlined },
  "backup-dr-service": { accent: "#b45309", soft: "#fffbeb", icon: SafetyOutlined },
  "security-compliance-service": { accent: "#be123c", soft: "#fff1f2", icon: SecurityScanOutlined },
};

export const DEFAULT_THEME: PackageTheme = { accent: "#64748b", soft: "#f8fafc", icon: RocketOutlined };

export function getPackageTheme(id: string): PackageTheme {
  return PACKAGE_THEME[id] ?? DEFAULT_THEME;
}
