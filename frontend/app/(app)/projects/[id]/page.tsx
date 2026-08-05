"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Col, Popconfirm, Row, Space, Spin, Tag, Table, Typography, message } from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  FileTextOutlined,
  MessageOutlined,
  ShoppingCartOutlined,
} from "@ant-design/icons";
import { deleteProject, getDocuments, getProject, getProjectQuotes } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ProjectStatus } from "@/lib/types";
import { CloudProviderIcon } from "@/components/icons/CloudIcons";

const { Title, Text } = Typography;

const STATUS_COLOR: Record<ProjectStatus, string> = {
  Draft: "default",
  "In Review": "gold",
  Approved: "green",
  Archived: "default",
};

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: project, loading: projectLoading } = useApi(() => getProject(id), [id]);
  const { data: documents, loading: documentsLoading } = useApi(getDocuments);
  const { data: quotes, loading: quotesLoading } = useApi(() => getProjectQuotes(id), [id]);
  const [deleting, setDeleting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  if (projectLoading || documentsLoading || quotesLoading || !project || !documents || !quotes) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  const projectDocs = documents.filter((d) => d.project === project.name);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProject(id);
      messageApi.success("Project deleted.");
      router.push("/projects");
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to delete project.");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {contextHolder}
      <Link href="/projects" className="inline-flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeftOutlined /> Back to Projects
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            {project.name}
          </Title>
          <Text type="secondary">{project.customer}</Text>
        </div>
        <Space>
          <Popconfirm
            title="Delete this project?"
            description="This can't be undone."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={handleDelete}
          >
            <Button danger icon={<DeleteOutlined />} loading={deleting}>
              Delete
            </Button>
          </Popconfirm>
          <Link
            href={`/service-catalog?projectId=${id}&project=${encodeURIComponent(project.name)}&customer=${encodeURIComponent(project.customer)}`}
          >
            <Button icon={<ShoppingCartOutlined />}>Generate Quote</Button>
          </Link>
          <Link href="/chat">
            <Button type="primary" icon={<MessageOutlined />}>
              Continue in AI Chat
            </Button>
          </Link>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={6}>
          <Card size="small">
            <Text type="secondary" className="text-xs block">
              Status
            </Text>
            <Tag color={STATUS_COLOR[project.status]}>{project.status}</Tag>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Text type="secondary" className="text-xs block">
              Cloud
            </Text>
            <span className="inline-flex items-center gap-1.5">
              <CloudProviderIcon cloud={project.cloud} width={16} height={16} />
              <Text strong>{project.cloud}</Text>
            </span>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Text type="secondary" className="text-xs block">
              Owner
            </Text>
            <Text strong>{project.owner}</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Text type="secondary" className="text-xs block">
              Last Updated
            </Text>
            <Text strong>{project.updated}</Text>
          </Card>
        </Col>
      </Row>

      {(project.description || project.sourceDocument || project.capabilityName) && (
        <Card size="small">
          {project.description && (
            <Text type="secondary" className="block mb-2">
              {project.description}
            </Text>
          )}
          {project.capabilityName && (
            <div className="mb-2">
              <Tag color="purple">Capability: {project.capabilityName}</Tag>
            </div>
          )}
          {project.sourceDocument && (
            <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
              <FileTextOutlined /> Uploaded source document: <Text strong>{project.sourceDocument}</Text>
            </span>
          )}
        </Card>
      )}

      <Card title="Generated Documents">
        <Table
          rowKey="id"
          dataSource={projectDocs}
          pagination={false}
          columns={[
            {
              title: "Document",
              dataIndex: "title",
              render: (title: string, record) => (
                <Link href={`/documents/${record.id}`} className="font-medium">
                  {title}
                </Link>
              ),
            },
            { title: "Type", dataIndex: "type", render: (t: string) => <Tag>{t}</Tag> },
            { title: "Version", dataIndex: "version" },
            { title: "Status", dataIndex: "status" },
            { title: "Updated", dataIndex: "updated" },
          ]}
        />
      </Card>

      <Card title="Quotes">
        <Table
          rowKey="id"
          dataSource={quotes}
          pagination={false}
          locale={{ emptyText: "No quotes generated for this project yet — use Generate Quote above." }}
          columns={[
            { title: "Customer", dataIndex: "customerName" },
            { title: "Packages", dataIndex: "packageIds", render: (ids: string[]) => ids.length },
            { title: "Total", dataIndex: "total" },
            { title: "Format", dataIndex: "format", render: (f: string) => <Tag>{f.toUpperCase()}</Tag> },
            { title: "Generated", dataIndex: "created" },
            { title: "By", dataIndex: "createdBy" },
          ]}
        />
      </Card>
    </div>
  );
}
