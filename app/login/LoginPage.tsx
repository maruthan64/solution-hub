"use client";

import { InfoCircleOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Form, Input, Space, Typography } from "antd";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { login } from "@/lib/auth";

const { Title, Text, Paragraph } = Typography;

function LoginPageContent() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await login(username, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid username or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-lg shadow-md">
        <Space direction="vertical" size="middle" className="w-full">
          <div className="text-center">
            <Title level={2}>📐 SA Generator</Title>
          </div>

          <div className="text-center">
            <Title level={3}>Login</Title>
            <Text type="secondary">Access your AI Solution Documentation Portal.</Text>
          </div>

          <Alert
            message="Default Credentials"
            description={
              <>
                <Paragraph className="text-sm">
                  By default, Username is <code className="bg-gray-100 px-1 py-0.5 rounded-sm text-xs">admin</code>{" "}
                  and Password is your configured{" "}
                  <code className="bg-gray-100 px-1 py-0.5 rounded-sm text-xs">ADMIN_PASSWORD</code>.
                </Paragraph>
                <Paragraph className="text-sm">
                  Need to set up SSO instead? Check the deployment docs.
                </Paragraph>
              </>
            }
            type="info"
            icon={<InfoCircleOutlined />}
            showIcon
          />

          {error && <Alert message={error} type="error" showIcon />}

          <Form onFinish={handleSubmit} layout="vertical" requiredMark={false}>
            <Form.Item
              label="Username"
              name="username"
              rules={[{ required: true, message: "Please enter your username" }]}
            >
              <Input
                placeholder="Enter your username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                size="large"
                className="rounded-md border-gray-300"
              />
            </Form.Item>

            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, message: "Please enter your password" }]}
            >
              <Input.Password
                placeholder="Enter your password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                size="large"
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={isLoading} disabled={isLoading} block size="large">
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button block size="large" onClick={() => router.push("/api/auth/sso")}>
                Login with Microsoft SSO
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageContent />;
}
