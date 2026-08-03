"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Card, Input, Spin, Typography, message } from "antd";
import { ProjectOutlined, RobotOutlined, SendOutlined, UserOutlined } from "@ant-design/icons";
import { ChatMessage, extractProjectFromChat, ProjectExtraction, sendChatMessage } from "@/lib/api";
import NewProjectModal from "@/components/NewProjectModal";

const { Title, Text, Paragraph } = Typography;

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: "assistant",
    content:
      "Hi, I'm your AI solution architect assistant. Describe the solution you're scoping — cloud provider, " +
      "workload, and any constraints you already know — and I'll ask what's missing.",
  },
];

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [extracted, setExtracted] = useState<ProjectExtraction | undefined>();
  const [messageApi, contextHolder] = message.useMessage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const hasUserMessage = messages.some((m) => m.role === "user");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setDraft("");
    setSending(true);
    try {
      const { reply } = await sendChatMessage(next);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "AI request failed.", 8);
      setMessages((prev) => prev.slice(0, -1));
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const handleCreateProjectFromChat = async () => {
    setExtracting(true);
    try {
      const result = await extractProjectFromChat(messages);
      setExtracted(result);
      setNewProjectOpen(true);
    } catch (err) {
      messageApi.error(err instanceof Error ? err.message : "Failed to summarize the conversation.", 8);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {contextHolder}
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          AI Chat
        </Title>
        <Text type="secondary">
          Talk through a solution with the AI. It uses the provider selected in Settings → AI Assistant.
        </Text>
      </div>

      <Card className="flex-1" styles={{ body: { padding: 0 } }}>
        <div className="flex flex-col" style={{ height: 560 }}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <Avatar icon={m.role === "user" ? <UserOutlined /> : <RobotOutlined />} />
                <div
                  className={`max-w-[75%] rounded-lg px-4 py-2 whitespace-pre-line ${
                    m.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex gap-3">
                <Avatar icon={<RobotOutlined />} />
                <div className="rounded-lg px-4 py-2 bg-gray-100">
                  <Spin size="small" />
                </div>
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 p-3 flex gap-2">
            <Input
              placeholder="Describe your solution, or answer the AI's question..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onPressEnter={handleSend}
              size="large"
              disabled={sending}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              size="large"
              onClick={handleSend}
              loading={sending}
              disabled={!draft.trim()}
            />
          </div>
        </div>
      </Card>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Paragraph type="secondary" className="text-xs" style={{ marginBottom: 0 }}>
          This chat is for scoping and discussion — it doesn&apos;t generate documents directly. Once you know what
          you need, create a project from this conversation (or start one from a matching template).
        </Paragraph>
        <Button
          icon={<ProjectOutlined />}
          loading={extracting}
          disabled={!hasUserMessage}
          onClick={handleCreateProjectFromChat}
        >
          Create Project from this Chat
        </Button>
      </div>

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onCreated={(project) => {
          setNewProjectOpen(false);
          router.push(`/projects/${project.id}`);
        }}
        initialValues={extracted}
      />
    </div>
  );
}
