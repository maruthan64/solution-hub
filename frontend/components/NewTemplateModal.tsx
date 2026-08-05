"use client";

import { useState } from "react";
import { Form, Input, message, Modal, Select, Upload } from "antd";
import { InboxOutlined } from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
import { createTemplate } from "@/lib/api";
import type { DocTemplate } from "@/lib/types";
import { AwsIcon, AzureIcon, GcpIcon } from "@/components/icons/CloudIcons";

const { TextArea } = Input;

const CLOUD_OPTIONS = [
  { value: "AWS", label: "AWS", icon: AwsIcon },
  { value: "Azure", label: "Azure", icon: AzureIcon },
  { value: "GCP", label: "GCP", icon: GcpIcon },
  { value: "Any", label: "Any", icon: null },
];

interface NewTemplateForm {
  name: string;
  cloud: string;
  description: string;
}

export default function NewTemplateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (template: DocTemplate) => void;
}) {
  const [form] = Form.useForm<NewTemplateForm>();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleClose = () => {
    form.resetFields();
    setFileList([]);
    onClose();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const template = await createTemplate({
        ...values,
        document: (fileList[0]?.originFileObj as File) ?? null,
      });
      messageApi.success("Template created.");
      onCreated(template);
      handleClose();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to create template.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title="New Template"
        open={open}
        onCancel={handleClose}
        onOk={handleSubmit}
        okText="Create Template"
        confirmLoading={submitting}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false} className="mt-4">
          <Form.Item label="Template Name" name="name" rules={[{ required: true, message: "Enter a template name" }]}>
            <Input placeholder="e.g. Network Segmentation Review" size="large" />
          </Form.Item>

          <Form.Item label="Cloud" name="cloud" rules={[{ required: true, message: "Select a cloud" }]}>
            <Select
              placeholder="Select a cloud"
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
            <TextArea placeholder="What is this template for?" rows={2} />
          </Form.Item>

          <Form.Item label="Starting Content (optional)">
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
              <p className="ant-upload-text">Click or drag an existing document</p>
              <p className="ant-upload-hint text-gray-400">
                PDF, Word, or Markdown — its text becomes the template&apos;s starting content. Leave empty to start
                from a blank template.
              </p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
