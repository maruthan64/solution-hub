"use client";

import { Modal, Space, Button } from "antd";
import { EyeOutlined, FilePdfOutlined, FileWordOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DocumentPreviewModalProps {
  open: boolean;
  title: string;
  content: string;
  onClose: () => void;
  onExportWord?: () => void;
  onExportPdf?: () => void;
  exportingWord?: boolean;
  exportingPdf?: boolean;
}

export function DocumentPreviewModal({
  open,
  title,
  content,
  onClose,
  onExportWord,
  onExportPdf,
  exportingWord,
  exportingPdf,
}: DocumentPreviewModalProps) {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <span className="flex items-center gap-2">
          <EyeOutlined /> Preview — {title}
        </span>
      }
      width={860}
      styles={{ body: { padding: 0 } }}
      footer={
        <Space>
          {onExportWord && (
            <Button icon={<FileWordOutlined />} loading={exportingWord} onClick={onExportWord}>
              Export Word
            </Button>
          )}
          {onExportPdf && (
            <Button icon={<FilePdfOutlined />} loading={exportingPdf} onClick={onExportPdf}>
              Export PDF
            </Button>
          )}
          <Button type="primary" onClick={onClose}>
            Close
          </Button>
        </Space>
      }
    >
      <div className="bg-gray-100 p-6" style={{ maxHeight: "70vh", overflowY: "auto" }}>
        <div
          className="preview-page bg-white mx-auto shadow-sm"
          style={{ maxWidth: 720, padding: "48px 56px", minHeight: 400 }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content || "*Nothing to preview yet.*"}</ReactMarkdown>
        </div>
      </div>
      <style jsx global>{`
        .preview-page {
          font-family: Georgia, "Times New Roman", serif;
          color: #1f1f1f;
          line-height: 1.6;
        }
        .preview-page h1,
        .preview-page h2,
        .preview-page h3 {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-weight: 700;
          margin-top: 1.4em;
          margin-bottom: 0.5em;
        }
        .preview-page h1 {
          font-size: 24px;
          border-bottom: 2px solid #1f1f1f;
          padding-bottom: 8px;
        }
        .preview-page h2 {
          font-size: 19px;
          border-bottom: 1px solid #d9d9d9;
          padding-bottom: 4px;
        }
        .preview-page h3 {
          font-size: 16px;
        }
        .preview-page p {
          margin: 0.7em 0;
        }
        .preview-page table {
          border-collapse: collapse;
          width: 100%;
          margin: 1em 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          font-size: 13px;
        }
        .preview-page th,
        .preview-page td {
          border: 1px solid #d9d9d9;
          padding: 6px 10px;
          text-align: left;
        }
        .preview-page th {
          background: #fafafa;
          font-weight: 600;
        }
        .preview-page code {
          background: #f5f5f5;
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 0.9em;
        }
        .preview-page pre {
          background: #f5f5f5;
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
        }
        .preview-page blockquote {
          border-left: 3px solid #d9d9d9;
          margin: 0.8em 0;
          padding: 2px 16px;
          color: #595959;
        }
        .preview-page ul,
        .preview-page ol {
          padding-left: 1.4em;
        }
      `}</style>
    </Modal>
  );
}
