"use client";

import { useState } from "react";
import { Alert, Button, Form, Input, Modal, Typography } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { changePassword } from "@/lib/api";

const { Text } = Typography;

export default function ChangePasswordGate({ onDone }: { onDone: () => void }) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    setError(null);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Set a new password"
      closable={false}
      maskClosable={false}
      keyboard={false}
      footer={null}
      width={420}
    >
      <Text type="secondary" className="text-sm block mb-4">
        This account is using a password set by someone else (or the default one) — pick your own before
        continuing.
      </Text>
      {error && <Alert className="mb-4" type="error" showIcon message={error} />}
      <Form form={form} layout="vertical" requiredMark={false} onFinish={handleSubmit}>
        <Form.Item
          label="Current Password"
          name="currentPassword"
          rules={[{ required: true, message: "Required" }]}
        >
          <Input.Password prefix={<LockOutlined className="text-gray-400" />} size="large" autoFocus />
        </Form.Item>
        <Form.Item
          label="New Password"
          name="newPassword"
          rules={[
            { required: true, message: "Required" },
            { min: 8, message: "At least 8 characters" },
          ]}
        >
          <Input.Password prefix={<LockOutlined className="text-gray-400" />} size="large" />
        </Form.Item>
        <Form.Item
          label="Confirm New Password"
          name="confirmPassword"
          dependencies={["newPassword"]}
          rules={[
            { required: true, message: "Required" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("newPassword") === value) return Promise.resolve();
                return Promise.reject(new Error("Passwords don't match"));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined className="text-gray-400" />} size="large" />
        </Form.Item>
        <Button type="primary" htmlType="submit" loading={saving} block size="large">
          Set Password
        </Button>
      </Form>
    </Modal>
  );
}
