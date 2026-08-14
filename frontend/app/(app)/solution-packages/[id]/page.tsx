"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Input, Modal, Select, Spin, Tag, Typography, message } from "antd";
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  PlusOutlined,
  RocketOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { deleteSolutionPackage, exportSolutionPackageUrl, getSolutionPackage, updateSolutionPackage } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { useRouter } from "next/navigation";
import { SolutionPackageService } from "@/lib/types";
import { CloudProviderIcon } from "@/components/icons/CloudIcons";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const CLOUDS = ["AWS", "Azure", "GCP", "Multi-Cloud"];

export default function SolutionPackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: pkg, loading } = useApi(() => getSolutionPackage(id), [id]);
  const [name, setName] = useState("");
  const [cloud, setCloud] = useState("AWS");
  const [tagline, setTagline] = useState("");
  const [outcome, setOutcome] = useState("");
  const [assumptions, setAssumptions] = useState<string[]>([]);
  const [services, setServices] = useState<SolutionPackageService[]>([]);
  const [referenceArchitecture, setReferenceArchitecture] = useState("");
  const [pricingNote, setPricingNote] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();

  useEffect(() => {
    if (pkg) {
      setName(pkg.name);
      setCloud(pkg.cloud);
      setTagline(pkg.tagline);
      setOutcome(pkg.outcome);
      setAssumptions(pkg.assumptions);
      setServices(pkg.services);
      setReferenceArchitecture(pkg.referenceArchitecture);
      setPricingNote(pkg.pricingNote);
      setSavedSnapshot(
        JSON.stringify({
          name: pkg.name,
          cloud: pkg.cloud,
          tagline: pkg.tagline,
          outcome: pkg.outcome,
          assumptions: pkg.assumptions,
          services: pkg.services,
          referenceArchitecture: pkg.referenceArchitecture,
          pricingNote: pkg.pricingNote,
        }),
      );
    }
  }, [pkg]);

  if (loading || !pkg) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  const isDirty =
    JSON.stringify({ name, cloud, tagline, outcome, assumptions, services, referenceArchitecture, pricingNote }) !==
    savedSnapshot;

  const updateService = (index: number, patch: Partial<SolutionPackageService>) => {
    setServices((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removeService = (index: number) => {
    setServices((rows) => rows.filter((_, i) => i !== index));
  };

  const addService = () => {
    setServices((rows) => [...rows, { service: "", purpose: "" }]);
  };

  const updateAssumption = (index: number, value: string) => {
    setAssumptions((rows) => rows.map((r, i) => (i === index ? value : r)));
  };

  const removeAssumption = (index: number) => {
    setAssumptions((rows) => rows.filter((_, i) => i !== index));
  };

  const addAssumption = () => {
    setAssumptions((rows) => [...rows, ""]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateSolutionPackage(id, {
        name,
        cloud,
        tagline,
        outcome,
        assumptions: assumptions.map((a) => a.trim()).filter(Boolean),
        services: services.filter((s) => s.service.trim()),
        referenceArchitecture,
        pricingNote,
      });
      setSavedSnapshot(
        JSON.stringify({
          name: updated.name,
          cloud: updated.cloud,
          tagline: updated.tagline,
          outcome: updated.outcome,
          assumptions: updated.assumptions,
          services: updated.services,
          referenceArchitecture: updated.referenceArchitecture,
          pricingNote: updated.pricingNote,
        }),
      );
      setAssumptions(updated.assumptions);
      setServices(updated.services);
      messageApi.success("Solution package saved.");
    } catch {
      messageApi.error("Failed to save solution package.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    modalApi.confirm({
      title: "Delete this solution package?",
      content: "This can't be undone.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: async () => {
        setDeleting(true);
        try {
          await deleteSolutionPackage(id);
          messageApi.success(`${pkg.name} deleted.`);
          router.push("/solution-packages");
        } catch {
          messageApi.error("Failed to delete solution package.");
          setDeleting(false);
        }
      },
    });
  };

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 900 }}>
      {contextHolder}
      {modalContextHolder}
      <Link href="/solution-packages" className="inline-flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeftOutlined /> Back to Solution Packages
      </Link>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 36, height: 36, background: "#fff7e6", color: "#fa8c16", fontSize: 16 }}
          >
            <RocketOutlined />
          </div>
          <Title level={3} style={{ marginBottom: 0 }}>
            {pkg.name}
          </Title>
        </div>
        <div className="flex gap-2">
          <Button icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>
            Preview
          </Button>
          <Button icon={<FileWordOutlined />} onClick={() => window.open(exportSolutionPackageUrl(id, "docx"), "_blank")}>
            Export Word
          </Button>
          <Button icon={<FilePdfOutlined />} onClick={() => window.open(exportSolutionPackageUrl(id, "pdf"), "_blank")}>
            Export PDF
          </Button>
          <Button icon={<DeleteOutlined />} danger loading={deleting} onClick={handleDelete}>
            Delete
          </Button>
          <Button type="primary" icon={<SaveOutlined />} disabled={!isDirty} loading={saving} onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>

      <Card title="Overview">
        <div className="flex flex-col gap-3">
          <div>
            <Text type="secondary" className="text-xs block mb-1">
              Name
            </Text>
            <Input value={name} onChange={(e) => setName(e.target.value)} size="large" />
          </div>
          <div style={{ maxWidth: 220 }}>
            <Text type="secondary" className="text-xs block mb-1">
              Cloud
            </Text>
            <Select
              size="large"
              value={cloud}
              onChange={setCloud}
              options={CLOUDS.map((c) => ({ value: c, label: c }))}
              style={{ width: "100%" }}
              labelRender={({ value }) => (
                <span className="inline-flex items-center gap-2">
                  <CloudProviderIcon cloud={String(value)} width={16} height={16} /> {value}
                </span>
              )}
            />
          </div>
          <div>
            <Text type="secondary" className="text-xs block mb-1">
              Tagline
            </Text>
            <Input value={tagline} onChange={(e) => setTagline(e.target.value)} size="large" />
          </div>
          <div>
            <Text type="secondary" className="text-xs block mb-1">
              Outcome — the story, why a customer buys this
            </Text>
            <TextArea rows={4} value={outcome} onChange={(e) => setOutcome(e.target.value)} />
          </div>
        </div>
      </Card>

      <Card
        title="Assumptions"
        extra={
          <Button size="small" icon={<PlusOutlined />} onClick={addAssumption}>
            Add Assumption
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          {assumptions.map((a, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={a}
                onChange={(e) => updateAssumption(i, e.target.value)}
                placeholder="e.g. Customer has an existing AWS account"
                style={{ flex: 1 }}
              />
              <Button icon={<DeleteOutlined />} danger onClick={() => removeAssumption(i)} style={{ width: 32, flexShrink: 0 }} />
            </div>
          ))}
          {assumptions.length === 0 && (
            <Text type="secondary" className="text-sm py-4 text-center">
              No assumptions yet — click &quot;Add Assumption&quot; to start.
            </Text>
          )}
        </div>
      </Card>

      <Card
        title="Services"
        extra={
          <Button size="small" icon={<PlusOutlined />} onClick={addService}>
            Add Service
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 text-xs text-gray-400 px-1">
            <div style={{ flex: 1 }}>Service</div>
            <div style={{ flex: 1 }}>Purpose</div>
            <div style={{ width: 32 }} />
          </div>
          {services.map((s, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={s.service}
                onChange={(e) => updateService(i, { service: e.target.value })}
                placeholder="e.g. AWS Elastic Disaster Recovery"
                style={{ flex: 1 }}
              />
              <Input
                value={s.purpose}
                onChange={(e) => updateService(i, { purpose: e.target.value })}
                placeholder="e.g. Continuous block-level replication"
                style={{ flex: 1 }}
              />
              <Button icon={<DeleteOutlined />} danger onClick={() => removeService(i)} style={{ width: 32, flexShrink: 0 }} />
            </div>
          ))}
          {services.length === 0 && (
            <Text type="secondary" className="text-sm py-4 text-center">
              No services yet — click &quot;Add Service&quot; to start.
            </Text>
          )}
        </div>
      </Card>

      <Card title="Reference Architecture & Pricing">
        <div className="flex flex-col gap-3">
          <div>
            <Text type="secondary" className="text-xs block mb-1">
              Reference architecture
            </Text>
            <TextArea rows={3} value={referenceArchitecture} onChange={(e) => setReferenceArchitecture(e.target.value)} />
          </div>
          <div>
            <Text type="secondary" className="text-xs block mb-1">
              Pricing note
            </Text>
            <Input value={pricingNote} onChange={(e) => setPricingNote(e.target.value)} size="large" />
          </div>
        </div>
      </Card>

      <Modal
        title="Preview"
        open={previewOpen}
        onCancel={() => setPreviewOpen(false)}
        footer={
          <Button type="primary" onClick={() => setPreviewOpen(false)}>
            Close
          </Button>
        }
        width={640}
      >
        <div className="flex flex-col gap-3">
          {isDirty && (
            <Text type="warning" className="text-xs">
              Showing unsaved changes — save first if you want the export to match this.
            </Text>
          )}
          <div className="flex items-center gap-2">
            <CloudProviderIcon cloud={cloud} width={18} height={18} />
            <Title level={4} style={{ marginBottom: 0 }}>
              {name || "Untitled Solution Package"}
            </Title>
          </div>
          {tagline && <Text type="secondary">{tagline}</Text>}

          {outcome && (
            <div>
              <Text strong className="text-xs uppercase text-gray-400">
                Outcome
              </Text>
              <Paragraph className="text-sm" style={{ marginBottom: 0 }}>
                {outcome}
              </Paragraph>
            </div>
          )}

          {assumptions.length > 0 && (
            <div>
              <Text strong className="text-xs uppercase text-gray-400">
                Assumptions
              </Text>
              <ul className="text-sm pl-4" style={{ listStyleType: "disc", marginTop: 4 }}>
                {assumptions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {services.length > 0 && (
            <div>
              <Text strong className="text-xs uppercase text-gray-400">
                Services
              </Text>
              <div className="flex flex-col gap-1 text-sm mt-1">
                {services.map((s, i) => (
                  <div key={i}>
                    <Text strong>{s.service}</Text>
                    <Text type="secondary"> — {s.purpose}</Text>
                  </div>
                ))}
              </div>
            </div>
          )}

          {referenceArchitecture && (
            <div>
              <Text strong className="text-xs uppercase text-gray-400">
                Reference Architecture
              </Text>
              <Paragraph className="text-sm" style={{ marginBottom: 0 }}>
                {referenceArchitecture}
              </Paragraph>
            </div>
          )}

          {pricingNote && (
            <Tag color="orange" bordered={false} style={{ alignSelf: "flex-start" }}>
              {pricingNote}
            </Tag>
          )}
        </div>
      </Modal>
    </div>
  );
}
