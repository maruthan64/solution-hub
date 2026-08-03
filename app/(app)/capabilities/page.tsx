"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import {
  DeleteOutlined,
  EditOutlined,
  ExportOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  GithubOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ProjectOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import {
  createCapability,
  deleteCapability,
  exportCapabilityMatrixUrl,
  getCapabilities,
  getCurrentUser,
  getProjects,
  updateCapability,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { Capability, CaseStudy } from "@/lib/types";
import { CloudProviderIcon } from "@/components/icons/CloudIcons";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const CLOUDS = ["AWS", "Azure", "GCP", "Multi-Cloud"];

interface FormValues {
  name: string;
  cloud: string;
  description: string;
  keyServicesText: string;
  status: "Active" | "Planned";
  githubUrl: string;
  certificationsText: string;
  caseStudies: CaseStudy[];
}

function toList(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function CapabilitiesPage() {
  const { data: capabilities, loading, refetch } = useApi(getCapabilities);
  const { data: currentUser } = useApi(getCurrentUser);
  const { data: projects } = useApi(getProjects);
  const [modalTarget, setModalTarget] = useState<Capability | "new" | null>(null);
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  const canEdit = currentUser?.role === "Owner" || currentUser?.role === "Architect";

  const openCreate = () => {
    form.setFieldsValue({
      name: "",
      cloud: "AWS",
      description: "",
      keyServicesText: "",
      status: "Active",
      githubUrl: "",
      certificationsText: "",
      caseStudies: [],
    });
    setModalTarget("new");
  };

  const openEdit = (c: Capability) => {
    form.setFieldsValue({
      name: c.name,
      cloud: c.cloud,
      description: c.description,
      keyServicesText: c.keyServices.join(", "),
      status: c.status,
      githubUrl: c.githubUrl ?? "",
      certificationsText: c.certifications.join(", "),
      caseStudies: c.caseStudies,
    });
    setModalTarget(c);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const input = {
      name: values.name,
      cloud: values.cloud,
      description: values.description,
      keyServices: toList(values.keyServicesText),
      status: values.status,
      githubUrl: values.githubUrl.trim() || null,
      certifications: toList(values.certificationsText),
      caseStudies: (values.caseStudies || []).filter((cs) => cs.customer?.trim() && cs.outcome?.trim()),
    };
    setSaving(true);
    try {
      if (modalTarget === "new") {
        await createCapability(input);
        messageApi.success("Capability added.");
      } else if (modalTarget) {
        await updateCapability(modalTarget.id, input);
        messageApi.success("Capability updated.");
      }
      setModalTarget(null);
      refetch();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to save capability.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Capability) => {
    setDeletingId(c.id);
    try {
      await deleteCapability(c.id);
      messageApi.success(`${c.name} removed.`);
      refetch();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to delete capability.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {contextHolder}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            Capabilities
          </Title>
          <Text type="secondary">
            The named solution areas your org delivers — a capability matrix, not a price list.
          </Text>
        </div>
        <Space>
          <Button
            icon={<FileWordOutlined />}
            onClick={() => window.open(exportCapabilityMatrixUrl("docx"), "_blank")}
          >
            Export Word
          </Button>
          <Button icon={<FilePdfOutlined />} onClick={() => window.open(exportCapabilityMatrixUrl("pdf"), "_blank")}>
            Export PDF
          </Button>
          {canEdit && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Add Capability
            </Button>
          )}
        </Space>
      </div>
      <Text type="secondary" className="text-xs -mt-3">
        <ExportOutlined /> Export to share the full capability matrix with marketing or sales.
      </Text>

      {loading || !capabilities ? (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      ) : capabilities.length === 0 ? (
        <Card>
          <Text type="secondary">No capabilities yet. Add your first one.</Text>
        </Card>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {capabilities.map((c) => (
            <Card
              key={c.id}
              actions={
                canEdit
                  ? [
                      <span key="edit" onClick={() => openEdit(c)} className="inline-flex items-center gap-1.5">
                        <EditOutlined /> Edit
                      </span>,
                      <Popconfirm
                        key="delete"
                        title="Remove this capability?"
                        okText="Remove"
                        okButtonProps={{ danger: true }}
                        onConfirm={() => handleDelete(c)}
                      >
                        <span className="inline-flex items-center gap-1.5 text-red-500">
                          <DeleteOutlined /> {deletingId === c.id ? "Removing…" : "Delete"}
                        </span>
                      </Popconfirm>,
                    ]
                  : undefined
              }
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-2 font-semibold text-base">
                  <CloudProviderIcon cloud={c.cloud} width={18} height={18} />
                  {c.name}
                </span>
                <Tag color={c.status === "Active" ? "green" : "default"}>{c.status}</Tag>
              </div>
              <Paragraph type="secondary" className="text-sm" style={{ minHeight: 44 }}>
                {c.description}
              </Paragraph>
              <div className="flex items-center gap-1.5 mb-2 text-sm">
                <ProjectOutlined className="text-gray-400" />
                <Text type="secondary">
                  {(projects ?? []).filter((p) => p.capabilityId === c.id).length === 0
                    ? "Not used in any project yet"
                    : `Used in ${(projects ?? []).filter((p) => p.capabilityId === c.id).length} project${
                        (projects ?? []).filter((p) => p.capabilityId === c.id).length === 1 ? "" : "s"
                      }`}
                </Text>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {c.keyServices.map((s) => (
                  <Tag key={s} bordered={false} color="blue">
                    {s}
                  </Tag>
                ))}
              </div>

              {c.certifications.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {c.certifications.map((cert) => (
                    <Tag key={cert} icon={<TrophyOutlined />} color="gold">
                      {cert}
                    </Tag>
                  ))}
                </div>
              )}

              {c.caseStudies.length > 0 && (
                <div className="flex flex-col gap-1 mb-2 text-sm">
                  {c.caseStudies.map((cs, i) => (
                    <div key={i}>
                      <Text strong>{cs.customer}</Text>
                      <Text type="secondary"> — {cs.outcome}</Text>
                    </div>
                  ))}
                </div>
              )}

              {c.githubUrl && (
                <a
                  href={c.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm"
                  onClick={(e) => e.stopPropagation()}
                >
                  <GithubOutlined /> Reference code
                </a>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        title={modalTarget === "new" ? "Add Capability" : `Edit — ${modalTarget ? modalTarget.name : ""}`}
        open={!!modalTarget}
        onCancel={() => setModalTarget(null)}
        onOk={handleSave}
        okText="Save"
        confirmLoading={saving}
        destroyOnHidden
        width={640}
      >
        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item label="Name" name="name" rules={[{ required: true, message: "Enter a name" }]}>
            <Input placeholder="e.g. AWS Contact Center" size="large" />
          </Form.Item>
          <Form.Item label="Cloud" name="cloud">
            <Select size="large" options={CLOUDS.map((c) => ({ value: c, label: c }))} />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <TextArea rows={3} placeholder="What this capability covers" />
          </Form.Item>
          <Form.Item
            label="Key Services"
            name="keyServicesText"
            extra="Comma-separated, e.g. Amazon Connect, Amazon Lex, Amazon Polly"
          >
            <Input placeholder="Amazon Connect, Amazon Lex, Amazon Polly" size="large" />
          </Form.Item>
          <Form.Item label="Status" name="status">
            <Select
              size="large"
              options={[
                { value: "Active", label: "Active" },
                { value: "Planned", label: "Planned" },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="GitHub Repository (optional)"
            name="githubUrl"
            rules={[{ type: "url", message: "Enter a valid URL", warningOnly: true }]}
          >
            <Input placeholder="https://github.com/your-org/aws-contact-center" size="large" prefix={<GithubOutlined />} />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0} className="text-sm">
            Proof points (optional — only add what's real)
          </Divider>

          <Form.Item
            label="Certifications / partner badges"
            name="certificationsText"
            extra="Comma-separated, e.g. AWS Advanced Consulting Partner, AWS Contact Center Competency"
          >
            <Input placeholder="AWS Advanced Consulting Partner, AWS Contact Center Competency" size="large" />
          </Form.Item>

          <Form.Item label="Case studies" style={{ marginBottom: 0 }}>
            <Form.List name="caseStudies">
              {(fields, { add, remove }) => (
                <div className="flex flex-col gap-2">
                  {fields.map(({ key, name, ...rest }) => (
                    <Space key={key} align="baseline" style={{ display: "flex" }}>
                      <Form.Item {...rest} name={[name, "customer"]} style={{ marginBottom: 8 }}>
                        <Input placeholder="Customer (or anonymized, e.g. 'Regional retailer')" style={{ width: 260 }} />
                      </Form.Item>
                      <Form.Item {...rest} name={[name, "outcome"]} style={{ marginBottom: 8 }}>
                        <Input placeholder="Outcome, e.g. 'cut average handle time 22%'" style={{ width: 260 }} />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} className="text-gray-400" />
                    </Space>
                  ))}
                  <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                    Add case study
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
