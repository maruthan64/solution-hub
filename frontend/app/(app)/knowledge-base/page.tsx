"use client";

import { useState } from "react";
import { Button, Card, Select, Space, Spin, Table, Tag, Typography, Upload, message } from "antd";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import { DownloadOutlined, InboxOutlined } from "@ant-design/icons";
import { deleteKnowledgeDoc, getKnowledgeDocs, uploadKnowledgeDoc } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { KnowledgeDoc } from "@/lib/types";

const { Title, Text } = Typography;
const { Dragger } = Upload;

const CATEGORIES = [
  "Best Practices",
  "Terraform Standards",
  "Naming Standards",
  "Security Standards",
  "Networking Standards",
  "Monitoring Standards",
  "Cost Standards",
];

export default function KnowledgeBasePage() {
  const { data: docs, loading, refetch } = useApi(getKnowledgeDocs);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [messageApi, contextHolder] = message.useMessage();

  const handleUpload = async (options: UploadRequestOption) => {
    const { file, onSuccess, onError } = options;
    try {
      await uploadKnowledgeDoc(category, file as File);
      messageApi.success(`${(file as File).name} uploaded.`);
      onSuccess?.({});
      refetch();
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Upload failed");
      messageApi.error(error.message);
      onError?.(error);
    }
  };

  const handleDelete = async (doc: KnowledgeDoc) => {
    try {
      await deleteKnowledgeDoc(doc.id);
      messageApi.success(`${doc.name} removed.`);
      refetch();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to remove file.");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {contextHolder}
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          Knowledge Base
        </Title>
        <Text type="secondary">
          Upload company standards so generated documents stay consistent with your conventions.
        </Text>
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Text type="secondary" className="text-sm">
            Category for next upload:
          </Text>
          <Select
            value={category}
            onChange={setCategory}
            style={{ width: 220 }}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
        <Dragger multiple customRequest={handleUpload} showUploadList={{ showRemoveIcon: false }}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Click or drag files to upload</p>
          <p className="ant-upload-hint text-gray-400">
            PDF, Word, or Markdown — architecture standards, security policies, naming conventions, Terraform standards
          </p>
        </Dragger>
      </Card>

      <Card title="Uploaded Standards">
        {loading || !docs ? (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        ) : (
          <Table
            rowKey="id"
            dataSource={docs}
            columns={[
              { title: "File", dataIndex: "name" },
              { title: "Category", dataIndex: "category", render: (c: string) => <Tag>{c}</Tag> },
              { title: "Uploaded By", dataIndex: "uploadedBy" },
              { title: "Date", dataIndex: "uploaded" },
              { title: "Size", dataIndex: "size" },
              {
                title: "",
                key: "action",
                render: (_: unknown, record: KnowledgeDoc) => (
                  <Space>
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => window.open(`/api/knowledge-base/${record.id}/download`, "_blank")}
                    />
                    <Button size="small" danger onClick={() => handleDelete(record)}>
                      Remove
                    </Button>
                  </Space>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
