"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, Divider, Form, Input, Select, Spin, Typography, message } from "antd";
import { AiProvider, getSettings, rotateApiKey, updateOrgSettings, updateSettings } from "@/lib/api";
import { useApi } from "@/lib/useApi";

const { Title, Text } = Typography;

const AI_PROVIDER_OPTIONS: { value: AiProvider; label: string; hint: string }[] = [
  {
    value: "litellm",
    label: "LiteLLM (API key or Ollama)",
    hint: "Calls litellm.completion() using LITELLM_MODEL + a provider API key from backend/.env (or a local Ollama model — no key needed).",
  },
  {
    value: "claude_cli",
    label: "Claude CLI (local subprocess)",
    hint: "Shells out to `claude -p` on the machine running the backend, using your existing Claude Code login instead of API billing. Requires the claude CLI installed and logged in there.",
  },
];

export default function SettingsPage() {
  const { data: settings, loading, refetch } = useApi(getSettings);
  const [aiProvider, setAiProvider] = useState<AiProvider>("litellm");
  const [savingProvider, setSavingProvider] = useState(false);

  const [orgForm] = Form.useForm();
  const [savingOrg, setSavingOrg] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [rotating, setRotating] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (settings) {
      setAiProvider(settings.aiProvider);
      orgForm.setFieldsValue({
        orgName: settings.orgName,
        defaultCloud: settings.defaultCloud,
        defaultExportFormat: settings.defaultExportFormat,
      });
    }
  }, [settings, orgForm]);

  const handleSaveProvider = async () => {
    setSavingProvider(true);
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

  const handleRotateKey = async () => {
    if (!apiKey.trim()) return;
    setRotating(true);
    try {
      await rotateApiKey(apiKey.trim());
      setApiKey("");
      messageApi.success("LiteLLM proxy key updated.");
      refetch();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to rotate key.");
    } finally {
      setRotating(false);
    }
  };

  const isProviderDirty = settings && aiProvider !== settings.aiProvider;

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 640 }}>
      {contextHolder}
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          Settings
        </Title>
        <Text type="secondary">Organization details, branding, and export defaults.</Text>
      </div>

      <Card title="AI Assistant">
        <Text type="secondary" className="text-sm">
          Which provider the template editor&apos;s &quot;Ask AI&quot; feature uses.
        </Text>
        <Divider style={{ margin: "12px 0" }} />
        {loading || !settings ? (
          <Spin />
        ) : (
          <>
            <Select
              size="large"
              value={aiProvider}
              onChange={setAiProvider}
              style={{ width: "100%" }}
              options={AI_PROVIDER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            <Alert
              className="mt-3"
              type="info"
              showIcon
              message={AI_PROVIDER_OPTIONS.find((o) => o.value === aiProvider)?.hint}
            />
            <Button
              type="primary"
              className="mt-3"
              disabled={!isProviderDirty}
              loading={savingProvider}
              onClick={handleSaveProvider}
            >
              Save Changes
            </Button>
          </>
        )}
      </Card>

      <Card title="Organization">
        {loading || !settings ? (
          <Spin />
        ) : (
          <Form form={orgForm} layout="vertical" requiredMark={false}>
            <Form.Item label="Organization Name" name="orgName" rules={[{ required: true, message: "Required" }]}>
              <Input size="large" />
            </Form.Item>
            <Form.Item label="Default Cloud Provider" name="defaultCloud">
              <Select
                size="large"
                options={["AWS", "Azure", "GCP", "Multi-Cloud"].map((v) => ({ label: v, value: v }))}
              />
            </Form.Item>
            <Form.Item label="Default Export Format" name="defaultExportFormat">
              <Select size="large" options={["DOCX", "PDF", "Markdown"].map((v) => ({ label: v, value: v }))} />
            </Form.Item>
            <Button type="primary" loading={savingOrg} onClick={handleSaveOrg}>
              Save Changes
            </Button>
          </Form>
        )}
      </Card>

      <Card title="API Keys">
        <Text type="secondary" className="text-sm">
          Used by the FastAPI backend to authenticate outbound calls through LiteLLM.
        </Text>
        <Divider style={{ margin: "12px 0" }} />
        {settings?.apiKeyPreview && (
          <Text type="secondary" className="text-sm block mb-2">
            Current key: <Text code>{settings.apiKeyPreview}</Text>
          </Text>
        )}
        <Form layout="vertical" requiredMark={false}>
          <Form.Item label="LiteLLM Proxy Key">
            <Input.Password
              placeholder="sk-litellm-..."
              size="large"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </Form.Item>
          <Button loading={rotating} disabled={!apiKey.trim()} onClick={handleRotateKey}>
            Rotate Key
          </Button>
        </Form>
      </Card>
    </div>
  );
}
