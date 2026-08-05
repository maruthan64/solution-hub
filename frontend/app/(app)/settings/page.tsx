"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, Divider, Form, Input, Select, Space, Spin, Typography, message } from "antd";
import {
  AiProvider,
  getSettings,
  rotateApiKey,
  updateBedrockCredentials,
  updateOrgSettings,
  updateSettings,
} from "@/lib/api";
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
  {
    value: "bedrock",
    label: "AWS Bedrock",
    hint: 'Calls litellm.completion() with a bedrock/ model. Enter credentials directly below, or leave them blank to fall back to the backend\'s own environment — an IAM role attached to the EC2 instance is the more secure option if you\'re running there.',
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

export default function SettingsPage() {
  const { data: settings, loading, refetch } = useApi(getSettings);
  const [aiProvider, setAiProvider] = useState<AiProvider>("litellm");
  const [savingProvider, setSavingProvider] = useState(false);

  const [orgForm] = Form.useForm();
  const [savingOrg, setSavingOrg] = useState(false);

  const [apiKey, setApiKey] = useState("");
  const [rotating, setRotating] = useState(false);

  const [bedrockAccessKeyId, setBedrockAccessKeyId] = useState("");
  const [bedrockSecretAccessKey, setBedrockSecretAccessKey] = useState("");
  const [bedrockRegion, setBedrockRegion] = useState("");
  const [bedrockModel, setBedrockModel] = useState("");
  const [savingBedrock, setSavingBedrock] = useState(false);

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

  const handleSaveBedrock = async () => {
    setSavingBedrock(true);
    try {
      await updateBedrockCredentials({
        accessKeyId: bedrockAccessKeyId.trim() || undefined,
        secretAccessKey: bedrockSecretAccessKey.trim() || undefined,
        region: bedrockRegion.trim(),
        model: bedrockModel.trim(),
      });
      setBedrockAccessKeyId("");
      setBedrockSecretAccessKey("");
      messageApi.success("AWS Bedrock credentials saved.");
      refetch();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to save Bedrock credentials.");
    } finally {
      setSavingBedrock(false);
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
          Used by the FastAPI backend to authenticate outbound calls through LiteLLM. Not used
          by AWS Bedrock — see the card below for that.
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

      <Card title="AWS Bedrock Credentials">
        <Text type="secondary" className="text-sm">
          Only used when AI Assistant above is set to AWS Bedrock. Leave Access Key ID and
          Secret Access Key blank to keep them unchanged (or to fall back to the backend&apos;s
          own environment / IAM role instead of a stored key).
        </Text>
        <Divider style={{ margin: "12px 0" }} />
        {loading || !settings ? (
          <Spin />
        ) : (
          <>
            {(settings.bedrockAccessKeyIdPreview || settings.bedrockSecretKeySet) && (
              <Space direction="vertical" size={0} className="mb-2">
                {settings.bedrockAccessKeyIdPreview && (
                  <Text type="secondary" className="text-sm">
                    Current Access Key ID: <Text code>{settings.bedrockAccessKeyIdPreview}</Text>
                  </Text>
                )}
                <Text type="secondary" className="text-sm">
                  Secret Access Key: {settings.bedrockSecretKeySet ? "set" : "not set"}
                </Text>
              </Space>
            )}
            <Form layout="vertical" requiredMark={false}>
              <Form.Item label="Access Key ID">
                <Input.Password
                  placeholder="AKIA..."
                  size="large"
                  value={bedrockAccessKeyId}
                  onChange={(e) => setBedrockAccessKeyId(e.target.value)}
                />
              </Form.Item>
              <Form.Item label="Secret Access Key">
                <Input.Password
                  placeholder="Leave blank to keep the current one"
                  size="large"
                  value={bedrockSecretAccessKey}
                  onChange={(e) => setBedrockSecretAccessKey(e.target.value)}
                />
              </Form.Item>
              <Form.Item label="Region">
                <Select
                  size="large"
                  placeholder="Select a region"
                  value={bedrockRegion || undefined}
                  onChange={setBedrockRegion}
                  options={BEDROCK_REGION_OPTIONS}
                  allowClear
                  showSearch
                />
              </Form.Item>
              <Form.Item
                label="Model"
                help='e.g. "bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0" — see the AWS Bedrock console for available model IDs in your region.'
              >
                <Input
                  placeholder="bedrock/anthropic.claude-3-5-sonnet-..."
                  size="large"
                  value={bedrockModel}
                  onChange={(e) => setBedrockModel(e.target.value)}
                />
              </Form.Item>
              <Button type="primary" loading={savingBedrock} onClick={handleSaveBedrock}>
                Save Bedrock Credentials
              </Button>
            </Form>
          </>
        )}
      </Card>
    </div>
  );
}
