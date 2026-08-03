"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Input, Popconfirm, Select, Spin, Table, Tag, Typography, message } from "antd";
import { DeleteOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { deleteProject, getProjects } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Project, ProjectStatus } from "@/lib/types";
import { CloudProviderIcon } from "@/components/icons/CloudIcons";
import NewProjectModal from "@/components/NewProjectModal";

const { Title, Text } = Typography;

const STATUS_COLOR: Record<ProjectStatus, string> = {
  Draft: "default",
  "In Review": "gold",
  Approved: "green",
  Archived: "default",
};

export default function ProjectsPage() {
  const { data: projects, loading, refetch } = useApi(getProjects);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "All">("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleDelete = async (project: Project) => {
    try {
      await deleteProject(project.id);
      messageApi.success(`${project.name} deleted.`);
      refetch();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to delete project.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {contextHolder}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            Projects
          </Title>
          <Text type="secondary">All solution documentation projects across your organization.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          New Project
        </Button>
      </div>

      <Card>
        <div className="flex gap-3 mb-4">
          <Input
            placeholder="Search by project or customer"
            prefix={<SearchOutlined />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ maxWidth: 320 }}
            allowClear
          />
          <Select
            value={status}
            onChange={setStatus}
            style={{ width: 160 }}
            options={["All", "Draft", "In Review", "Approved", "Archived"].map((s) => ({ label: s, value: s }))}
          />
        </div>

        {loading || !projects ? (
          <div className="flex justify-center py-20">
            <Spin size="large" />
          </div>
        ) : (
          <Table
            rowKey="id"
            dataSource={projects.filter((p) => {
              const matchesQuery =
                p.name.toLowerCase().includes(query.toLowerCase()) ||
                p.customer.toLowerCase().includes(query.toLowerCase());
              const matchesStatus = status === "All" || p.status === status;
              return matchesQuery && matchesStatus;
            })}
            columns={[
              {
                title: "Project",
                dataIndex: "name",
                render: (name: string, record) => (
                  <Link href={`/projects/${record.id}`} className="font-medium">
                    {name}
                  </Link>
                ),
              },
              { title: "Customer", dataIndex: "customer" },
              {
                title: "Cloud",
                dataIndex: "cloud",
                render: (c: string) => (
                  <Tag className="flex items-center gap-1.5 w-fit" style={{ paddingBlock: 2 }}>
                    <CloudProviderIcon cloud={c} width={14} height={14} />
                    {c}
                  </Tag>
                ),
              },
              {
                title: "Status",
                dataIndex: "status",
                render: (s: ProjectStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
              },
              { title: "Owner", dataIndex: "owner" },
              { title: "Docs", dataIndex: "docsGenerated", align: "right" as const },
              { title: "Updated", dataIndex: "updated" },
              {
                title: "",
                key: "action",
                render: (_: unknown, record: Project) => (
                  <Popconfirm
                    title="Delete this project?"
                    description="This can't be undone."
                    okText="Delete"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => handleDelete(record)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                ),
              },
            ]}
          />
        )}
      </Card>

      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => refetch()} />
    </div>
  );
}
