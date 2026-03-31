"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Bot, ArrowLeft, Download, LayoutDashboard } from "lucide-react";
import UserMenu from "../components/user-menu";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type RequestDetail = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
};

function hasPrd(text: string): boolean {
  return (
    text.includes("# Product Requirements Document") ||
    text.includes("## 1. Executive Summary")
  );
}

function downloadPrd(content: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "product-requirements-document.md";
  a.click();
  URL.revokeObjectURL(url);
}

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<RequestDetail | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/requests/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then(setData)
      .catch(() => setError(true));
  }, [id]);

  const prdMessage = data?.messages
    .slice()
    .reverse()
    .find((m) => m.role === "assistant" && hasPrd(m.content));

  if (error) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Request not found.</p>
          <Link href="/" className="text-primary-600 hover:underline text-sm">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full" style={{ background: "var(--background)" }}>
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center shadow-sm">
              <FileText size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-gray-900 leading-tight truncate max-w-xs">
                {data.title}
              </h1>
              <p className="text-xs text-gray-500 leading-tight">Product Intake</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {prdMessage && (
              <button
                onClick={() => downloadPrd(prdMessage.content)}
                className="flex items-center gap-1.5 text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
              >
                <Download size={14} />
                Download PRD
              </button>
            )}
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LayoutDashboard size={14} />
              Dashboard
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft size={12} />
              Back
            </button>
          </div>

          {data.messages.map((message) => {
            const isUser = message.role === "user";
            const containsPrd = !isUser && hasPrd(message.content);

            return (
              <div
                key={message.id}
                className={`flex items-start gap-3 mb-5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <Bot size={15} className="text-white" />
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-3 ${
                    isUser
                      ? "max-w-[80%] bg-primary-600 text-white rounded-tr-sm shadow-sm"
                      : containsPrd
                        ? "w-full bg-white text-gray-800 rounded-tl-sm shadow-md border border-primary-100"
                        : "max-w-[85%] bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100"
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>
                  ) : (
                    <div className="text-sm prose-chat">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}

                  {containsPrd && (
                    <button
                      onClick={() => downloadPrd(message.content)}
                      className="mt-4 flex items-center gap-2 text-xs bg-secondary-50 text-secondary-700 border border-secondary-200 px-3 py-2 rounded-lg hover:bg-secondary-100 transition-colors font-medium"
                    >
                      <Download size={12} />
                      Download as Markdown file
                    </button>
                  )}
                </div>

                {isUser && <div className="w-8 flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
