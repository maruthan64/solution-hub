"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Form, Input, Select, Spin, Typography, message } from "antd";
import { CheckCircleOutlined, RobotOutlined, SettingOutlined } from "@ant-design/icons";
import {
  AiProvider,
  getSettings,
  testAiConnection,
  updateBedrockCredentials,
  updateOrgSettings,
  updateSettings,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";

const { Title, Text } = Typography;

const AI_PROVIDER_OPTIONS: { value: AiProvider; label: string; hint: string }[] = [
  {
    value: "claude_cli",
    label: "Claude CLI (local subprocess)",
    hint: "Shells out to `claude -p` on the machine running the backend, using your existing Claude Code login instead of API billing. Requires the claude CLI installed and logged in there.",
  },
  {
    value: "bedrock",
    label: "AWS Bedrock",
    hint: "Calls the Bedrock Runtime Converse API directly over HTTPS using an AWS Bedrock API key — a bearer token, not an Access Key ID/Secret Access Key pair. Generate one from the AWS Bedrock console under API keys.",
  },
];

const BEDROCK_REGION_OPTIONS = [
  "us-east-1",
  "us-west-2",
  "ap-south-1",
  "ap-southeast-1",
  "ap-southeast-2",
  "eu-west-1",
  "eu-central-1",
].map((r) => ({ value: r, label: r }));

type Category = "general" | "ai-provider";

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 px-1">
      <div className="min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {description && <div className="text-xs text-gray-400 mt-0.5">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="settings-panel rounded-2xl border border-gray-200 bg-white px-4 divide-y divide-gray-100">
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { data: settings, loading, refetch } = useApi(getSettings);
  const [category, setCategory] = useState<Category>("general");

  const [aiProvider, setAiProvider] = useState<AiProvider>("claude_cli");
  const [savingProvider, setSavingProvider] = useState(false);

  const [orgForm] = Form.useForm();
  const [savingOrg, setSavingOrg] = useState(false);

  const [bedrockApiKey, setBedrockApiKey] = useState("");
  const [bedrockRegion, setBedrockRegion] = useState("");
  const [bedrockModel, setBedrockModel] = useState("");
  const [savingBedrock, setSavingBedrock] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (settings) {
      setAiProvider(settings.aiProvider);
      orgForm.setFieldsValue({
        orgName: settings.orgName,
        defaultCloud: settings.defaultCloud,
        defaultExportFormat: settings.defaultExportFormat,
      });
      setBedrockRegion(settings.bedrockRegion ?? "");
      setBedrockModel(settings.bedrockModel ?? "");
    }
  }, [settings, orgForm]);

  const handleSaveProvider = async () => {
    setSavingProvider(true);
    setTestResult(null);
    try {
      await updateSettings(aiProvider);
      messageApi.success("AI Assistant provider updated.");
      refetch();
    } catch {
      messageApi.error("Failed to update AI Assistant provider.");
    } finally {
      setSavingProvider(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testAiConnection(aiProvider);
      setTestResult({ ok: true, message: `Connected — the model replied "${res.reply}".` });
    } catch (err) {
      setTestResult({ ok: false, message: err instanceof Error ? err.message : "Connection test failed." });
    } finally {
      setTesting(false);
    }
  };

  const handleSaveOrg = async () => {
    const values = await orgForm.validateFields();
    setSavingOrg(true);
    try {
      await updateOrgSettings(values.orgName, values.defaultCloud, values.defaultExportFormat);
      messageApi.success("Organization settings saved.");
      refetch();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to save organization settings.");
    } finally {
      setSavingOrg(false);
    }
  };

  const handleSaveBedrock = async () => {
    setSavingBedrock(true);
    setTestResult(null);
    try {
      await updateBedrockCredentials({
        apiKey: bedrockApiKey.trim() || undefined,
        region: bedrockRegion.trim(),
        model: bedrockModel.trim(),
      });
      setBedrockApiKey("");
      messageApi.success("AWS Bedrock credentials saved.");
      refetch();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to save Bedrock credentials.");
    } finally {
      setSavingBedrock(false);
    }
  };

  const isProviderDirty = settings && aiProvider !== settings.aiProvider;

  const categories: { key: Category; label: string; icon: React.ReactNode }[] = [
    { key: "general", label: "General", icon: <SettingOutlined /> },
    { key: "ai-provider", label: "AI Provider", icon: <RobotOutlined /> },
  ];

  if (loading || !settings) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {contextHolder}
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          Settings
        </Title>
        <Text type="secondary">Organization details, branding, AI provider, and export defaults.</Text>
      </div>

      <div className="flex gap-6" style={{ maxWidth: 880 }}>
        <div className="w-[190px] shrink-0 flex flex-col gap-1">
          {categories.map((c) => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`flex items-center gap-2.5 text-sm rounded-lg px-3 py-2 text-left transition-colors ${
                category === c.key ? "bg-gray-100 font-medium text-gray-900" : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {category === "general" && (
            <>
              <Text type="secondary" className="text-xs uppercase tracking-wide font-semibold">
                Organization
              </Text>
              <Form form={orgForm} component={false}>
                <Panel>
                  <Row label="Organization Name">
                    <Form.Item name="orgName" noStyle rules={[{ required: true, message: "Required" }]}>
                      <Input className="settings-pill" style={{ width: 220 }} />
                    </Form.Item>
                  </Row>
                  <Row label="Default Cloud Provider">
                    <Form.Item name="defaultCloud" noStyle>
                      <Select
                        className="settings-pill"
                        style={{ width: 160 }}
                        options={["AWS", "Azure", "GCP", "Multi-Cloud"].map((v) => ({ label: v, value: v }))}
                      />
                    </Form.Item>
                  </Row>
                  <Row label="Default Export Format">
                    <Form.Item name="defaultExportFormat" noStyle>
                      <Select
                        className="settings-pill"
                        style={{ width: 160 }}
                        options={["DOCX", "PDF", "Markdown"].map((v) => ({ label: v, value: v }))}
                      />
                    </Form.Item>
                  </Row>
                </Panel>
              </Form>
              <Button type="primary" loading={savingOrg} onClick={handleSaveOrg} className="self-start">
                Save Changes
              </Button>
            </>
          )}

          {category === "ai-provider" && (
            <>
              <Text type="secondary" className="text-xs uppercase tracking-wide font-semibold">
                AI Assistant
              </Text>
              <Text type="secondary" className="text-sm -mt-2">
                Which provider the template editor&apos;s &quot;Ask AI&quot; feature uses.
              </Text>
              <Panel>
                <Row label="Provider">
                  <Select
                    className="settings-pill"
                    style={{ width: 260 }}
                    value={aiProvider}
                    onChange={(v) => {
                      setAiProvider(v);
                      setTestResult(null);
                    }}
                    options={AI_PROVIDER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  />
                </Row>
              </Panel>
              <Alert
                type="info"
                showIcon
                message={AI_PROVIDER_OPTIONS.find((o) => o.value === aiProvider)?.hint}
              />
              <Button
                type="primary"
                disabled={!isProviderDirty}
                loading={savingProvider}
                onClick={handleSaveProvider}
                className="self-start"
              >
                Save Changes
              </Button>

              {aiProvider === "claude_cli" && (
                <Alert
                  className="mt-1"
                  type="info"
                  showIcon
                  message="No key needed here — this uses the `claude` CLI already installed and logged in on the machine running the backend."
                />
              )}

              {aiProvider === "bedrock" && (
                <>
                  <Text type="secondary" className="text-xs uppercase tracking-wide font-semibold mt-3">
                    AWS Bedrock Credentials
                  </Text>
                  <Text type="secondary" className="text-sm -mt-2">
                    A Bedrock API key is a single bearer token — generate one from the AWS Bedrock console under
                    API keys. Leave it blank to keep the currently saved one.
                  </Text>
                  <Panel>
                    <Row label="API Key" description={settings.bedrockApiKeyPreview ?? "Not set"}>
                      <Input.Password
                        className="settings-pill"
                        placeholder="Leave blank to keep current"
                        style={{ width: 200 }}
                        value={bedrockApiKey}
                        onChange={(e) => setBedrockApiKey(e.target.value)}
                      />
                    </Row>
                    <Row label="Region">
                      <Select
                        className="settings-pill"
                        style={{ width: 200 }}
                        placeholder="Select a region"
                        value={bedrockRegion || undefined}
                        onChange={setBedrockRegion}
                        options={BEDROCK_REGION_OPTIONS}
                        allowClear
                        showSearch
                      />
                    </Row>
                    <Row
                      label="Model"
                      description='us-east-1: "anthropic.claude-3-5-sonnet-20241022-v2:0". Most other regions need a cross-region inference profile instead, e.g. ap-south-1 → "apac.anthropic.claude-3-5-sonnet-20241022-v2:0".'
                    >
                      <Input
                        className="settings-pill"
                        placeholder="anthropic.claude-3-5-sonnet-... or apac.anthropic...."
                        style={{ width: 200 }}
                        value={bedrockModel}
                        onChange={(e) => setBedrockModel(e.target.value)}
                      />
                    </Row>
                  </Panel>
                  <Button type="primary" loading={savingBedrock} onClick={handleSaveBedrock} className="self-start">
                    Save Bedrock Credentials
                  </Button>
                </>
              )}

              <div className="flex items-center gap-3 mt-3">
                <Button icon={<CheckCircleOutlined />} loading={testing} onClick={handleTestConnection}>
                  Test Connection
                </Button>
                <Text type="secondary" className="text-xs">
                  Makes one real request through the saved credentials above.
                </Text>
              </div>
              {testResult && (
                <Alert type={testResult.ok ? "success" : "error"} showIcon message={testResult.message} />
              )}
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        .settings-panel .ant-select-selector,
        .settings-panel .ant-input,
        .settings-panel .ant-input-affix-wrapper {
          border-radius: 999px !important;
        }
        .settings-pill.ant-input,
        .settings-pill .ant-input {
          border-radius: 999px;
        }
      `}</style>
    </div>
  );
}
