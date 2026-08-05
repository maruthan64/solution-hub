"use client";

import { useEffect, useState } from "react";
import { Form, Input, message, Modal, Select, Upload } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
import { createProject, getCapabilities, getTemplates } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import type { Project } from "@/lib/types";
import { AwsIcon, AzureIcon, GcpIcon, CloudProviderIcon } from "@/components/icons/CloudIcons";

const { TextArea } = Input;

const CLOUD_OPTIONS = [
  { value: "AWS", label: "AWS", icon: AwsIcon },
  { value: "Azure", label: "Azure", icon: AzureIcon },
  { value: "GCP", label: "GCP", icon: GcpIcon },
  { value: "Multi-Cloud", label: "Multi-Cloud", icon: null },
];

interface NewProjectForm {
  name: string;
  customer: string;
  cloud: string;
  description: string;
  templateId?: string;
  capabilityId?: string;
}

export default function NewProjectModal({
  open,
  onClose,
  onCreated,
  initialValues,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
  initialValues?: Partial<NewProjectForm>;
}) {
  const [form] = Form.useForm<NewProjectForm>();
  const { data: templates } = useApi(getTemplates);
  const { data: capabilities } = useApi(getCapabilities);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (!open || !initialValues) return;
    const cleaned = Object.fromEntries(
      Object.entries(initialValues).filter(([, v]) => typeof v === "string" && v.trim().length > 0),
    );
    if (Object.keys(cleaned).length > 0) form.setFieldsValue(cleaned);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialValues]);

  const handleClose = () => {
    form.resetFields();
    setFileList([]);
    onClose();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const project = await createProject({
        ...values,
        document: (fileList[0]?.originFileObj as File) ?? null,
      });
      messageApi.success(
        values.templateId ? "Project created with a starting document." : "Project created.",
      );
      onCreated(project);
      handleClose();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title="New Project"
        open={open}
        onCancel={handleClose}
        onOk={handleSubmit}
        okText="Create Project"
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false} className="mt-4">
          <Form.Item label="Project Name" name="name" rules={[{ required: true, message: "Enter a project name" }]}>
            <Input placeholder="e.g. EKS Multi-Region Platform" size="large" />
          </Form.Item>

          <Form.Item
            label="Customer Name"
            name="customer"
            rules={[{ required: true, message: "Enter the customer name" }]}
          >
            <Input placeholder="e.g. Northwind Retail" size="large" />
          </Form.Item>

          <Form.Item label="Cloud Provider" name="cloud" rules={[{ required: true, message: "Select a cloud provider" }]}>
            <Select
              placeholder="Select a cloud provider"
              size="large"
              options={CLOUD_OPTIONS.map((c) => ({
                value: c.value,
                label: (
                  <span className="flex items-center gap-2">
                    {c.icon && <c.icon width={14} height={14} />}
                    {c.label}
                  </span>
                ),
              }))}
            />
          </Form.Item>

          <Form.Item label="Description" name="description">
            <TextArea placeholder="What is this project for?" rows={3} />
          </Form.Item>

          <Form.Item
            label="Starting Template (optional)"
            name="templateId"
            help="Creates the project's first document from this template."
          >
            <Select
              allowClear
              placeholder="Start from a template"
              size="large"
              options={(templates ?? []).map((t) => ({
                value: t.id,
                label: (
                  <span className="flex items-center gap-2">
                    <CloudProviderIcon cloud={t.cloud} width={14} height={14} />
                    {t.name}
                  </span>
                ),
              }))}
            />
          </Form.Item>

          <Form.Item
            label="Capability (optional)"
            name="capabilityId"
            help="Tags this project against one of your org's capabilities, e.g. for tracking real delivery history."
          >
            <Select
              allowClear
              placeholder="Which capability does this draw on?"
              size="large"
              options={(capabilities ?? []).map((c) => ({
                value: c.id,
                label: (
                  <span className="flex items-center gap-2">
                    <CloudProviderIcon cloud={c.cloud} width={14} height={14} />
                    {c.name}
                  </span>
                ),
              }))}
            />
          </Form.Item>

          <Form.Item label="Existing Document (optional)">
            <Upload.Dragger
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl.slice(-1))}
              maxCount={1}
              accept=".pdf,.doc,.docx,.md,.txt"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">Click or drag a requirements or architecture doc</p>
              <p className="ant-upload-hint text-gray-400">PDF, Word, or Markdown — used as context for the AI agents</p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
