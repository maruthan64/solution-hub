"use client";

import { useState } from "react";
import { Button, Form, Input, InputNumber, message, Modal, Select, Space } from "antd";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { createServicePackage } from "@/lib/api";
import type { ServicePackage } from "@/lib/types";

const CATEGORY_OPTIONS = [
  { value: "tier", label: "Tier (Basic / Intermediate / Advanced)" },
  { value: "container", label: "Container Service (add-on)" },
  { value: "addon", label: "Additional Add-On" },
];

interface NewServicePackageForm {
  category: "tier" | "container" | "addon";
  name: string;
  tagline: string;
  monthlyPrice: string;
  resources: { service: string; quantity: number; purpose: string }[];
}

export default function NewServicePackageModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (pkg: ServicePackage) => void;
}) {
  const [form] = Form.useForm<NewServicePackageForm>();
  const [submitting, setSubmitting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const pkg = await createServicePackage({
        category: values.category,
        name: values.name,
        tagline: values.tagline,
        monthlyPrice: values.monthlyPrice,
        resources: values.resources ?? [],
      });
      messageApi.success("Package created.");
      onCreated(pkg);
      handleClose();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to create package.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {contextHolder}
      <Modal
        title="New Service Catalog Package"
        open={open}
        onCancel={handleClose}
        onOk={handleSubmit}
        okText="Create Package"
        confirmLoading={submitting}
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false} className="mt-4">
          <Form.Item label="Category" name="category" rules={[{ required: true, message: "Select a category" }]}>
            <Select placeholder="Select a category" size="large" options={CATEGORY_OPTIONS} />
          </Form.Item>

          <Form.Item label="Name" name="name" rules={[{ required: true, message: "Enter a package name" }]}>
            <Input placeholder="e.g. Advanced" size="large" />
          </Form.Item>

          <Form.Item label="Tagline" name="tagline" rules={[{ required: true, message: "Enter a short tagline" }]}>
            <Input placeholder="e.g. Mission-critical, multi-AZ with automated DR" />
          </Form.Item>

          <Form.Item
            label="Monthly Price"
            name="monthlyPrice"
            rules={[{ required: true, message: "Enter a price, e.g. $1,200/mo" }]}
          >
            <Input placeholder="$1,200/mo" />
          </Form.Item>

          <Form.Item label="Resources">
            <Form.List name="resources">
              {(fields, { add, remove }) => (
                <div className="flex flex-col gap-2">
                  {fields.map(({ key, name, ...rest }) => (
                    <Space key={key} align="baseline" className="w-full">
                      <Form.Item
                        {...rest}
                        name={[name, "service"]}
                        rules={[{ required: true, message: "Service" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="Service, e.g. EC2 t3.large" style={{ width: 220 }} />
                      </Form.Item>
                      <Form.Item
                        {...rest}
                        name={[name, "quantity"]}
                        rules={[{ required: true, message: "Qty" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber placeholder="Qty" min={1} style={{ width: 80 }} />
                      </Form.Item>
                      <Form.Item
                        {...rest}
                        name={[name, "purpose"]}
                        rules={[{ required: true, message: "Purpose" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="Purpose, e.g. App servers" style={{ width: 220 }} />
                      </Form.Item>
                      <Button type="text" danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()} block>
                    Add resource line
                  </Button>
                </div>
              )}
            </Form.List>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
