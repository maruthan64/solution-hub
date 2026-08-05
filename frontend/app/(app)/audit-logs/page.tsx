"use client";

import { Card, Spin, Table, Typography } from "antd";
import { getAuditLog } from "@/lib/api";
import { useApi } from "@/lib/useApi";

const { Title, Text } = Typography;

export default function AuditLogsPage() {
  const { data: entries, loading } = useApi(getAuditLog);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          Audit Logs
        </Title>
        <Text type="secondary">User activity, document history, and AI requests.</Text>
      </div>

      <Card>
        {loading || !entries ? (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        ) : (
          <Table
            rowKey="id"
            dataSource={entries}
            columns={[
              { title: "Timestamp", dataIndex: "timestamp" },
              { title: "Actor", dataIndex: "actor" },
              { title: "Action", dataIndex: "action" },
              { title: "Target", dataIndex: "target" },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
