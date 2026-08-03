"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Input, Modal, Space, Spin, Tag, Typography, message } from "antd";
import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  CheckCircleOutlined,
  EditOutlined,
  EyeOutlined,
  FileMarkdownOutlined,
  FilePdfOutlined,
  FileWordOutlined,
  RobotOutlined,
  SaveOutlined,
  SendOutlined,
} from "@ant-design/icons";
import {
  approveDocument,
  assistDocument,
  getCurrentUser,
  getDocument,
  requestDocumentChanges,
  submitDocumentForReview,
  updateDocument,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import DiagramEditorModal from "@/components/DiagramEditorModal";
import { DocStatus } from "@/lib/types";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const TYPE_COLOR: Record<string, string> = {
  SDD: "blue",
  ADR: "purple",
  BOM: "cyan",
  "Cost Estimate": "gold",
  "Security Review": "red",
  Runbook: "green",
  Handover: "geekblue",
};

const STATUS_COLOR: Record<DocStatus, string> = {
  Draft: "default",
  "In Review": "gold",
  Approved: "green",
};

export default function DocumentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: document, loading } = useApi(() => getDocument(id), [id]);
  const { data: currentUser } = useApi(getCurrentUser);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [docStatus, setDocStatus] = useState<DocStatus>("Draft");
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [exporting, setExporting] = useState<"docx" | "pdf" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [changesModalOpen, setChangesModalOpen] = useState(false);
  const [changesNote, setChangesNote] = useState("");
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    if (document) {
      setContent(document.content);
      setSavedContent(document.content);
      setDocStatus(document.status);
      setReviewNote(document.reviewNote);
    }
  }, [document]);

  if (loading || !document) {
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
      const updated = await updateDocument(id, content);
      setSavedContent(content);
      setDocStatus(updated.status);
      setReviewNote(updated.reviewNote);
      messageApi.success(
        updated.status === "Draft" && docStatus !== "Draft"
          ? "Document saved — review status reset to Draft since content changed."
          : "Document saved.",
      );
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to save document.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitForReview = async () => {
    setWorkflowBusy(true);
    try {
      if (isDirty) {
        await updateDocument(id, content);
        setSavedContent(content);
      }
      const updated = await submitDocumentForReview(id);
      setDocStatus(updated.status);
      setReviewNote(updated.reviewNote);
      messageApi.success("Submitted for review.");
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to submit for review.");
    } finally {
      setWorkflowBusy(false);
    }
  };

  const handleApprove = async () => {
    setWorkflowBusy(true);
    try {
      const updated = await approveDocument(id);
      setDocStatus(updated.status);
      setReviewNote(updated.reviewNote);
      messageApi.success("Document approved.");
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to approve document.");
    } finally {
      setWorkflowBusy(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!changesNote.trim()) return;
    setWorkflowBusy(true);
    try {
      const updated = await requestDocumentChanges(id, changesNote.trim());
      setDocStatus(updated.status);
      setReviewNote(updated.reviewNote);
      setChangesModalOpen(false);
      setChangesNote("");
      messageApi.success("Changes requested.");
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to request changes.");
    } finally {
      setWorkflowBusy(false);
    }
  };

  const handleAskAi = async () => {
    if (!instruction.trim()) return;
    setAsking(true);
    setSuggestion(null);
    try {
      const { suggestion: result } = await assistDocument(id, instruction.trim());
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
      if (isDirty) {
        await updateDocument(id, content);
        setSavedContent(content);
      }
      window.open(`/api/documents/${id}/export?format=${format}`, "_blank");
    } catch {
      messageApi.error("Failed to save before export.");
    } finally {
      setExporting(null);
    }
  };

  const handleInsertDiagram = (url: string) => {
    const line = `![Architecture Diagram](${url})`;
    setContent((c) => (c.includes(url) ? c : `${c.replace(/\n+$/, "")}\n\n${line}\n`));
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${document.title.replace(/[^A-Za-z0-9_-]+/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canSubmitForReview =
    docStatus === "Draft" && (currentUser?.role === "Owner" || currentUser?.role === "Architect");
  const canReview = docStatus === "In Review" && (currentUser?.role === "Owner" || currentUser?.role === "Reviewer");

  return (
    <div className="flex flex-col gap-4">
      {contextHolder}
      <Link href="/documents" className="inline-flex items-center gap-1 text-sm text-gray-500">
        <ArrowLeftOutlined /> Back to Documents
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            {document.title}
          </Title>
          <Text type="secondary">
            {document.project} · {document.version}
          </Text>
        </div>
        <Space>
          <Tag color={TYPE_COLOR[document.type]}>{document.type}</Tag>
          <Tag color={STATUS_COLOR[docStatus]}>{docStatus}</Tag>
          <Button icon={<EyeOutlined />} onClick={() => setPreviewOpen(true)}>
            Preview
          </Button>
          <Button icon={<ApartmentOutlined />} onClick={() => setDiagramOpen(true)}>
            Diagram
          </Button>
          <Button icon={<FileMarkdownOutlined />} onClick={handleDownloadMarkdown}>
            Markdown
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

      {(reviewNote || canSubmitForReview || canReview || docStatus === "In Review" || docStatus === "Approved") && (
        <Card size="small">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px]">
              {reviewNote && (
                <Alert
                  type="warning"
                  showIcon
                  message="Changes requested"
                  description={reviewNote}
                  style={{ marginBottom: 0 }}
                />
              )}
              {!reviewNote && docStatus === "In Review" && (
                <Text type="secondary">Awaiting review{canReview ? " — approve or request changes below." : "."}</Text>
              )}
              {!reviewNote && docStatus === "Approved" && (
                <Text type="secondary">
                  <CheckCircleOutlined style={{ color: "#389e0d" }} /> Approved. Editing this document will move it
                  back to Draft.
                </Text>
              )}
            </div>
            <Space>
              {canSubmitForReview && (
                <Button icon={<SendOutlined />} loading={workflowBusy} onClick={handleSubmitForReview}>
                  Submit for Review
                </Button>
              )}
              {canReview && (
                <>
                  <Button
                    icon={<EditOutlined />}
                    loading={workflowBusy}
                    onClick={() => setChangesModalOpen(true)}
                  >
                    Request Changes
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    loading={workflowBusy}
                    onClick={handleApprove}
                  >
                    Approve
                  </Button>
                </>
              )}
            </Space>
          </div>
        </Card>
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
            Ask the AI to draft or rewrite part of this document. It sees the current content, so you can ask it to
            fill in specific sections.
          </Paragraph>
          <TextArea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='e.g. "Fill in the Cost Estimate assumptions for a 3-node cluster"'
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
        title={document.title}
        content={content}
        onClose={() => setPreviewOpen(false)}
        onExportWord={() => handleExport("docx")}
        onExportPdf={() => handleExport("pdf")}
        exportingWord={exporting === "docx"}
        exportingPdf={exporting === "pdf"}
      />

      <DiagramEditorModal
        open={diagramOpen}
        documentId={id}
        onClose={() => setDiagramOpen(false)}
        onInsert={handleInsertDiagram}
      />

      <Modal
        open={changesModalOpen}
        title="Request changes"
        onCancel={() => setChangesModalOpen(false)}
        onOk={handleRequestChanges}
        okText="Send back to Draft"
        okButtonProps={{ disabled: !changesNote.trim(), loading: workflowBusy }}
      >
        <Paragraph type="secondary" className="text-sm">
          This sends the document back to Draft for the author to revise. Explain what needs to change.
        </Paragraph>
        <TextArea
          value={changesNote}
          onChange={(e) => setChangesNote(e.target.value)}
          rows={4}
          placeholder="e.g. Cost estimate assumes single-AZ RDS, but the customer needs Multi-AZ — please update."
        />
      </Modal>
    </div>
  );
}
