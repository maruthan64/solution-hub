"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Input, Space, Spin, Tag, Typography, message } from "antd";
import {
  ArrowLeftOutlined,
  EyeOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  LinkOutlined,
  RobotOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { assistTemplate, getTemplate, updateTemplate } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { CloudProviderIcon } from "@/components/icons/CloudIcons";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export default function TemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: template, loading } = useApi(() => getTemplate(id), [id]);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (template) {
      setContent(template.content);
      setSavedContent(template.content);
    }
  }, [template]);

  if (loading || !template) {
    return (
      <div className="flex justify-center py-20">
        <Spin size="large" />
      </div>
    );
  }

  const isDirty = content !== savedContent;

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTemplate(id, content);
      setSavedContent(content);
      messageApi.success("Template saved.");
    } catch {
      messageApi.error("Failed to save template.");
    } finally {
      setSaving(false);
    }
  };

  const handleAskAi = async () => {
    if (!instruction.trim()) return;
    setAsking(true);
    setSuggestion(null);
    try {
      const { suggestion: result } = await assistTemplate(id, instruction.trim());
      setSuggestion(result);
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "AI request failed.", 8);
    } finally {
      setAsking(false);
    }
  };

  const handleAppend = () => {
    if (!suggestion) return;
    setContent((c) => `${c.replace(/\n+$/, "")}\n\n${suggestion}\n`);
    setSuggestion(null);
    setInstruction("");
  };

  const handleReplaceAll = () => {
    if (!suggestion) return;
    setContent(suggestion);
    setSuggestion(null);
    setInstruction("");
  };

  const handleExport = async (format: "docx" | "pdf") => {
    setExporting(format);
    try {
      // Export always reads the saved copy from the DB, so save first if the
      // editor has unsaved changes — otherwise the file would be stale.
      if (isDirty) {
        await updateTemplate(id, content);
        setSavedContent(content);
      }
      window.open(`/api/templates/${id}/export?format=${format}`, "_blank");
    } catch {
      messageApi.error("Failed to save before export.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {contextHolder}
      <Link href="/templates" className="inline-flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeftOutlined /> Back to Templates
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            {template.name}
          </Title>
          <Text type="secondary">{template.description}</Text>
        </div>
        <Space>
          <Tag className="flex items-center gap-1.5" style={{ paddingBlock: 2 }}>
            <CloudProviderIcon cloud={template.cloud} width={14} height={14} />
            {template.cloud}
          </Tag>
          <Button icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>
            Preview
          </Button>
          <Button icon={<FileWordOutlined />} loading={exporting === "docx"} onClick={() => handleExport("docx")}>
            Word
          </Button>
          <Button icon={<FilePdfOutlined />} loading={exporting === "pdf"} onClick={() => handleExport("pdf")}>
            PDF
          </Button>
          <Button type="primary" icon={<SaveOutlined />} disabled={!isDirty} loading={saving} onClick={handleSave}>
            Save Changes
          </Button>
        </Space>
      </div>

      {template.source && (
        <Alert
          type="info"
          showIcon
          icon={<LinkOutlined />}
          message={
            <Text className="text-sm">
              Starting content adapted from{" "}
              <a href={template.source.url} target="_blank" rel="noopener noreferrer">
                {template.source.label}
              </a>
              . Edit freely below — this is your organization&apos;s copy.
            </Text>
          }
        />
      )}

      <div className="flex gap-4 items-start">
        <Card className="flex-1">
          <TextArea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            autoSize={{ minRows: 24, maxRows: 60 }}
            className="font-mono text-sm"
            spellCheck={false}
          />
        </Card>

        <Card
          title={
            <span className="flex items-center gap-2">
              <RobotOutlined /> AI Assistant
            </span>
          }
          style={{ width: 340, flexShrink: 0 }}
        >
          <Paragraph type="secondary" className="text-xs">
            Ask the AI to draft or rewrite part of this template. It sees the current content, so you can ask it to
            fill in specific sections.
          </Paragraph>
          <TextArea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='e.g. "Draft the Context section for choosing ALB over NLB for EKS ingress"'
            rows={3}
            disabled={asking}
          />
          <Button
            type="primary"
            icon={<RobotOutlined />}
            loading={asking}
            disabled={!instruction.trim()}
            onClick={handleAskAi}
            block
            className="mt-2"
          >
            Ask AI
          </Button>

          {suggestion && (
            <div className="mt-4 flex flex-col gap-2">
              <Text type="secondary" className="text-xs">
                Suggestion
              </Text>
              <div
                className="border border-gray-200 rounded-md p-2 text-xs font-mono whitespace-pre-wrap overflow-y-auto"
                style={{ maxHeight: 240 }}
              >
                {suggestion}
              </div>
              <Space>
                <Button size="small" type="primary" onClick={handleAppend}>
                  Append to editor
                </Button>
                <Button size="small" onClick={handleReplaceAll}>
                  Replace all
                </Button>
                <Button size="small" type="text" onClick={() => setSuggestion(null)}>
                  Discard
                </Button>
              </Space>
            </div>
          )}
        </Card>
      </div>

      <DocumentPreviewModal
        open={previewOpen}
        title={template.name}
        content={content}
        onClose={() => setPreviewOpen(false)}
        onExportWord={() => handleExport("docx")}
        onExportPdf={() => handleExport("pdf")}
        exportingWord={exporting === "docx"}
        exportingPdf={exporting === "pdf"}
      />
    </div>
  );
}
