"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Col, Card, Row, Spin, Statistic, Table, Tag, Typography } from "antd";
import {
  ProjectOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  DollarOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { getDocuments, getProjects } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ProjectStatus } from "@/lib/types";
import { CloudProviderIcon } from "@/components/icons/CloudIcons";
import NewProjectModal from "@/components/NewProjectModal";

const { Title, Text } = Typography;

const STATUS_COLOR: Record<ProjectStatus, string> = {
  Draft: "default",
  "In Review": "gold",
  Approved: "green",
  Archived: "default",
};

export default function DashboardPage() {
  const { data: projects, loading: projectsLoading, refetch } = useApi(getProjects);
  const { data: documents, loading: documentsLoading } = useApi(getDocuments);
  const [modalOpen, setModalOpen] = useState(false);

  if (projectsLoading || documentsLoading || !projects || !documents) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  const recentProjects = projects.slice(0, 4);
  const recentDocuments = documents.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            Welcome back, admin
          </Title>
          <Text type="secondary">Here&apos;s what&apos;s happening across your solution documentation projects.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          New Project
        </Button>
      </div>

      <NewProjectModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => refetch()} />

      <Row gutter={16}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Active Projects" value={projects.filter((p) => p.status !== "Archived").length} prefix={<ProjectOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Documents Generated" value={documents.length} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="AI Requests This Month" value={1284} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Est. Monthly AI Cost" value={253.3} precision={2} prefix={<DollarOutlined />} />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card
            title="Recent Projects"
            extra={
              <Link href="/projects">
                <Text type="secondary">View all</Text>
              </Link>
            }
          >
            <Table
              size="small"
              pagination={false}
              dataSource={recentProjects}
              rowKey="id"
              columns={[
                { title: "Project", dataIndex: "name" },
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
                  render: (status: ProjectStatus) => <Tag color={STATUS_COLOR[status]}>{status}</Tag>,
                },
                { title: "Updated", dataIndex: "updated" },
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title="Recent Documents"
            extra={
              <Link href="/documents">
                <Text type="secondary">View all</Text>
              </Link>
            }
          >
            <Table
              size="small"
              pagination={false}
              dataSource={recentDocuments}
              rowKey="id"
              columns={[
                { title: "Document", dataIndex: "title" },
                { title: "Type", dataIndex: "type", render: (t: string) => <Tag>{t}</Tag> },
                { title: "Version", dataIndex: "version" },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
