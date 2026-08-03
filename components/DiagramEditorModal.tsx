"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input, Modal, Space, Spin, message } from "antd";
import { FileImageOutlined, RobotOutlined, SaveOutlined } from "@ant-design/icons";
import {
  assistDocumentDiagram,
  diagramImageUrl,
  getDocumentDiagram,
  saveDocumentDiagram,
  uploadDiagramImage,
} from "@/lib/api";

const BLANK_DIAGRAM_XML =
  '<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" page="1" pageWidth="850" pageHeight="1100">' +
  "<root><mxCell id=\"0\" /><mxCell id=\"1\" parent=\"0\" /></root></mxGraphModel>";

// embed=1 + proto=json puts the editor in postMessage-controlled embed mode; saveAndExit=0 and
// noExitBtn=1 keep it from trying to close itself (there's nothing to "exit" to — we own the modal).
const EMBED_SRC = "https://embed.diagrams.net/?embed=1&proto=json&spin=1&saveAndExit=0&noExitBtn=1&libraries=1";

interface DrawioMessage {
  event: string;
  xml?: string;
  data?: string;
}

interface DiagramEditorModalProps {
  open: boolean;
  onClose: () => void;
  documentId: string;
  onInsert: (url: string) => void;
}

export default function DiagramEditorModal({ open, onClose, documentId, onInsert }: DiagramEditorModalProps) {
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [inserting, setInserting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const latestXmlRef = useRef<string>(BLANK_DIAGRAM_XML);

  const postToEditor = (msg: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify(msg), "*");
  };

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setReady(false);
    getDocumentDiagram(documentId)
      .then((d) => {
        latestXmlRef.current = d.xml && d.xml.trim() ? d.xml : BLANK_DIAGRAM_XML;
      })
      .catch(() => {
        latestXmlRef.current = BLANK_DIAGRAM_XML;
      })
      .finally(() => setLoading(false));
  }, [open, documentId]);

  useEffect(() => {
    if (!open) return;

    const handleMessage = (evt: MessageEvent) => {
      if (typeof evt.data !== "string") return;
      let msg: DrawioMessage;
      try {
        msg = JSON.parse(evt.data);
      } catch {
        return;
      }

      if (msg.event === "init") {
        setReady(true);
        postToEditor({ action: "load", xml: latestXmlRef.current, autosave: 1 });
        return;
      }

      if ((msg.event === "autosave" || msg.event === "save") && typeof msg.xml === "string") {
        latestXmlRef.current = msg.xml;
        return;
      }

      if (msg.event === "export" && typeof msg.data === "string") {
        const dataUrl = msg.data;
        (async () => {
          try {
            const res = await fetch(dataUrl);
            const blob = await res.blob();
            await uploadDiagramImage(documentId, blob);
            onInsert(diagramImageUrl(documentId));
            messageApi.success("Diagram inserted into the document.");
            onClose();
          } catch (err) {
            messageApi.error(err instanceof Error ? err.message : "Failed to insert diagram.");
          } finally {
            setInserting(false);
          }
        })();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId]);

  const handleAskAi = async () => {
    if (!instruction.trim() || asking) return;
    setAsking(true);
    try {
      const result = await assistDocumentDiagram(documentId, instruction.trim());
      latestXmlRef.current = result.xml;
      postToEditor({ action: "load", xml: result.xml, autosave: 1 });
      messageApi.success("Diagram drafted — review and adjust as needed.");
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to draft diagram.");
    } finally {
      setAsking(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveDocumentDiagram(documentId, latestXmlRef.current);
      messageApi.success("Diagram saved.");
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to save diagram.");
    } finally {
      setSaving(false);
    }
  };

  const handleInsert = () => {
    setInserting(true);
    postToEditor({ action: "export", format: "png", xml: latestXmlRef.current });
  };

  return (
    <Modal
      title="Architecture Diagram"
      open={open}
      onCancel={onClose}
      width={1000}
      destroyOnHidden
      styles={{ body: { padding: 0 } }}
      footer={
        <Space wrap>
          <Input
            placeholder="Describe the architecture to draft..."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onPressEnter={handleAskAi}
            style={{ width: 320 }}
            disabled={!ready || asking}
          />
          <Button icon={<RobotOutlined />} onClick={handleAskAi} loading={asking} disabled={!ready}>
            Ask AI to draft
          </Button>
          <Button icon={<SaveOutlined />} onClick={handleSave} loading={saving} disabled={!ready}>
            Save
          </Button>
          <Button type="primary" icon={<FileImageOutlined />} onClick={handleInsert} loading={inserting} disabled={!ready}>
            Insert into document
          </Button>
        </Space>
      }
    >
      {contextHolder}
      {loading ? (
        <div className="flex justify-center items-center" style={{ height: 560 }}>
          <Spin size="large" />
        </div>
      ) : (
        <iframe
          ref={iframeRef}
          src={EMBED_SRC}
          style={{ width: "100%", height: 560, border: "none", display: "block" }}
          title="Architecture diagram editor"
        />
      )}
    </Modal>
  );
}
