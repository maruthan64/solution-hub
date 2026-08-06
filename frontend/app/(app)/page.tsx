"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Col, Card, Row, Spin, Statistic, Table, Tag, Typography } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  ProjectOutlined,
  FileDoneOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { getAllQuotes, getCurrentUser, getDocuments, getProjects } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { greeting } from "@/lib/greeting";
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

function daysAgo(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

export default function DashboardPage() {
  const { data: projects, loading: projectsLoading, refetch } = useApi(getProjects);
  const { data: documents, loading: documentsLoading } = useApi(getDocuments);
  const { data: quotes, loading: quotesLoading } = useApi(getAllQuotes);
  const { data: user } = useApi(getCurrentUser);
  const [modalOpen, setModalOpen] = useState(false);

  if (projectsLoading || documentsLoading || quotesLoading || !projects || !documents || !quotes) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  const recentProjects = projects.slice(0, 4);
  const recentDocuments = documents.slice(0, 5);
  const pendingReview = documents.filter((d) => d.status === "In Review");
  const updatedThisWeek = projects.filter((p) => daysAgo(p.updated) <= 7).length;
  const thisMonthPrefix = new Date().toISOString().slice(0, 7);
  const quotesThisMonth = quotes.filter((q) => q.created.startsWith(thisMonthPrefix)).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            {greeting(user?.name)}
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
            <Statistic
              title="Active Projects"
              value={projects.filter((p) => p.status !== "Archived").length}
              prefix={<ProjectOutlined />}
            />
            <Text type="secondary" className="text-xs">
              {updatedThisWeek} updated this week
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Documents Generated" value={documents.length} prefix={<FileTextOutlined />} />
            <Text type="secondary" className="text-xs">
              across {projects.length} projects
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pending Review"
              value={pendingReview.length}
              prefix={<ClockCircleOutlined />}
              valueStyle={pendingReview.length > 0 ? { color: "#d97706" } : undefined}
            />
            <Text type="secondary" className="text-xs">
              {pendingReview.length === 0 ? "All caught up" : "awaiting approval"}
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="Quotes Generated" value={quotesThisMonth} prefix={<FileDoneOutlined />} />
            <Text type="secondary" className="text-xs">
              this month
            </Text>
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
          <div className="flex flex-col gap-4">
            <Card
              title="Needs Your Review"
              extra={
                <Link href="/documents">
                  <Text type="secondary">View all</Text>
                </Link>
              }
            >
              {pendingReview.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-6 text-center">
                  <CheckCircleOutlined style={{ fontSize: 22, color: "#16a34a" }} />
                  <Text type="secondary" className="text-sm">
                    Nothing waiting on review.
                  </Text>
                </div>
              ) : (
                <div className="flex flex-col gap-1 -mx-6" style={{ marginTop: -8 }}>
                  {pendingReview.slice(0, 4).map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className="flex items-center justify-between gap-3 px-6 py-2 hover:bg-gray-50"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{doc.title}</div>
                        <Text type="secondary" className="text-xs">
                          {doc.project} · Last updated {doc.updated}
                        </Text>
                      </div>
                      <Tag color="gold" className="shrink-0">
                        Review
                      </Tag>
                    </Link>
                  ))}
                </div>
              )}
            </Card>

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
          </div>
        </Col>
      </Row>
    </div>
  );
}
