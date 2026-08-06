"use client";

import { Alert, Button, Form, Input, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { login } from "@/lib/auth";

const { Title, Text } = Typography;

// "Blueprint" theme: leans on the 📐 mark and the fact that this is a tool for
// solution architects — drafting-blue paper on the brand panel, and a "redline"
// accent (the color architects actually use to mark up drawings) instead of the
// default Ant Design blue.
const COLORS = {
  blueprintDeep: "#0c2a44",
  blueprint: "#123a5c",
  blueprintLine: "#7fb3d9",
  blueprintLineDim: "rgba(127, 179, 217, 0.22)",
  redline: "#e4572e",
  ink: "#0b2338",
  inkDim: "#52708a",
};

const FEATURES = [
  "AI-drafted solution architecture documents",
  "Service Catalog quoting linked to projects",
  "One-click architecture diagrams",
];

const STAMPS: { label: string; color: string; tilt: number; gcp?: boolean }[] = [
  { label: "AWS", color: "#ff9900", tilt: -1.5 },
  { label: "Azure", color: "#4d9bde", tilt: 1 },
  { label: "GCP", color: "#eaf2f8", tilt: -0.5, gcp: true },
  { label: "Kubernetes", color: "#6fa0c9", tilt: 1.2 },
  { label: "On-Prem", color: "#9fb7cc", tilt: -1 },
];

function CropMark({ corner }: { corner: "tl" | "tr" | "bl" | "br" }) {
  const vertical = corner.startsWith("t") ? "top" : "bottom";
  const horizontal = corner.endsWith("l") ? "left" : "right";
  return (
    <span
      className="absolute w-[22px] h-[22px]"
      style={{
        [vertical]: 18,
        [horizontal]: 18,
        borderTop: vertical === "top" ? `1.5px solid ${COLORS.blueprintLine}` : undefined,
        borderBottom: vertical === "bottom" ? `1.5px solid ${COLORS.blueprintLine}` : undefined,
        borderLeft: horizontal === "left" ? `1.5px solid ${COLORS.blueprintLine}` : undefined,
        borderRight: horizontal === "right" ? `1.5px solid ${COLORS.blueprintLine}` : undefined,
        opacity: 0.55,
      }}
    />
  );
}

function CheckTick() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="mt-0.5 shrink-0">
      <path
        d="M2 8L6 12L13 3"
        stroke={COLORS.redline}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LoginPageContent() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await login(username, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid username or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      <div
        className="hidden lg:flex relative flex-col justify-between w-1/2 p-11 text-white"
        style={{
          background: COLORS.blueprintDeep,
          backgroundImage: `repeating-linear-gradient(0deg, ${COLORS.blueprintLineDim} 0 1px, transparent 1px 32px), repeating-linear-gradient(90deg, ${COLORS.blueprintLineDim} 0 1px, transparent 1px 32px), radial-gradient(120% 100% at 15% 10%, ${COLORS.blueprint} 0%, ${COLORS.blueprintDeep} 65%)`,
        }}
      >
        <CropMark corner="tl" />
        <CropMark corner="tr" />
        <CropMark corner="bl" />
        <CropMark corner="br" />

        <div>
          <div className="flex items-center gap-2.5 text-xl font-extrabold">
            <span
              className="w-[34px] h-[34px] flex items-center justify-center text-lg shrink-0"
              style={{ border: `1.5px solid ${COLORS.blueprintLine}`, color: COLORS.blueprintLine }}
            >
              📐
            </span>
            CloudSolution Hub
          </div>
          <div
            className="mt-1.5 text-[11px] uppercase"
            style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'SFMono-Regular', Consolas, monospace", letterSpacing: "0.14em", color: COLORS.blueprintLine, opacity: 0.85 }}
          >
            Sheet A-01 · Solution Architecture Portal
          </div>
        </div>

        <div>
          <Title level={2} style={{ color: "white", maxWidth: "9.5em", marginBottom: 18, marginTop: 0 }}>
            One hub for every cloud you run.
          </Title>
          <ul className="flex flex-col gap-2.5 mb-7">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-[14.5px]" style={{ color: "#d7e6f2" }}>
                <CheckTick />
                {feature}
              </li>
            ))}
          </ul>

          <div
            className="mb-2.5 text-[10.5px] uppercase"
            style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'SFMono-Regular', Consolas, monospace", letterSpacing: "0.14em", color: COLORS.blueprintLine, opacity: 0.75 }}
          >
            Integrations on this sheet
          </div>
          <div className="flex flex-wrap gap-2.5">
            {STAMPS.map((stamp) => (
              <span
                key={stamp.label}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] uppercase"
                style={{
                  border: `1px dashed ${stamp.color}`,
                  color: stamp.color,
                  fontFamily: "ui-monospace, 'Cascadia Code', 'SFMono-Regular', Consolas, monospace",
                  letterSpacing: "0.08em",
                  transform: `rotate(${stamp.tilt}deg)`,
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <span
                  className="w-[7px] h-[7px] rounded-full shrink-0"
                  style={{
                    background: stamp.gcp
                      ? "conic-gradient(#4285F4 0 25%, #34A853 25% 50%, #FBBC05 50% 75%, #EA4335 75% 100%)"
                      : stamp.color,
                  }}
                />
                {stamp.label}
              </span>
            ))}
          </div>
        </div>

        <div
          className="flex justify-between items-end text-[12.5px]"
          style={{ color: COLORS.blueprintLine, opacity: 0.7, fontFamily: "ui-monospace, 'Cascadia Code', 'SFMono-Regular', Consolas, monospace", letterSpacing: "0.04em" }}
        >
          <span>Internal tool for solution architects</span>
          <span>Rev. 2026.08</span>
        </div>
      </div>

      <div className="flex flex-col items-center justify-center flex-1 p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-8">
            <Title level={2}>📐 CloudSolution Hub</Title>
          </div>

          <Title level={3} style={{ marginBottom: 4, letterSpacing: "-0.01em" }}>
            Sign in
          </Title>
          <Text type="secondary">Enter your credentials to continue.</Text>

          {error && <Alert className="mt-4" message={error} type="error" showIcon />}

          <Form className="blueprint-form mt-6" onFinish={handleSubmit} layout="vertical" requiredMark={false}>
            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: "Please enter your username" }]}
            >
              <Input
                placeholder="Enter your username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                size="large"
                variant="borderless"
              />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: "Please enter your password" }]}
            >
              <Input.Password
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                size="large"
                variant="borderless"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={isLoading}
                disabled={isLoading}
                block
                size="large"
                style={{ background: COLORS.redline, borderColor: COLORS.redline, color: "white", fontWeight: 600, marginTop: 6 }}
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>

      <style jsx global>{`
        .blueprint-form .ant-form-item-label > label {
          font-family: ui-monospace, "Cascadia Code", "SFMono-Regular", Consolas, monospace;
          font-size: 10.5px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: ${COLORS.inkDim};
          height: auto;
        }
        .blueprint-form .ant-input,
        .blueprint-form .ant-input-affix-wrapper {
          border-radius: 0;
          border-bottom: 1.5px solid #c7d6e2;
          padding-left: 2px;
          padding-right: 2px;
          transition: border-color 0.15s ease;
        }
        .blueprint-form .ant-input:hover,
        .blueprint-form .ant-input-affix-wrapper:hover,
        .blueprint-form .ant-input:focus,
        .blueprint-form .ant-input-affix-wrapper-focused {
          border-color: ${COLORS.redline} !important;
        }
        .blueprint-form .ant-btn-primary:hover {
          filter: brightness(1.06);
          background: ${COLORS.redline} !important;
          border-color: ${COLORS.redline} !important;
        }
      `}</style>
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageContent />;
}
