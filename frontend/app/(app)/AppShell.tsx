"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Layout, Menu, Avatar, Dropdown, Typography } from "antd";
import { LogoutOutlined, UserOutlined } from "@ant-design/icons";
import { NAV_ITEMS } from "@/lib/nav";
import { getCurrentUser, getSolutionPackages } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import GlobalSearch from "@/components/GlobalSearch";
import ChangePasswordGate from "@/components/ChangePasswordGate";

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const NESTED_KEY = "/solution-packages";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const pathname = usePathname();
  const router = useRouter();
  const { data: user, refetch } = useApi(getCurrentUser);
  const { data: solutionPackages } = useApi(getSolutionPackages);

  const allowedItems = user ? NAV_ITEMS.filter((item) => user.allowedModules.includes(item.key)) : NAV_ITEMS;
  const isAllowed = (path: string) =>
    allowedItems.some((item) => (item.key === "/" ? path === "/" : path.startsWith(item.key)));

  useEffect(() => {
    if (!user) return;
    if (isAllowed(pathname)) return;
    const landing = allowedItems[0];
    if (landing) router.replace(landing.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pathname]);

  useEffect(() => {
    if (pathname.startsWith(NESTED_KEY)) {
      setOpenKeys((keys) => (keys.includes(NESTED_KEY) ? keys : [...keys, NESTED_KEY]));
    }
  }, [pathname]);

  const childKey = pathname.startsWith(`${NESTED_KEY}/`) ? pathname : null;
  const activeKey =
    childKey ??
    allowedItems.find((item) => item.key !== "/" && pathname.startsWith(item.key))?.key ??
    (pathname === "/" ? "/" : "/");

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  if (user && !isAllowed(pathname)) {
    return allowedItems.length === 0 ? (
      <div className="min-h-screen flex items-center justify-center">
        <Text type="secondary">You don&apos;t have access to any pages yet. Contact an administrator.</Text>
      </div>
    ) : null;
  }

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
          openKeys={openKeys}
          onOpenChange={setOpenKeys}
          style={{ borderInlineEnd: "none" }}
          items={allowedItems.map((item) =>
            item.key === NESTED_KEY && solutionPackages && solutionPackages.length > 0
              ? {
                  key: item.key,
                  icon: <item.icon />,
                  label: <Link href={item.key}>{item.label}</Link>,
                  children: solutionPackages.map((p) => ({
                    key: `${NESTED_KEY}/${p.id}`,
                    label: <Link href={`${NESTED_KEY}/${p.id}`}>{p.name}</Link>,
                  })),
                }
              : {
                  key: item.key,
                  icon: <item.icon />,
                  label: <Link href={item.key}>{item.label}</Link>,
                },
          )}
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
