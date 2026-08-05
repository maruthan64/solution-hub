"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  Modal,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  DownOutlined,
  ExclamationCircleOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  UnlockOutlined,
  UserSwitchOutlined,
} from "@ant-design/icons";
import { createUser, deleteUser, getCurrentUser, getUsers, resetUserPassword, unlockUser, updateUserRole } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { AppUser } from "@/lib/types";

const { Title, Text } = Typography;

const ROLES = ["Owner", "Architect", "Reviewer", "Viewer"];

export default function UsersPage() {
  const { data: users, loading, refetch } = useApi(getUsers);
  const { data: currentUser } = useApi(getCurrentUser);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [roleTarget, setRoleTarget] = useState<AppUser | null>(null);
  const [roleValue, setRoleValue] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);

  const [passwordTarget, setPasswordTarget] = useState<AppUser | null>(null);
  const [passwordForm] = Form.useForm();
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  const handleCreate = async () => {
    const values = await form.validateFields();
    setCreating(true);
    try {
      const result = await createUser(values.name, values.email, values.username, values.role, values.password);
      setModalOpen(false);
      form.resetFields();
      refetch();
      messageApi.success(`Account created — they sign in with username "${result.username}".`, 6);
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setCreating(false);
    }
  };

  const suggestUsername = (email: string) => {
    if (form.getFieldValue("username")) return; // don't overwrite something the admin already typed
    const local = email.split("@")[0] ?? "";
    const suggestion = local.toLowerCase().replace(/[^a-z0-9.]/g, "");
    if (suggestion) form.setFieldValue("username", suggestion);
  };

  const handleDelete = (user: AppUser) => {
    modalApi.confirm({
      title: "Delete this user?",
      icon: <ExclamationCircleOutlined />,
      content: "This can't be undone.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        setBusyId(user.id);
        try {
          await deleteUser(user.id);
          messageApi.success(`${user.name} was deleted.`);
          refetch();
        } catch (err) {
          messageApi.error(err instanceof Error ? err.message : "Failed to delete user.");
        } finally {
          setBusyId(null);
        }
      },
    });
  };

  const openRoleModal = (user: AppUser) => {
    setRoleTarget(user);
    setRoleValue(user.role);
  };

  const handleSaveRole = async () => {
    if (!roleTarget) return;
    setRoleSaving(true);
    try {
      await updateUserRole(roleTarget.id, roleValue);
      messageApi.success(`${roleTarget.name}'s role updated to ${roleValue}.`);
      setRoleTarget(null);
      refetch();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to update role.");
    } finally {
      setRoleSaving(false);
    }
  };

  const openPasswordModal = (user: AppUser) => {
    setPasswordTarget(user);
    passwordForm.resetFields();
  };

  const handleResetPassword = async () => {
    if (!passwordTarget) return;
    const values = await passwordForm.validateFields();
    setPasswordSaving(true);
    try {
      await resetUserPassword(passwordTarget.id, values.password);
      messageApi.success(`Password reset for ${passwordTarget.name}.`);
      setPasswordTarget(null);
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleUnlock = async (user: AppUser) => {
    setBusyId(user.id);
    try {
      await unlockUser(user.id);
      messageApi.success(`${user.name} was unlocked.`);
      refetch();
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to unlock user.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {contextHolder}
      {modalContextHolder}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            Users
          </Title>
          <Text type="secondary">Manage who can access this organization and what they can do.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
          Create User
        </Button>
      </div>

      <Card>
        {loading || !users ? (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        ) : (
          <Table
            rowKey="id"
            dataSource={users}
            columns={[
              { title: "Name", dataIndex: "name" },
              {
                title: "Email",
                dataIndex: "email",
                render: (email: string | null) => email || <Text type="secondary">—</Text>,
              },
              { title: "Role", dataIndex: "role", render: (r: string) => <Tag color="blue">{r}</Tag> },
              {
                title: "Status",
                dataIndex: "status",
                render: (s: string, record: AppUser) => (
                  <span className="flex items-center gap-1.5">
                    <Tag color={s === "Active" ? "green" : "gold"}>{s}</Tag>
                    {record.locked && (
                      <Tag icon={<LockOutlined />} color="red">
                        Locked out
                      </Tag>
                    )}
                  </span>
                ),
              },
              {
                title: "",
                key: "actions",
                width: 80,
                render: (_: unknown, record: AppUser) => {
                  if (currentUser?.role !== "Owner") return null;
                  const items = [
                    { key: "role", icon: <UserSwitchOutlined />, label: "Change Role" },
                    { key: "password", icon: <KeyOutlined />, label: "Reset Password" },
                    ...(record.locked ? [{ key: "unlock", icon: <UnlockOutlined />, label: "Unlock" }] : []),
                    ...(record.id !== currentUser.id
                      ? [{ key: "delete", danger: true, label: "Delete" }]
                      : []),
                  ];
                  return (
                    <Dropdown
                      menu={{
                        items,
                        onClick: ({ key }) => {
                          if (key === "role") openRoleModal(record);
                          else if (key === "password") openPasswordModal(record);
                          else if (key === "unlock") handleUnlock(record);
                          else if (key === "delete") handleDelete(record);
                        },
                      }}
                      trigger={["click"]}
                    >
                      <Button size="small" loading={busyId === record.id}>
                        Actions <DownOutlined />
                      </Button>
                    </Dropdown>
                  );
                },
              },
            ]}
          />
        )}
      </Card>

      <Modal
        title="Create User"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okText="Create User"
        confirmLoading={creating}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark={false} initialValues={{ role: "Viewer" }}>
          <Form.Item label="Name" name="name" rules={[{ required: true, message: "Enter a name" }]}>
            <Input placeholder="e.g. J. Rivera" size="large" />
          </Form.Item>
          <Form.Item label="Email (optional)" name="email" rules={[{ type: "email", message: "Enter a valid email" }]}>
            <Input
              placeholder="e.g. j.rivera@example.com"
              size="large"
              onBlur={(e) => suggestUsername(e.target.value)}
            />
          </Form.Item>
          <Form.Item
            label="Username"
            name="username"
            extra="This is what they'll type to log in — not their name or email."
            rules={[
              { required: true, min: 3, message: "Username must be at least 3 characters" },
              { pattern: /^[a-z0-9.]+$/, message: "Lowercase letters, numbers, and dots only" },
            ]}
          >
            <Input placeholder="e.g. j.rivera" size="large" />
          </Form.Item>
          <Form.Item label="Role" name="role">
            <Select size="large" options={ROLES.map((r) => ({ value: r, label: r }))} />
          </Form.Item>
          <Form.Item
            label="Password"
            name="password"
            rules={[{ required: true, min: 8, message: "Password must be at least 8 characters" }]}
          >
            <Input.Password placeholder="At least 8 characters" size="large" autoComplete="new-password" />
          </Form.Item>
        </Form>
        <Text type="secondary" className="text-xs">
          Only Owners can create users. No email is sent — share the username and password with them directly.
        </Text>
      </Modal>

      <Modal
        title={`Change role — ${roleTarget?.name ?? ""}`}
        open={!!roleTarget}
        onCancel={() => setRoleTarget(null)}
        onOk={handleSaveRole}
        okText="Save"
        confirmLoading={roleSaving}
        destroyOnHidden
      >
        <Select
          size="large"
          value={roleValue}
          onChange={setRoleValue}
          options={ROLES.map((r) => ({ value: r, label: r }))}
          style={{ width: "100%" }}
        />
      </Modal>

      <Modal
        title={`Reset password — ${passwordTarget?.name ?? ""}`}
        open={!!passwordTarget}
        onCancel={() => setPasswordTarget(null)}
        onOk={handleResetPassword}
        okText="Reset Password"
        confirmLoading={passwordSaving}
        destroyOnHidden
      >
        <Form form={passwordForm} layout="vertical" requiredMark={false}>
          <Form.Item
            label="New password"
            name="password"
            rules={[{ required: true, min: 8, message: "Password must be at least 8 characters" }]}
          >
            <Input.Password placeholder="At least 8 characters" size="large" autoComplete="new-password" />
          </Form.Item>
        </Form>
        <Text type="secondary" className="text-xs">
          No email is sent — share the new password with them directly.
        </Text>
      </Modal>
    </div>
  );
}
