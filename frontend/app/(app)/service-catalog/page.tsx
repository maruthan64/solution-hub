"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Divider,
  Input,
  Modal,
  Row,
  Select,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CalculatorOutlined,
  CheckOutlined,
  DiffOutlined,
  EditOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
  PlusOutlined,
  ShoppingCartOutlined,
  StarFilled,
} from "@ant-design/icons";
import { createCostEstimate, generateQuote, getProjects, getServiceCatalog, QuoteFormat } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { ServicePackage } from "@/lib/types";
import { getPackageTheme } from "@/lib/serviceCatalogTheme";
import NewServicePackageModal from "@/components/NewServicePackageModal";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const FORMAT_OPTIONS: { value: QuoteFormat; label: string; icon: typeof FileWordOutlined }[] = [
  { value: "docx", label: "Word", icon: FileWordOutlined },
  { value: "pdf", label: "PDF", icon: FilePdfOutlined },
  { value: "proposal", label: "Proposal (Branded PDF)", icon: FileTextOutlined },
];

function PackageCard({
  pkg,
  inCart,
  onToggleCart,
  compareChecked,
  onToggleCompare,
  onViewDetails,
}: {
  pkg: ServicePackage;
  inCart: boolean;
  onToggleCart: (add: boolean) => void;
  compareChecked: boolean;
  onToggleCompare: (checked: boolean) => void;
  onViewDetails: () => void;
}) {
  const theme = getPackageTheme(pkg.id);
  const Icon = theme.icon;
  const headline = pkg.resources.slice(0, 3);

  return (
    <Card
      hoverable
      onClick={onViewDetails}
      style={{
        borderTop: `4px solid ${theme.accent}`,
        position: "relative",
        height: "100%",
        cursor: "pointer",
        boxShadow: inCart
          ? `0 0 0 2px ${theme.accent}`
          : theme.popular
            ? `0 0 0 1px ${theme.accent}33, 0 8px 20px -8px ${theme.accent}55`
            : undefined,
      }}
      styles={{ body: { paddingTop: 20, height: "calc(100% - 58px)", display: "flex", flexDirection: "column" } }}
      actions={[
        <span key="cart" onClick={(e) => e.stopPropagation()}>
          <Button
            type="text"
            size="small"
            icon={inCart ? <CheckOutlined /> : <ShoppingCartOutlined />}
            onClick={() => onToggleCart(!inCart)}
            style={{ color: inCart ? theme.accent : undefined, fontWeight: inCart ? 600 : 400 }}
          >
            {inCart ? "In Cart" : "Add to Cart"}
          </Button>
        </span>,
        <span key="compare" onClick={(e) => e.stopPropagation()} className="flex justify-center">
          <Checkbox checked={compareChecked} onChange={(e) => onToggleCompare(e.target.checked)}>
            <span className="text-xs">Compare</span>
          </Checkbox>
        </span>,
        <span key="edit" onClick={(e) => e.stopPropagation()}>
          <Link href={`/service-catalog/${pkg.id}`}>
            <Button type="link" size="small" icon={<EditOutlined />} style={{ color: theme.accent }}>
              Edit
            </Button>
          </Link>
        </span>,
      ]}
    >
      {theme.popular && (
        <div
          className="absolute -top-3 right-4 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold text-white"
          style={{ background: theme.accent }}
        >
          <StarFilled style={{ fontSize: 10 }} /> Most Popular
        </div>
      )}

      <div className="flex items-center gap-3 mb-2">
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 40, height: 40, background: theme.soft, color: theme.accent, fontSize: 18, flexShrink: 0 }}
        >
          <Icon />
        </div>
        <div>
          <Title level={4} style={{ marginBottom: 0 }}>
            {pkg.name}
          </Title>
        </div>
      </div>

      <Paragraph type="secondary" className="text-sm" style={{ minHeight: 44 }}>
        {pkg.tagline}
      </Paragraph>

      <div className="flex flex-wrap gap-1 mb-2">
        {headline.map((r) => (
          <Tag key={r.service} style={{ background: theme.soft, color: theme.accent, borderColor: `${theme.accent}33` }}>
            {r.quantity}× {r.service}
          </Tag>
        ))}
        {pkg.resources.length > headline.length && (
          <Tag style={{ background: theme.soft, color: theme.accent, borderColor: `${theme.accent}33` }}>
            +{pkg.resources.length - headline.length} more
          </Tag>
        )}
      </div>

      <Text style={{ color: theme.accent, fontSize: 12.5, fontWeight: 500, marginTop: "auto" }}>
        View full details →
      </Text>
    </Card>
  );
}

