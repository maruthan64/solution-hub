"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Col, Row, Spin, Tag, Typography } from "antd";
import { FileTextOutlined, PlusOutlined } from "@ant-design/icons";
import { getTemplates } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { CloudProviderIcon } from "@/components/icons/CloudIcons";
import NewTemplateModal from "@/components/NewTemplateModal";

const { Title, Text, Paragraph } = Typography;

export default function TemplatesPage() {
  const { data: templates, loading, refetch } = useApi(getTemplates);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            Templates
          </Title>
          <Text type="secondary">Reusable document templates used to generate consistent output.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          New Template
        </Button>
      </div>

      {loading || !templates ? (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      ) : (
        <Row gutter={[16, 16]}>
          {templates.map((tpl) => (
            <Col xs={24} sm={12} lg={8} key={tpl.id}>
              <Card
                title={
                  <span className="flex items-center gap-2">
                    <FileTextOutlined /> {tpl.name}
                  </span>
                }
                extra={
                  <Tag className="flex items-center gap-1.5" style={{ paddingBlock: 2 }}>
                    <CloudProviderIcon cloud={tpl.cloud} width={14} height={14} />
                    {tpl.cloud}
                  </Tag>
                }
                actions={[
                  <Link key="use" href="/chat">
                    <Button type="link">Use Template</Button>
                  </Link>,
                  <Link key="edit" href={`/templates/${tpl.id}`}>
                    <Button type="link">Edit</Button>
                  </Link>,
                ]}
              >
                <Paragraph type="secondary" className="text-sm" style={{ minHeight: 44 }}>
                  {tpl.description}
                </Paragraph>
                <Text type="secondary" className="text-xs">
                  {tpl.sections} section{tpl.sections > 1 ? "s" : ""}
                  {tpl.source && " · adapted from a public template"}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <NewTemplateModal open={modalOpen} onClose={() => setModalOpen(false)} onCreated={() => refetch()} />
    </div>
  );
}
