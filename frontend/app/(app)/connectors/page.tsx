"use client";

import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Divider,
  Form,
  Input,
  Modal,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { EditOutlined, LinkOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { addServer, getConnectors, getServerDetail, removeServer, startReauth, completeReauth } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Connector } from "@/lib/types";

const { Title, Text, Paragraph } = Typography;

const STATUS_COLOR: Record<Connector["status"], string> = {
  connected: "green",
  needs_auth: "gold",
  pending: "blue",
  unknown: "default",
};

export default function ConnectorsPage() {
  const { data: connectors, loading, refetch } = useApi(getConnectors);
  const [reauthTarget, setReauthTarget] = useState<string | null>(null);
  const [reauthSessionId, setReauthSessionId] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState("");
  const [reauthLoading, setReauthLoading] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [addForm] = Form.useForm();
  const [adding, setAdding] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleReconnect = async (name: string) => {
    setReauthTarget(name);
    setReauthLoading(true);
    setAuthUrl(null);
    setRedirectUrl("");
    try {
      const result = await startReauth(name);
      setReauthSessionId(result.sessionId);
      if (result.authUrl) {
        setAuthUrl(result.authUrl);
      } else {
        messageApi.error(result.output || "Could not start the reconnect flow.");
        setReauthTarget(null);
      }
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to start reconnect.");
      setReauthTarget(null);
    } finally {
      setReauthLoading(false);
    }
  };

  const handleCompleteReauth = async () => {
    if (!reauthSessionId || !redirectUrl.trim()) return;
    setReauthLoading(true);
    try {
      const result = await completeReauth(reauthSessionId, redirectUrl.trim());
      if (result.success) {
        messageApi.success(`${reauthTarget} reconnected.`);
        setReauthTarget(null);
        refetch();
      } else {
        messageApi.error(result.output || "Reconnect did not complete successfully.");
      }
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to complete reconnect.");
    } finally {
      setReauthLoading(false);
    }
  };

  const closeAddModal = () => {
    setAddModalOpen(false);
    setEditingName(null);
    addForm.resetFields();
  };

  const handleAddServer = async () => {
    const values = await addForm.validateFields();
    setAdding(true);
    try {
      // The CLI has no "update" command — modifying means remove the old
      // entry (even if the name changed) then add the new values.
      if (editingName) {
        await removeServer(editingName);
      }
      await addServer(values);
      messageApi.success(editingName ? `${values.name} updated.` : `${values.name} added.`);
      closeAddModal();
      refetch();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to save server.");
    } finally {
      setAdding(false);
    }
  };

  const handleEdit = async (name: string) => {
    setLoadingEdit(true);
    try {
      const detail = await getServerDetail(name);
      setEditingName(name);
      addForm.setFieldsValue(detail);
      setAddModalOpen(true);
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to load server details.");
    } finally {
      setLoadingEdit(false);
    }
  };

  const handleRemove = async (name: string) => {
    try {
      await removeServer(name);
      messageApi.success(`${name} removed.`);
      refetch();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to remove server.");
    }
  };

  const claudeAiConnectors = connectors?.filter((c) => c.category === "claude_ai") ?? [];
  const customConnectors = connectors?.filter((c) => c.category === "custom") ?? [];

  return (
    <div className="flex flex-col gap-4">
      {contextHolder}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            Connectors
          </Title>
          <Text type="secondary">MCP connectors available to the Claude CLI on this machine.</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <Card
        title="Your claude.ai Connectors"
        extra={
          <a href="https://claude.ai/settings/connectors" target="_blank" rel="noopener noreferrer">
            <LinkOutlined /> Add new on claude.ai
          </a>
        }
      >
        <Text type="secondary" className="text-sm block mb-3">
          These are provisioned on your claude.ai account, not here — this app can only show their status and help
          you re-authenticate one that&apos;s disconnected. To add a brand new one (Gmail, Slack, etc.), use the
          link above.
        </Text>
        {loading || !connectors ? (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        ) : (
          <Table
            rowKey="name"
            dataSource={claudeAiConnectors}
            pagination={false}
            columns={[
              { title: "Connector", dataIndex: "name", render: (n: string) => n.replace(/^claude\.ai /, "") },
              { title: "URL", dataIndex: "url", render: (u: string) => <Text code className="text-xs">{u}</Text> },
              {
                title: "Status",
                dataIndex: "status",
                render: (s: Connector["status"], record: Connector) => (
                  <Tag color={STATUS_COLOR[s]}>{record.statusText.replace(/^[✔!⏸]\s*/, "")}</Tag>
                ),
              },
              {
                title: "",
                key: "action",
                render: (_: unknown, record: Connector) =>
                  record.status === "needs_auth" ? (
                    <Button size="small" onClick={() => handleReconnect(record.name)}>
                      Reconnect
                    </Button>
                  ) : null,
              },
            ]}
          />
        )}
      </Card>

      <Card
        title="Custom MCP Servers"
        extra={
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingName(null);
              addForm.resetFields();
              setAddModalOpen(true);
            }}
          >
            Add Server
          </Button>
        }
      >
        <Text type="secondary" className="text-sm block mb-3">
          MCP servers you manage yourself — a command to run locally, or an HTTP/SSE endpoint you know. Added at user
          scope, so they&apos;re available regardless of which directory the backend runs from.
        </Text>
        {loading || !connectors ? (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        ) : customConnectors.length === 0 ? (
          <Text type="secondary" className="text-sm">
            No custom servers yet.
          </Text>
        ) : (
          <Table
            rowKey="name"
            dataSource={customConnectors}
            pagination={false}
            columns={[
              { title: "Name", dataIndex: "name" },
              { title: "Command / URL", dataIndex: "url", render: (u: string) => <Text code className="text-xs">{u}</Text> },
              {
                title: "Status",
                dataIndex: "status",
                render: (s: Connector["status"], record: Connector) => (
                  <Tag color={STATUS_COLOR[s]}>{record.statusText.replace(/^[✔!⏸✘]\s*/, "")}</Tag>
                ),
              },
              {
                title: "",
                key: "action",
                render: (_: unknown, record: Connector) => (
                  <div className="flex gap-2">
                    <Button size="small" icon={<EditOutlined />} loading={loadingEdit} onClick={() => handleEdit(record.name)}>
                      Edit
                    </Button>
                    <Button size="small" danger onClick={() => handleRemove(record.name)}>
                      Remove
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Card>

      <Modal
        title={`Reconnect ${reauthTarget ?? ""}`}
        open={!!reauthTarget}
        onCancel={() => setReauthTarget(null)}
        footer={null}
        destroyOnHidden
      >
        {authUrl ? (
          <div className="flex flex-col gap-3">
            <Paragraph className="text-sm">
              1. Open this link and authorize the connector:
            </Paragraph>
            <a href={authUrl} target="_blank" rel="noopener noreferrer" className="break-all text-sm">
              {authUrl}
            </a>
            <Divider style={{ margin: "8px 0" }} />
            <Paragraph className="text-sm" style={{ marginBottom: 4 }}>
              2. After authorizing, paste the URL you land on below:
            </Paragraph>
            <Input
              placeholder="https://..."
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
            />
            <Button
              type="primary"
              loading={reauthLoading}
              disabled={!redirectUrl.trim()}
              onClick={handleCompleteReauth}
            >
              Complete Reconnect
            </Button>
          </div>
        ) : (
          <div className="flex justify-center py-6">
            <Spin />
          </div>
        )}
      </Modal>

      <Modal
        title={editingName ? `Edit ${editingName}` : "Add Custom MCP Server"}
        open={addModalOpen}
        onCancel={closeAddModal}
        onOk={handleAddServer}
        okText={editingName ? "Save" : "Add"}
        confirmLoading={adding}
        destroyOnHidden
      >
        <Form form={addForm} layout="vertical" requiredMark={false} initialValues={{ transport: "stdio" }}>
          <Form.Item label="Name" name="name" rules={[{ required: true, message: "Enter a name" }]}>
            <Input placeholder="e.g. my-server" size="large" />
          </Form.Item>
          <Form.Item label="Transport" name="transport">
            <Select
              size="large"
              options={[
                { value: "stdio", label: "stdio (local command)" },
                { value: "http", label: "HTTP" },
                { value: "sse", label: "SSE" },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="Command or URL"
            name="commandOrUrl"
            rules={[{ required: true, message: "Enter a command (stdio) or URL (HTTP/SSE)" }]}
          >
            <Input placeholder="e.g. npx my-mcp-server, or https://example.com/mcp" size="large" />
          </Form.Item>
        </Form>
        <Alert
          type="info"
          showIcon
          message="This writes to the Claude CLI's real configuration on the machine running this app's backend."
        />
      </Modal>
    </div>
  );
}