function DetailsModal({
  pkg,
  onClose,
  inCart,
  onToggleCart,
}: {
  pkg: ServicePackage | null;
  onClose: () => void;
  inCart: boolean;
  onToggleCart: (add: boolean) => void;
}) {
  if (!pkg) return null;
  const theme = getPackageTheme(pkg.id);
  const Icon = theme.icon;

  return (
    <Modal open={!!pkg} onCancel={onClose} footer={null} width={600} destroyOnHidden>
      <div className="flex items-center gap-3 mb-1">
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 44, height: 44, background: theme.soft, color: theme.accent, fontSize: 20 }}
        >
          <Icon />
        </div>
        <div>
          <Title level={4} style={{ marginBottom: 0 }}>
            {pkg.name}
          </Title>
        </div>
      </div>
      <Paragraph type="secondary" className="mt-2">
        {pkg.tagline}
      </Paragraph>
      <Table
        size="small"
        pagination={false}
        dataSource={pkg.resources}
        rowKey="service"
        columns={[
          { title: "Resource", dataIndex: "service" },
          { title: "Qty", dataIndex: "quantity", width: 56, align: "right" as const },
          { title: "Purpose", dataIndex: "purpose" },
        ]}
      />
      <Button
        type="primary"
        className="mt-4"
        icon={inCart ? <CheckOutlined /> : <ShoppingCartOutlined />}
        style={{ background: theme.accent, borderColor: theme.accent }}
        onClick={() => onToggleCart(!inCart)}
      >
        {inCart ? "In Cart" : "Add to Cart"}
      </Button>
    </Modal>
  );
}

