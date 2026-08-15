"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Input, InputNumber, Spin, Typography, message } from "antd";
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import { getCurrentUser, getServicePackage, updateServicePackage } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ResourceLine } from "@/lib/types";
import { getPackageTheme } from "@/lib/serviceCatalogTheme";

const { Title, Text } = Typography;

export default function ServicePackageEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: pkg, loading } = useApi(() => getServicePackage(id), [id]);
  const { data: currentUser } = useApi(getCurrentUser);
  const canEdit = currentUser?.role === "Owner" || currentUser?.role === "Architect";
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [resources, setResources] = useState<ResourceLine[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (pkg) {
      setName(pkg.name);
      setTagline(pkg.tagline);
      setMonthlyPrice(pkg.monthlyPrice);
      setResources(pkg.resources);
      setSavedSnapshot(JSON.stringify({ name: pkg.name, tagline: pkg.tagline, monthlyPrice: pkg.monthlyPrice, resources: pkg.resources }));
    }
  }, [pkg]);

  if (loading || !pkg) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  const isDirty = JSON.stringify({ name, tagline, monthlyPrice, resources }) !== savedSnapshot;
  const theme = getPackageTheme(id);
  const ThemeIcon = theme.icon;

  const updateResource = (index: number, patch: Partial<ResourceLine>) => {
    setResources((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removeResource = (index: number) => {
    setResources((rows) => rows.filter((_, i) => i !== index));
  };

  const addResource = () => {
    setResources((rows) => [...rows, { service: "", quantity: 1, purpose: "" }]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateServicePackage(id, { name, tagline, monthlyPrice, resources });
      setSavedSnapshot(
        JSON.stringify({ name: updated.name, tagline: updated.tagline, monthlyPrice: updated.monthlyPrice, resources: updated.resources }),
      );
      messageApi.success("Package saved.");
    } catch {
      messageApi.error("Failed to save package.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 mx-auto" style={{ maxWidth: 900 }}>
      {contextHolder}
      <Link href="/service-catalog" className="inline-flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeftOutlined /> Back to Service Catalog
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 36, height: 36, background: theme.soft, color: theme.accent, fontSize: 16 }}
          >
            <ThemeIcon />
          </div>
          <Title level={3} style={{ marginBottom: 0 }}>
            Edit Package
          </Title>
        </div>
        {canEdit && (
          <Button
            type="primary"
            icon={<SaveOutlined />}
            disabled={!isDirty}
            loading={saving}
            onClick={handleSave}
            style={{ background: isDirty ? theme.accent : undefined, borderColor: isDirty ? theme.accent : undefined }}
          >
            Save Changes
          </Button>
        )}
      </div>

      <Card title="Package Details" style={{ borderTop: `4px solid ${theme.accent}` }}>
        <div className="flex flex-col gap-3">
          <div>
            <Text type="secondary" className="text-xs block mb-1">
              Name
            </Text>
            <Input value={name} onChange={(e) => setName(e.target.value)} size="large" disabled={!canEdit} />
          </div>
          <div>
            <Text type="secondary" className="text-xs block mb-1">
              Tagline
            </Text>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} size="large" disabled={!canEdit} />
          </div>
          <div style={{ maxWidth: 220 }}>
            <Text type="secondary" className="text-xs block mb-1">
              Monthly Price
            </Text>
            <Input value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} size="large" disabled={!canEdit} />
          </div>
        </div>
      </Card>

      <Card
        title="Resource Bundle"
        extra={
          canEdit && (
            <Button size="small" icon={<PlusOutlined />} onClick={addResource}>
              Add Resource
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 text-xs text-gray-400 px-1">
            <div style={{ flex: 2 }}>Resource</div>
            <div style={{ width: 90 }}>Qty</div>
            <div style={{ flex: 2 }}>Purpose</div>
            <div style={{ width: 32 }} />
          </div>
          {resources.map((r, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={r.service}
                onChange={(e) => updateResource(i, { service: e.target.value })}
                placeholder="e.g. Virtual Machine (t3.large)"
                style={{ flex: 2 }}
                disabled={!canEdit}
              />
              <InputNumber
                value={r.quantity}
                onChange={(v) => updateResource(i, { quantity: v ?? 0 })}
                min={0}
                style={{ width: 90 }}
                disabled={!canEdit}
              />
              <Input
                value={r.purpose}
                onChange={(e) => updateResource(i, { purpose: e.target.value })}
                placeholder="e.g. Application workloads"
                style={{ flex: 2 }}
                disabled={!canEdit}
              />
              {canEdit && (
                <Button icon={<DeleteOutlined />} danger onClick={() => removeResource(i)} style={{ width: 32, flexShrink: 0 }} />
              )}
            </div>
          ))}
          {resources.length === 0 && (
            <Text type="secondary" className="text-sm py-4 text-center">
              No resources yet{canEdit ? ' — click "Add Resource" to start the bundle.' : "."}
            </Text>
          )}
        </div>
      </Card>
    </div>
  );
}
