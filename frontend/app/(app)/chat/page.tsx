"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Dropdown, Input, Spin, Tag, Typography, message } from "antd";
import type { MenuProps } from "antd";
import {
  ClearOutlined,
  PlusOutlined,
  ProjectOutlined,
  RobotOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  AiProvider,
  ChatMessage,
  extractProjectFromChat,
  getCurrentUser,
  getSettings,
  ProjectExtraction,
  sendChatMessage,
} from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { greeting } from "@/lib/greeting";
import NewProjectModal from "@/components/NewProjectModal";

const { Title, Text } = Typography;

const PROVIDER_LABELS: Record<AiProvider, string> = {
  claude_cli: "Claude CLI",
  bedrock: "AWS Bedrock",
};

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
  const { data: user } = useApi(getCurrentUser);
  const { data: settings } = useApi(getSettings);
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

  const handleClearConversation = () => {
    setMessages(INITIAL_MESSAGES);
    setDraft("");
  };

  const menuItems: MenuProps["items"] = [
    {
      key: "create-project",
      icon: <ProjectOutlined />,
      label: "Create Project from this Chat",
      disabled: !hasUserMessage || extracting,
      onClick: handleCreateProjectFromChat,
    },
    {
      key: "clear",
      icon: <ClearOutlined />,
      label: "Clear Conversation",
      disabled: !hasUserMessage,
      onClick: handleClearConversation,
    },
  ];

  const composer = (
    <div className="flex items-center gap-1.5 rounded-full border border-gray-200 bg-white shadow-sm px-2 py-1.5 w-full">
      <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="topLeft">
        <Button shape="circle" icon={<PlusOutlined />} />
      </Dropdown>
      <Input
        variant="borderless"
        placeholder="Describe your solution, or answer the AI's question..."
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPressEnter={handleSend}
        disabled={sending}
        className="flex-1"
      />
      <Button
        type="primary"
        shape="circle"
        icon={<SendOutlined />}
        onClick={handleSend}
        loading={sending}
        disabled={!draft.trim()}
      />
    </div>
  );

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 148px)" }}>
      {contextHolder}

      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <Title level={3} style={{ marginBottom: 0 }}>
            AI Chat
          </Title>
          <Text type="secondary" className="text-sm">
            Scoping and discussion — doesn&apos;t generate documents directly.
          </Text>
        </div>
        {settings && (
          <Tag
            className="cursor-pointer select-none"
            onClick={() => router.push("/settings")}
            style={{ borderRadius: 999, padding: "4px 12px" }}
          >
            <RobotOutlined /> {PROVIDER_LABELS[settings.aiProvider]}
          </Tag>
        )}
      </div>

      {!hasUserMessage ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-8 px-4">
          <div className="text-center max-w-lg">
            <Title level={2} style={{ marginBottom: 8 }}>
              {greeting(user?.name)}
            </Title>
            <Text type="secondary">{INITIAL_MESSAGES[0].content}</Text>
          </div>
          <div className="w-full" style={{ maxWidth: 640 }}>
            {composer}
          </div>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-2">
            <div className="mx-auto w-full py-4" style={{ maxWidth: 720 }}>
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 mb-4 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <Avatar icon={m.role === "user" ? <UserOutlined /> : <RobotOutlined />} />
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 whitespace-pre-line ${
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
                  <div className="rounded-2xl px-4 py-2 bg-gray-100">
                    <Spin size="small" />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="mx-auto w-full pt-3 px-2" style={{ maxWidth: 720 }}>
            {composer}
          </div>
        </>
      )}

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
