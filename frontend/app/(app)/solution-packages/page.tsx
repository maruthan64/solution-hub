"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Divider, Form, Input, Modal, Select, Space, Spin, Tag, Typography, message } from "antd";
import { EditOutlined, MinusCircleOutlined, PlusOutlined, RocketOutlined } from "@ant-design/icons";
import { createSolutionPackage, getCurrentUser, getSolutionPackages } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { CloudProviderIcon } from "@/components/icons/CloudIcons";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const CLOUDS = ["AWS", "Azure", "GCP", "Multi-Cloud"];

interface FormValues {
  name: string;
  cloud: string;
  tagline: string;
  outcome: string;
  assumptions: string[];
  services: { service: string; purpose: string }[];
  referenceArchitecture: string;
  pricingNote: string;
}

export default function SolutionPackagesPage() {
  const { data: packages, loading, refetch } = useApi(getSolutionPackages);
  const { data: currentUser } = useApi(getCurrentUser);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const canEdit = currentUser?.role === "Owner" || currentUser?.role === "Architect";

  const openCreate = () => {
    form.setFieldsValue({
      name: "",
      cloud: "AWS",
      tagline: "",
      outcome: "",
      assumptions: [],
      services: [],
      referenceArchitecture: "",
      pricingNote: "",
    });
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await createSolutionPackage({
        name: values.name,
        cloud: values.cloud,
        tagline: values.tagline,
        outcome: values.outcome,
        assumptions: (values.assumptions || []).map((a) => a?.trim()).filter(Boolean),
        services: (values.services || []).filter((s) => s.service?.trim()),
        referenceArchitecture: values.referenceArchitecture,
        pricingNote: values.pricingNote,
      });
      messageApi.success("Solution package added.");
      setCreateOpen(false);
      refetch();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to save solution package.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {contextHolder}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            Solution Packages
          </Title>
          <Text type="secondary">
            Named, use-case-specific offerings built around a business outcome — not generic sizing tiers.
          </Text>
        </div>
        {canEdit && (
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            Add Solution Package
          </Button>
        )}
      </div>

      {loading || !packages ? (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      ) : packages.length === 0 ? (
        <Card>
          <Text type="secondary">No solution packages yet. Add your first one.</Text>
        </Card>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))" }}>
          {packages.map((p) => (
            <Card
              key={p.id}
              hoverable
              actions={
                canEdit
                  ? [
                      <Link key="edit" href={`/solution-packages/${p.id}`}>
                        <span className="inline-flex items-center gap-1.5">
                          <EditOutlined /> Edit
                        </span>
                      </Link>,
                    ]
                  : undefined
              }
            >
              <Link href={`/solution-packages/${p.id}`} className="block">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="inline-flex items-center gap-2 font-semibold text-base text-gray-900">
                    <CloudProviderIcon cloud={p.cloud} width={18} height={18} />
                    {p.name}
                  </span>
                  <RocketOutlined className="text-gray-400" />
                </div>
                <Text type="secondary" className="text-sm">
                  {p.tagline}
                </Text>
                {p.outcome && (
                  <Paragraph className="text-sm" style={{ marginTop: 8, marginBottom: 8 }}>
                    {p.outcome}
                  </Paragraph>
                )}

                {p.assumptions.length > 0 && (
                  <ul className="text-xs text-gray-500 mb-2 pl-4" style={{ listStyleType: "disc" }}>
                    {p.assumptions.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                )}

                {p.services.length > 0 && (
                  <div className="flex flex-col gap-1 mb-2 text-sm">
                    {p.services.map((s, i) => (
                      <div key={i}>
                        <Text strong>{s.service}</Text>
                        <Text type="secondary"> — {s.purpose}</Text>
                      </div>
                    ))}
                  </div>
                )}

                {p.referenceArchitecture && (
                  <Paragraph type="secondary" className="text-xs" italic style={{ marginBottom: 8 }}>
                    {p.referenceArchitecture}
                  </Paragraph>
                )}

                {p.pricingNote && (
                  <Tag color="orange" bordered={false}>
                    {p.pricingNote}
                  </Tag>
                )}
              </Link>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title="Add Solution Package"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        okText="Add"
        confirmLoading={saving}
        destroyOnHidden
        width={640}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item label="Name" name="name" rules={[{ required: true, message: "Enter a name" }]}>
            <Input placeholder="e.g. SAP on AWS Migration" size="large" />
          </Form.Item>
          <Form.Item label="Cloud" name="cloud">
            <Select size="large" options={CLOUDS.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item label="Tagline" name="tagline">
            <Input placeholder="One-line summary of what this package does" size="large" />
          </Form.Item>
          <Form.Item label="Outcome" name="outcome" extra="The story — why a customer buys this">
            <TextArea rows={4} placeholder="What problem this solves and why it matters to the customer" />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} className="text-sm">
            Assumptions
          </Divider>

          <Form.Item style={{ marginBottom: 0 }}>
            <Form.List name="assumptions">
              {(fields, { add, remove }) => (
                <div className="flex flex-col gap-2">
                  {fields.map(({ key, name, ...rest }) => (
                    <Space key={key} align="baseline" style={{ display: "flex" }}>
                      <Form.Item {...rest} name={[name]} style={{ marginBottom: 8, width: 520 }}>
                        <Input placeholder="e.g. Customer has an existing AWS account" />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} className="text-gray-400" />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                    Add assumption
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} className="text-sm">
            Services
          </Divider>

          <Form.Item style={{ marginBottom: 0 }}>
            <Form.List name="services">
              {(fields, { add, remove }) => (
                <div className="flex flex-col gap-2">
                  {fields.map(({ key, name, ...rest }) => (
                    <Space key={key} align="baseline" style={{ display: "flex" }}>
                      <Form.Item {...rest} name={[name, "service"]} style={{ marginBottom: 8 }}>
                        <Input placeholder="Service, e.g. 'AWS Elastic Disaster Recovery'" style={{ width: 260 }} />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, "purpose"]} style={{ marginBottom: 8 }}>
                        <Input placeholder="Purpose, e.g. 'Continuous block-level replication'" style={{ width: 260 }} />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} className="text-gray-400" />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                    Add service
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} className="text-sm">
            Reference architecture &amp; pricing
          </Divider>

          <Form.Item label="Reference architecture" name="referenceArchitecture">
            <TextArea rows={3} placeholder="Short description of how the pieces fit together" />
          </Form.Item>
          <Form.Item label="Pricing note" name="pricingNote" extra="Freeform, e.g. 'Starting at $25,000' or 'Contact for quote'">
            <Input placeholder="Starting at $25,000, scoped per estate" size="large" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
