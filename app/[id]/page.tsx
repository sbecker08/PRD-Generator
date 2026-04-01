"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import type { UIMessage, TextUIPart } from "ai";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Bot,
  ArrowLeft,
  Download,
  LayoutDashboard,
  Send,
  CheckCircle2,
  ClipboardCheck,
} from "lucide-react";
import { useSession } from "next-auth/react";
import UserMenu from "../components/user-menu";
import PageHeader from "../components/page-header";
import QuestionsPanel from "./questions-panel";
import EpicsPanel from "./epics-panel";
import TimelinePanel from "./timeline-panel";
import ChangeRequestsPanel from "./change-requests-panel";

type DbMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

type RequestDetail = {
  id: string;
  title: string;
  status: string;
  classification: string | null;
  application_name: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  messages: DbMessage[];
};

function hasPrd(text: string): boolean {
  return (
    text.includes("# Product Requirements Document") ||
    text.includes("## 1. Executive Summary")
  );
}

function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((p): p is TextUIPart => p.type === "text")
    .map((p) => p.text)
    .join("");
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

/** Convert DB messages to UIMessage format for useChat */
function toUIMessages(dbMessages: DbMessage[]): UIMessage[] {
  return dbMessages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: "text" as const, text: m.content }],
  }));
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

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [requestData, setRequestData] = useState<RequestDetail | null>(null);
  const [error, setError] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(
    null
  );
  const [input, setInput] = useState("");
  const [approving, setApproving] = useState(false);
  const [epicsKey, setEpicsKey] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: session } = useSession();

  // Determine if this conversation can be continued (only Draft status)
  const canChat = requestData?.status === "Draft";

  // Show approve button only when PRD is generated and current user is the original requester
  const canApprove =
    requestData?.status === "PRD Generated" &&
    session?.user?.id === requestData?.created_by_user_id;

  // Role checks for Q&A panel
  const userRoles = (session?.user as { roles?: string[] })?.roles ?? [];
  const isReviewer = userRoles.includes("IS Reviewer");
  const isEngineer = userRoles.includes("IS Engineer");
  const isRequester = session?.user?.id === requestData?.created_by_user_id;

  // Show Q&A panel for review-related statuses
  const showQAPanel = requestData && [
    "Business Approved", "IS Review", "Q&A Sent", "Epic Planning", "In Progress", "Complete"
  ].includes(requestData.status);

  // Show epics panel for Epic Planning and beyond
  const showEpicsPanel = requestData && [
    "Epic Planning", "In Progress", "Complete"
  ].includes(requestData.status);

  // Show change requests panel for In Progress and Complete
  const showChangeRequests = requestData && [
    "In Progress", "Complete"
  ].includes(requestData.status);

  // Show timeline for In Progress and Complete
  const showTimeline = requestData && [
    "In Progress", "Complete"
  ].includes(requestData.status);

  const handleApprove = async () => {
    if (!requestData || approving) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/requests/${id}/approve`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to approve PRD");
        return;
      }
      setRequestData({ ...requestData, status: "Business Approved" });
    } catch {
      alert("Failed to approve PRD");
    } finally {
      setApproving(false);
    }
  };

  // Fetch request data
  useEffect(() => {
    fetch(`/api/requests/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data: RequestDetail) => {
        setRequestData(data);
        const uiMessages = toUIMessages(data.messages);
        setInitialMessages(uiMessages);
        setMessages(uiMessages);
      })
      .catch(() => setError(true));
  }, [id]);

  const { messages, sendMessage, status: chatStatus, setMessages } = useChat();

  const isLoading = chatStatus === "submitted" || chatStatus === "streaming";

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
    if (!trimmed || isLoading || !canChat) return;
    setInput("");
    sendMessage({ text: trimmed }, { body: { requestId: id } });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  // Find PRD in messages
  const prdText = messages
    .slice()
    .reverse()
    .find((m) => m.role === "assistant" && hasPrd(getTextFromMessage(m)));
  const prdContent = prdText ? getTextFromMessage(prdText) : null;

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

  if (!requestData || initialMessages === null) {
    return (
      <div className="min-h-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "var(--background)" }}
    >
      {/* Header */}
      <PageHeader
        icon={<FileText size={18} className="text-white" />}
        title={requestData.title}
        subtitle={
          <div className="flex items-center gap-2">
            <span>Product Intake</span>
            <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {requestData.status}
            </span>
            {requestData.classification && (
              <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                {requestData.classification}
              </span>
            )}
          </div>
        }
        actions={
          <>
            {isReviewer && (
              <Link
                href="/review"
                className="flex items-center gap-1.5 text-sm text-yellow-700 px-3 py-1.5 rounded-lg hover:bg-yellow-50 transition-colors"
              >
                <ClipboardCheck size={14} />
                IS Review
              </Link>
            )}
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
          <div className="mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <ArrowLeft size={12} />
              Back
            </button>
          </div>

          {messages.map((message) => {
            const isUser = message.role === "user";
            const text = getTextFromMessage(message);
            // Strip hidden classification markers from display
            const displayText = text.replace(
              /<!-- CLASSIFICATION:.*?-->/g,
              ""
            ).trim();
            const containsPrd = !isUser && hasPrd(text);

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
                      onClick={() => downloadPrd(text)}
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

          {isLoading && <TypingIndicator />}

          {/* Q&A Panel for review-related statuses */}
          {showQAPanel && (
            <QuestionsPanel
              requestId={id}
              requestStatus={requestData.status}
              isReviewer={isReviewer}
              isRequester={isRequester}
              onStatusChange={(newStatus) =>
                setRequestData({ ...requestData, status: newStatus })
              }
            />
          )}

          {/* Epics Panel for Epic Planning and beyond */}
          {showEpicsPanel && (
            <EpicsPanel
              key={epicsKey}
              requestId={id}
              requestStatus={requestData.status}
              isEngineer={isEngineer}
              onStatusChange={(newStatus) =>
                setRequestData({ ...requestData, status: newStatus })
              }
            />
          )}

          {/* Change Requests Panel for In Progress and Complete */}
          {showChangeRequests && (
            <ChangeRequestsPanel
              requestId={id}
              requestStatus={requestData.status}
              isRequester={isRequester}
              isEngineer={isEngineer}
              onEpicsChanged={() => setEpicsKey((k) => k + 1)}
            />
          )}

          {/* Timeline for In Progress and Complete */}
          {showTimeline && (
            <TimelinePanel requestId={id} />
          )}

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Chat input — only shown for Draft requests */}
      {canChat && (
        <footer className="bg-white border-t border-gray-100 px-4 py-3 flex-shrink-0 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
          {prdContent && (
            <div className="max-w-3xl mx-auto mb-2 flex justify-end">
              <button
                onClick={() => downloadPrd(prdContent)}
                className="flex items-center gap-1.5 text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
              >
                <Download size={14} />
                Download PRD
              </button>
            </div>
          )}
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
                    : "Continue the conversation… (Enter to send, Shift+Enter for new line)"
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
            Continue your intake conversation to refine your requirements.
          </p>
        </footer>
      )}

      {/* Status message for non-Draft requests */}
      {!canChat && (
        <footer className="bg-gray-50 border-t border-gray-100 px-4 py-3 flex-shrink-0">
          {(canApprove || requestData?.status === "Business Approved" || prdContent) && (
            <div className="max-w-3xl mx-auto mb-2 flex items-center justify-end gap-2">
              {canApprove && (
                <button
                  onClick={handleApprove}
                  disabled={approving}
                  className="flex items-center gap-1.5 text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium shadow-sm"
                >
                  <CheckCircle2 size={14} />
                  {approving ? "Approving…" : "Approve PRD"}
                </button>
              )}
              {requestData?.status === "Business Approved" && (
                <span className="flex items-center gap-1.5 text-sm bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium">
                  <CheckCircle2 size={14} />
                  PRD Approved
                </span>
              )}
              {prdContent && (
                <button
                  onClick={() => downloadPrd(prdContent)}
                  className="flex items-center gap-1.5 text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
                >
                  <Download size={14} />
                  Download PRD
                </button>
              )}
            </div>
          )}
          <p className="max-w-3xl mx-auto text-xs text-gray-400 text-center">
            {requestData.status === "Q&A Sent" && isRequester
              ? "Please answer the reviewer's questions above."
              : requestData.status === "IS Review" && isReviewer
                ? "Review the PRD and add any clarifying questions, or mark the review as complete."
                : requestData.status === "Business Approved" && isReviewer
                  ? "This PRD is ready for your review. Add questions or mark as complete."
                  : requestData.status === "Epic Planning" && isEngineer
                    ? "Generate and refine the epic breakdown, then approve to begin development."
                    : requestData.status === "In Progress" && isEngineer
                      ? "Track build progress by updating epic statuses above."
                      : requestData.status === "Complete"
                        ? "This request has been completed."
                        : <>This conversation is complete. Status:{" "}
                            <span className="font-medium text-gray-600">
                              {requestData.status}
                            </span>
                          </>}
          </p>
        </footer>
      )}
    </div>
  );
}
