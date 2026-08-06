"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input, Spin } from "antd";
import {
  BookOutlined,
  FileTextOutlined,
  ProjectOutlined,
  SearchOutlined,
  FileDoneOutlined,
} from "@ant-design/icons";
import { search, SearchResult } from "@/lib/api";

const TYPE_META: Record<SearchResult["type"], { label: string; icon: React.ReactNode }> = {
  project: { label: "Projects", icon: <ProjectOutlined /> },
  document: { label: "Documents", icon: <FileTextOutlined /> },
  template: { label: "Templates", icon: <FileDoneOutlined /> },
  knowledge: { label: "Knowledge Base", icon: <BookOutlined /> },
};

export default function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      search(term)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const grouped = (Object.keys(TYPE_META) as SearchResult["type"][])
    .map((type) => ({ type, items: results.filter((r) => r.type === type) }))
    .filter((g) => g.items.length > 0);

  const handleSelect = (url: string) => {
    setOpen(false);
    setQuery("");
    router.push(url);
  };

  return (
    <div ref={containerRef} className="relative" style={{ width: 320 }}>
      <Input
        prefix={<SearchOutlined className="text-gray-400" />}
        placeholder="Search projects, documents, templates..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        allowClear
      />
      {open && query.trim().length >= 2 && (
        <div
          className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-y-auto"
          style={{ maxHeight: 360, zIndex: 50 }}
        >
          {loading ? (
            <div className="flex justify-center py-6">
              <Spin size="small" />
            </div>
          ) : grouped.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-6">No results for &quot;{query}&quot;</div>
          ) : (
            grouped.map((group) => (
              <div key={group.type} className="py-1">
                <div className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  {TYPE_META[group.type].label}
                </div>
                {group.items.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleSelect(item.url)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50"
                  >
                    <span className="text-gray-400">{TYPE_META[item.type].icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm truncate">{item.title}</div>
                      <div className="text-xs text-gray-400 truncate">{item.subtitle}</div>
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