function CompareModal({
  packages,
  open,
  onClose,
}: {
  packages: ServicePackage[];
  open: boolean;
  onClose: () => void;
}) {
  const allResources = Array.from(new Set(packages.flatMap((p) => p.resources.map((r) => r.service))));

  return (
    <Modal
      title="Compare Packages"
      open={open}
      onCancel={onClose}
      footer={null}
      width={Math.min(920, 220 + packages.length * 220)}
      destroyOnHidden
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: "8px 10px" }} />
              {packages.map((p) => {
                const theme = getPackageTheme(p.id);
                const Icon = theme.icon;
                return (
                  <th key={p.id} style={{ padding: "8px 10px", textAlign: "left", borderBottom: `2px solid ${theme.accent}` }}>
                    <div className="flex items-center gap-1.5" style={{ color: theme.accent }}>
                      <Icon /> {p.name}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: "8px 10px", fontWeight: 600, verticalAlign: "top", whiteSpace: "nowrap" }}>Summary</td>
              {packages.map((p) => (
                <td key={p.id} style={{ padding: "8px 10px", color: "#64748b", fontSize: 12 }}>
                  {p.tagline}
                </td>
              ))}
            </tr>
            {allResources.map((name) => (
              <tr key={name}>
                <td style={{ padding: "8px 10px", borderTop: "1px solid #e2e8f0" }}>{name}</td>
                {packages.map((p) => {
                  const r = p.resources.find((x) => x.service === name);
                  return (
                    <td key={p.id} style={{ padding: "8px 10px", borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
                      {r ? `×${r.quantity}` : <span style={{ color: "#cbd5e1" }}>—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

export default function ServiceCatalogPage() {
  const router = useRouter();
  const { data: packages, loading, refetch } = useApi(getServiceCatalog);
  const { data: projects } = useApi(getProjects);
  const [newPackageOpen, setNewPackageOpen] = useState(false);
  const [cart, setCart] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [description, setDescription] = useState("");
  const [format, setFormat] = useState<QuoteFormat>("docx");
  const [generating, setGenerating] = useState(false);
  const [savingCostEstimate, setSavingCostEstimate] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromProject = params.get("projectId");
    const customer = params.get("customer");
    const project = params.get("project");
    if (fromProject) setProjectId(fromProject);
    if (project) setProjectName(project);
    if (customer) setCustomerName(customer);
  }, []);

  if (loading || !packages) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  const tiers = packages.filter((p) => p.category === "tier");
  const containers = packages.filter((p) => p.category === "container");
  const addons = packages.filter((p) => p.category === "addon");
  const cartPackages = cart.map((id) => packages.find((p) => p.id === id)).filter((p): p is ServicePackage => !!p);
  const comparePackages = compareIds
    .map((id) => packages.find((p) => p.id === id))
    .filter((p): p is ServicePackage => !!p);
  const detailsPkg = packages.find((p) => p.id === detailsId) ?? null;

  const toggleCart = (id: string, add: boolean) => {
    setCart((prev) => (add ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const toggleCompare = (id: string, add: boolean) => {
    setCompareIds((prev) => (add ? [...prev, id] : prev.filter((x) => x !== id)));
  };

  const handleSelectProject = (id: string | null) => {
    setProjectId(id);
    const project = id ? (projects ?? []).find((p) => p.id === id) : null;
    setProjectName(project?.name ?? null);
    if (project && !customerName.trim()) setCustomerName(project.customer);
  };

  const canGenerate = cart.length > 0 && customerName.trim().length > 0 && description.trim().length > 0;

  const handleGenerateQuote = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    try {
      const blob = await generateQuote(customerName, description, cart, format, projectId ?? undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ext = format === "docx" ? "docx" : "pdf";
      a.href = url;
      a.download = `Quote_${(customerName || "Customer").replace(/[^A-Za-z0-9_-]+/g, "_")}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      messageApi.success(projectId ? "Quote downloaded and saved to the project." : "Quote downloaded.");
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to generate quote.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveCostEstimate = async () => {
    if (!projectId || cart.length === 0) return;
    setSavingCostEstimate(true);
    try {
      const doc = await createCostEstimate(projectId, cart);
      messageApi.success("Cost estimate saved to the project.");
      router.push(`/documents/${doc.id}`);
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to save cost estimate.");
    } finally {
      setSavingCostEstimate(false);
    }
  };

  const renderRow = (items: ServicePackage[]) => (
    <Row gutter={[20, 20]} align="stretch">
      {items.map((pkg) => (
        <Col xs={24} md={8} key={pkg.id} style={{ display: "flex" }}>
          <PackageCard
            pkg={pkg}
            inCart={cart.includes(pkg.id)}
            onToggleCart={(add) => toggleCart(pkg.id, add)}
            compareChecked={compareIds.includes(pkg.id)}
            onToggleCompare={(add) => toggleCompare(pkg.id, add)}
            onViewDetails={() => setDetailsId(pkg.id)}
          />
        </Col>
      ))}
    </Row>
  );

  return (
    <div className="flex flex-col gap-4" style={{ paddingBottom: cart.length > 0 ? 260 : 0 }}>
      {contextHolder}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            Service Catalog
          </Title>
          <Text type="secondary">
            Productized offerings sold as a service — click a card for full details, add the ones a customer wants
            to the cart, then generate a quote.
          </Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setNewPackageOpen(true)}>
          New Package
        </Button>
      </div>

      {projectId && (
        <Alert
          type="success"
          showIcon
          message={`Generating a quote for ${projectName ?? "this project"}`}
          description="The customer name has been pre-filled, and this quote will be saved to the project's Quotes list once generated."
        />
      )}

      <Alert
        type="info"
        showIcon
        message="Not sure what to pick?"
        description={
          <ul className="text-sm mt-1 pl-4" style={{ listStyle: "disc", lineHeight: 1.9 }}>
            <li>Small workload, just getting started → <b>Basic</b></li>
            <li>Need high availability across AZs → <b>Intermediate</b> (most customers)</li>
            <li>Mission-critical, need DR &amp; compliance → <b>Advanced</b></li>
            <li>Running Kubernetes or containers → add <b>EKS</b> or <b>ECS</b></li>
            <li>Need a dedicated database, backups, or a security add-on → see <b>Additional Add-Ons</b></li>
          </ul>
        }
      />

      {renderRow(tiers)}

      <Divider orientation="left" orientationMargin={0}>
        <Text type="secondary" className="text-sm font-normal">
          Container Services (add-on)
        </Text>
      </Divider>
      {renderRow(containers)}

      <Divider orientation="left" orientationMargin={0}>
        <Text type="secondary" className="text-sm font-normal">
          Additional Add-Ons
        </Text>
      </Divider>
      {renderRow(addons)}

      {compareIds.length >= 2 && (
        <div className="fixed top-20 right-8" style={{ zIndex: 20 }}>
          <Button
            type="primary"
            icon={<DiffOutlined />}
            shape="round"
            size="large"
            onClick={() => setCompareModalOpen(true)}
            style={{ boxShadow: "0 8px 20px -8px rgba(0,0,0,.35)" }}
          >
            Compare ({compareIds.length})
          </Button>
        </div>
      )}

      {cart.length > 0 && (
        <div
          className="fixed bottom-0 right-0 bg-white border-t border-gray-200 shadow-lg flex flex-col gap-2 px-6 py-3"
          style={{ left: 232, zIndex: 10 }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <ShoppingCartOutlined className="text-gray-400" />
            {cartPackages.map((p) => {
              const theme = getPackageTheme(p.id);
              return (
                <Tag
                  key={p.id}
                  closable
                  onClose={() => toggleCart(p.id, false)}
                  style={{ background: theme.soft, color: theme.accent, borderColor: `${theme.accent}33` }}
                >
                  {p.name}
                </Tag>
              );
            })}
          </div>

          <div className="flex items-end gap-3">
            <div style={{ width: 200 }}>
              <Text type="secondary" className="text-xs">
                Link to Project (optional)
              </Text>
              <Select
                allowClear
                placeholder="None"
                value={projectId ?? undefined}
                onChange={(v) => handleSelectProject(v ?? null)}
                style={{ width: "100%" }}
                options={(projects ?? []).map((p) => ({ value: p.id, label: p.name }))}
                showSearch
                optionFilterProp="label"
              />
            </div>
            <div style={{ width: 220 }}>
              <Text type="secondary" className="text-xs">
                Customer Name <Text type="danger">*</Text>
              </Text>
              <Input
                placeholder="e.g. Northwind Retail"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                status={!customerName.trim() ? "warning" : undefined}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Text type="secondary" className="text-xs">
                Description <Text type="danger">*</Text>
              </Text>
              <TextArea
                placeholder="What is this quote for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                autoSize={{ minRows: 1, maxRows: 2 }}
                status={!description.trim() ? "warning" : undefined}
              />
            </div>
            <div style={{ width: 190 }}>
              <Text type="secondary" className="text-xs">
                Format
              </Text>
              <Select
                value={format}
                onChange={setFormat}
                style={{ width: "100%" }}
                options={FORMAT_OPTIONS.map((f) => ({ value: f.value, label: f.label }))}
              />
            </div>
            <Button
              type="primary"
              icon={<FormatIcon format={format} />}
              loading={generating}
              disabled={!canGenerate}
              onClick={handleGenerateQuote}
            >
              Generate Quote
            </Button>
            <Button
              icon={<CalculatorOutlined />}
              loading={savingCostEstimate}
              disabled={cart.length === 0 || !projectId}
              onClick={handleSaveCostEstimate}
              title={!projectId ? "Link to a project first to save a cost estimate" : undefined}
            >
              Save as Cost Estimate Document
            </Button>
          </div>
        </div>
      )}

      <DetailsModal
        pkg={detailsPkg}
        onClose={() => setDetailsId(null)}
        inCart={!!detailsId && cart.includes(detailsId)}
        onToggleCart={(add) => detailsId && toggleCart(detailsId, add)}
      />
      <CompareModal packages={comparePackages} open={compareModalOpen} onClose={() => setCompareModalOpen(false)} />

      <NewServicePackageModal
        open={newPackageOpen}
        onClose={() => setNewPackageOpen(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}

function FormatIcon({ format }: { format: QuoteFormat }) {
  const Icon = FORMAT_OPTIONS.find((f) => f.value === format)?.icon ?? FileWordOutlined;
  return <Icon />;
}
