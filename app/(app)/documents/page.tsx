"use client";

import Link from "next/link";
import { Button, Card, Space, Spin, Table, Tag, Typography } from "antd";
import { FileWordOutlined, FilePdfOutlined, FileMarkdownOutlined } from "@ant-design/icons";
import { getDocuments } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { DocStatus, DocType, GeneratedDocument } from "@/lib/types";

const { Title, Text } = Typography;

const TYPE_COLOR: Record<DocType, string> = {
  SDD: "blue",
  ADR: "purple",
  BOM: "cyan",
  "Cost Estimate": "gold",
  "Security Review": "red",
  Runbook: "green",
  Handover: "geekblue",
};

const STATUS_COLOR: Record<DocStatus, string> = {
  Draft: "default",
  "In Review": "gold",
  Approved: "green",
};

function downloadMarkdown(doc: GeneratedDocument) {
  const blob = new Blob([doc.content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${doc.title.replace(/[^A-Za-z0-9_-]+/g, "_")}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DocumentsPage() {
  const { data: documents, loading } = useApi(getDocuments);

  if (loading || !documents) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          Documents
        </Title>
        <Text type="secondary">All generated documents across projects. Export to Word, PDF, or Markdown.</Text>
      </div>

      <Card>
        <Table
          rowKey="id"
          dataSource={documents}
          columns={[
            {
              title: "Document",
              dataIndex: "title",
              render: (title: string, record: GeneratedDocument) => (
                <Link href={`/documents/${record.id}`} className="font-medium">
                  {title}
                </Link>
              ),
            },
            { title: "Project", dataIndex: "project" },
            {
              title: "Type",
              dataIndex: "type",
              render: (t: DocType) => <Tag color={TYPE_COLOR[t]}>{t}</Tag>,
            },
            { title: "Version", dataIndex: "version" },
            {
              title: "Status",
              dataIndex: "status",
              render: (s: DocStatus) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
            },
            { title: "Updated", dataIndex: "updated" },
            {
              title: "Export",
              key: "export",
              render: (_: unknown, record: GeneratedDocument) => (
                <Space>
                  <Button
                    size="small"
                    icon={<FileWordOutlined />}
                    title="Export as Word"
                    onClick={() => window.open(`/api/documents/${record.id}/export?format=docx`, "_blank")}
                  />
                  <Button
                    size="small"
                    icon={<FilePdfOutlined />}
                    title="Export as PDF"
                    onClick={() => window.open(`/api/documents/${record.id}/export?format=pdf`, "_blank")}
                  />
                  <Button
                    size="small"
                    icon={<FileMarkdownOutlined />}
                    title="Export as Markdown"
                    onClick={() => downloadMarkdown(record)}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
