"use client";

import { useChat } from "@ai-sdk/react";
import { useState, useEffect, useRef, useCallback } from "react";
import type { UIMessage, TextUIPart } from "ai";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Download, FileText, RotateCcw, Bot, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import UserMenu from "../components/user-menu";
import PageHeader from "../components/page-header";

// Initial static greeting shown before any API call
const INITIAL_GREETING: UIMessage = {
  id: "welcome",
  role: "assistant",
  parts: [
    {
      type: "text",
      text: "Hi! I'm Product Intake, your product requirements specialist.\n\nI'll guide you through a series of questions to build a comprehensive **Product Requirements Document (PRD)** — the blueprint your development team needs to bring your idea to life.\n\nLet's start at the beginning: **What product or feature are you looking to build?** Tell me as much or as little as you know right now — we'll fill in the details as we go.",
    },
  ],
};

function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((p): p is TextUIPart => p.type === "text")
    .map((p) => p.text)
    .join("");
}

function hasPrd(text: string): boolean {
  return (
    text.includes("# Product Requirements Document") ||
    text.includes("## 1. Executive Summary")
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
        <Bot size={15} className="text-white" />
      </div>
      <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100">
        <div className="flex items-center gap-1.5 h-5">
          <div className="w-2 h-2 rounded-full bg-primary-400 dot-1" />
          <div className="w-2 h-2 rounded-full bg-primary-400 dot-2" />
          <div className="w-2 h-2 rounded-full bg-primary-400 dot-3" />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const requestIdRef = useRef<string | null>(null);

  const { messages, sendMessage, status, setMessages } = useChat({
    messages: [INITIAL_GREETING],
  });

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Auto-resize textarea
  const adjustTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, []);

  useEffect(() => {
    adjustTextarea();
  }, [input, adjustTextarea]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput("");

    // Create a request record on the first user message
    if (!requestIdRef.current) {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed.slice(0, 120) }),
      });
      const { id } = await res.json();
      requestIdRef.current = id;
    }

    sendMessage({ text: trimmed }, { body: { requestId: requestIdRef.current } });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleReset = () => {
    requestIdRef.current = null;
    setMessages([INITIAL_GREETING]);
    setInput("");
  };

  const downloadPrd = () => {
    const prdMessage = [...messages]
      .reverse()
      .find((m) => m.role === "assistant" && hasPrd(getTextFromMessage(m)));
    if (!prdMessage) return;
    const content = getTextFromMessage(prdMessage);
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product-requirements-document.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const prdIsReady = messages.some(
    (m) => m.role === "assistant" && hasPrd(getTextFromMessage(m))
  );

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--background)" }}>
      {/* Header */}
      <PageHeader
        icon={<FileText size={18} className="text-white" />}
        title="Product Intake"
        subtitle="Product Requirements Assistant"
        actions={
          <>
            {prdIsReady && (
              <button
                onClick={downloadPrd}
                className="flex items-center gap-1.5 text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
              >
                <Download size={14} />
                Download PRD
              </button>
            )}
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 text-sm text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Start a new conversation"
            >
              <RotateCcw size={14} />
              New
            </button>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LayoutDashboard size={14} />
              Dashboard
            </Link>
            <UserMenu />
          </>
        }
      />

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {messages.map((message) => {
            const isUser = message.role === "user";
            const text = getTextFromMessage(message);
            // Strip hidden classification markers from display
            const displayText = text.replace(/<!-- CLASSIFICATION:.*?-->/g, "").trim();
            const containsPrd = !isUser && hasPrd(text);

            return (
              <div
                key={message.id}
                className={`flex items-start gap-3 mb-5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                {/* Bot avatar */}
                {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                    <Bot size={15} className="text-white" />
                  </div>
                )}

                {/* Message bubble */}
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
                      {displayText}
                    </p>
                  ) : (
                    <div className="text-sm prose-chat">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {displayText}
                      </ReactMarkdown>
                    </div>
                  )}

                  {containsPrd && (
                    <button
                      onClick={downloadPrd}
                      className="mt-4 flex items-center gap-2 text-xs bg-secondary-50 text-secondary-700 border border-secondary-200 px-3 py-2 rounded-lg hover:bg-secondary-100 transition-colors font-medium"
                    >
                      <Download size={12} />
                      Download as Markdown file
                    </button>
                  )}
                </div>

                {/* User avatar spacer */}
                {isUser && <div className="w-8 flex-shrink-0" />}
              </div>
            );
          })}

          {/* Typing indicator */}
          {isLoading && (
            <TypingIndicator />
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input */}
      <footer className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
        <form
          onSubmit={handleSubmit}
          className="max-w-3xl mx-auto flex items-end gap-3"
        >
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isLoading
                  ? "Product Intake is thinking…"
                  : "Type your reply… (Enter to send, Shift+Enter for new line)"
              }
              disabled={isLoading}
              rows={1}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none leading-relaxed bg-gray-50 placeholder-gray-400 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ minHeight: "48px", maxHeight: "160px" }}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 w-10 h-10 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center shadow-sm"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </form>
        <p className="max-w-3xl mx-auto mt-1.5 text-xs text-gray-400 text-center">
          Product Intake asks questions until it has everything needed to write your requirements document.
        </p>
      </footer>
    </div>
  );
}
