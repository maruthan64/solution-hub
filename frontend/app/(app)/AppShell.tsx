"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Layout, Menu, Avatar, Dropdown, Typography } from "antd";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { NAV_ITEMS } from "@/lib/nav";
import { getCurrentUser } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import GlobalSearch from "@/components/GlobalSearch";
import ChangePasswordGate from "@/components/ChangePasswordGate";

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { data: user, refetch } = useApi(getCurrentUser);

  const activeKey =
    NAV_ITEMS.find((item) => item.key !== "/" && pathname.startsWith(item.key))?.key ??
    (pathname === "/" ? "/" : "/");

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <Layout className="min-h-screen">
      {user?.mustChangePassword && <ChangePasswordGate onDone={() => refetch()} />}
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="light" width={232}>
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <span className="text-xl font-semibold whitespace-nowrap overflow-hidden">
            {collapsed ? "📐" : "📐 CloudSolution Hub"}
          </span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          style={{ borderInlineEnd: "none" }}
          items={NAV_ITEMS.map((item) => ({
            key: item.key,
            icon: <item.icon />,
            label: <Link href={item.key}>{item.label}</Link>,
          }))}
        />
      </Sider>
      <Layout>
        <Header className="!bg-white !px-6 flex items-center justify-between border-b border-gray-200">
          <GlobalSearch />
          <Dropdown
            menu={{
              items: [{ key: "logout", icon: <LogoutOutlined />, label: "Log out", onClick: handleLogout }],
            }}
            placement="bottomRight"
          >
            <div className="flex items-center gap-2 cursor-pointer">
              <Avatar size="small" icon={<UserOutlined />} />
              <Text>{user?.name ?? "..."}</Text>
            </div>
          </Dropdown>
        </Header>
        <Content className="bg-gray-50 p-6">{children}</Content>
      </Layout>
    </Layout>
  );
}
