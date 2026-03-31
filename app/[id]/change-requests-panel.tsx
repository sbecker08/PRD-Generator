"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  RefreshCw,
  Plus,
  Send,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Bot,
  Zap,
  Clock,
  FileText,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChangeRequest = {
  id: string;
  request_id: string;
  conversation_history: ConversationMessage[];
  status: "Draft" | "Submitted" | "Approved" | "Applied";
  summary: string | null;
  created_by_user_id: string | null;
  created_by_name: string;
  created_at: string;
  updated_at: string;
};

type ChangeRequestsPanelProps = {
  requestId: string;
  requestStatus: string;
  isRequester: boolean;
  isEngineer: boolean;
  onEpicsChanged: () => void;
};

const CR_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Draft: { bg: "bg-gray-100", text: "text-gray-600" },
  Submitted: { bg: "bg-orange-100", text: "text-orange-700" },
  Approved: { bg: "bg-blue-100", text: "text-blue-700" },
  Applied: { bg: "bg-green-100", text: "text-green-700" },
};

export default function ChangeRequestsPanel({
  requestId,
  requestStatus,
  isRequester,
  isEngineer,
  onEpicsChanged,
}: ChangeRequestsPanelProps) {
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{
    analysis: string;
    changes: Array<{ type: string; title: string }>;
  } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const canCreate = isRequester && requestStatus === "In Progress";

  const fetchChangeRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${requestId}/change-requests`);
      if (res.ok) {
        const data = await res.json();
        setChangeRequests(data);
      }
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchChangeRequests();
  }, [fetchChangeRequests]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [changeRequests, expandedId]);

  const createChangeRequest = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/change-requests`, {
        method: "POST",
      });

      if (res.ok) {
        const cr = await res.json();
        await fetchChangeRequests();
        setExpandedId(cr.id);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create change request");
      }
    } finally {
      setCreating(false);
    }
  };

  const sendChatMessage = async (crId: string) => {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;

    setChatLoading(true);
    setChatInput("");

    // Optimistically add user message
    setChangeRequests((prev) =>
      prev.map((cr) =>
        cr.id === crId
          ? {
              ...cr,
              conversation_history: [
                ...cr.conversation_history,
                { role: "user" as const, content: trimmed },
              ],
            }
          : cr
      )
    );

    try {
      const res = await fetch(
        `/api/requests/${requestId}/change-requests/${crId}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        }
      );

      if (res.ok) {
        const data = await res.json();
        setChangeRequests((prev) =>
          prev.map((cr) =>
            cr.id === crId
              ? {
                  ...cr,
                  conversation_history: data.conversation_history,
                  summary: data.hasSummary ? data.message.content : cr.summary,
                }
              : cr
          )
        );
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send message");
        // Revert optimistic update
        fetchChangeRequests();
      }
    } finally {
      setChatLoading(false);
    }
  };

  const submitChangeRequest = async (crId: string) => {
    setSubmitting(crId);
    try {
      const res = await fetch(
        `/api/requests/${requestId}/change-requests/${crId}/submit`,
        { method: "POST" }
      );

      if (res.ok) {
        fetchChangeRequests();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to submit change request");
      }
    } finally {
      setSubmitting(null);
    }
  };

  const approveChangeRequest = async (crId: string) => {
    setApproving(crId);
    try {
      const res = await fetch(
        `/api/requests/${requestId}/change-requests/${crId}/approve`,
        { method: "POST" }
      );

      if (res.ok) {
        fetchChangeRequests();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to approve change request");
      }
    } finally {
      setApproving(null);
    }
  };

  const applyChangeRequest = async (crId: string) => {
    setApplying(crId);
    setApplyResult(null);
    try {
      const res = await fetch(
        `/api/requests/${requestId}/change-requests/${crId}/apply`,
        { method: "POST" }
      );

      if (res.ok) {
        const data = await res.json();
        setApplyResult({ analysis: data.analysis, changes: data.changes });
        fetchChangeRequests();
        onEpicsChanged();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to apply change request");
      }
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mt-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          Loading change requests...
        </div>
      </div>
    );
  }

  // Don't show panel if no change requests and user can't create one
  if (changeRequests.length === 0 && !canCreate) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-4">
      {/* Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="text-amber-600" />
          <h3 className="text-sm font-semibold text-gray-700">
            Change Requests
          </h3>
          {changeRequests.length > 0 && (
            <span className="text-xs text-gray-400">
              ({changeRequests.length})
            </span>
          )}
        </div>
        {canCreate && (
          <button
            onClick={createChangeRequest}
            disabled={creating}
            className="flex items-center gap-1.5 text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            <Plus size={12} />
            {creating ? "Creating..." : "Submit Change Request"}
          </button>
        )}
      </div>

      {/* Change request list */}
      <div className="divide-y divide-gray-50">
        {changeRequests.map((cr, index) => {
          const isExpanded = expandedId === cr.id;
          const colors = CR_STATUS_COLORS[cr.status] || CR_STATUS_COLORS.Draft;
          const isDraft = cr.status === "Draft";
          const isOwnDraft = isDraft && isRequester;
          const hasSummary = !!cr.summary;

          return (
            <div key={cr.id}>
              {/* Change request header row */}
              <div className="px-5 py-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setExpandedId(isExpanded ? null : cr.id)
                    }
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>
                  <span className="text-xs text-gray-400 font-mono w-6">
                    #{index + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-800 flex-1">
                    {hasSummary
                      ? `Change Request — ${cr.summary?.split("\n").find((l) => l.startsWith("## Description"))
                          ? "Documented"
                          : "Summarized"}`
                      : "Change Request — In Progress"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {cr.created_by_name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} font-medium`}
                  >
                    {cr.status}
                  </span>

                  {/* Action buttons */}
                  {isOwnDraft && hasSummary && (
                    <button
                      onClick={() => submitChangeRequest(cr.id)}
                      disabled={submitting === cr.id}
                      className="flex items-center gap-1 text-xs bg-orange-600 text-white px-2.5 py-1 rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors font-medium"
                    >
                      <Send size={11} />
                      {submitting === cr.id ? "..." : "Submit"}
                    </button>
                  )}
                  {isEngineer && cr.status === "Submitted" && (
                    <button
                      onClick={() => approveChangeRequest(cr.id)}
                      disabled={approving === cr.id}
                      className="flex items-center gap-1 text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                    >
                      <CheckCircle2 size={11} />
                      {approving === cr.id ? "..." : "Approve"}
                    </button>
                  )}
                  {isEngineer && cr.status === "Approved" && (
                    <button
                      onClick={() => applyChangeRequest(cr.id)}
                      disabled={applying === cr.id}
                      className="flex items-center gap-1 text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
                    >
                      <Zap size={11} />
                      {applying === cr.id ? "Analyzing..." : "Apply Changes"}
                    </button>
                  )}
                </div>
                <div className="ml-12 mt-1 flex items-center gap-2">
                  <Clock size={10} className="text-gray-300" />
                  <span className="text-xs text-gray-400">
                    {new Date(cr.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-5 pb-4 border-t border-gray-50">
                  {/* Conversation */}
                  <div className="mt-3 space-y-3 max-h-96 overflow-y-auto">
                    {cr.conversation_history.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 ${
                          msg.role === "user" ? "flex-row-reverse" : ""
                        }`}
                      >
                        {msg.role === "assistant" && (
                          <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Bot size={12} className="text-amber-600" />
                          </div>
                        )}
                        <div
                          className={`rounded-xl px-3 py-2 text-sm ${
                            msg.role === "user"
                              ? "bg-primary-600 text-white max-w-[80%] rounded-tr-sm"
                              : msg.content.includes(
                                    "# Change Request Summary"
                                  )
                                ? "bg-amber-50 border border-amber-200 text-gray-800 w-full"
                                : "bg-gray-50 text-gray-800 max-w-[85%] rounded-tl-sm"
                          }`}
                        >
                          {msg.role === "user" ? (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          ) : (
                            <div className="prose-chat text-sm">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {msg.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                        {msg.role === "user" && (
                          <div className="w-6 flex-shrink-0" />
                        )}
                      </div>
                    ))}

                    {chatLoading && (
                      <div className="flex items-start gap-2">
                        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                          <Bot size={12} className="text-amber-600" />
                        </div>
                        <div className="bg-gray-50 rounded-xl rounded-tl-sm px-3 py-2">
                          <div className="flex items-center gap-1.5 h-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 dot-1" />
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 dot-2" />
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 dot-3" />
                          </div>
                        </div>
                      </div>
                    )}

                    <div ref={chatEndRef} />
                  </div>

                  {/* Chat input for draft change requests */}
                  {isOwnDraft && (
                    <div className="mt-3 flex items-end gap-2">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Describe your change..."
                        rows={2}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none bg-gray-50"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            sendChatMessage(cr.id);
                          }
                        }}
                        disabled={chatLoading}
                      />
                      <button
                        onClick={() => sendChatMessage(cr.id)}
                        disabled={!chatInput.trim() || chatLoading}
                        className="flex-shrink-0 w-9 h-9 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  )}

                  {/* Summary display for non-draft */}
                  {cr.status === "Applied" && cr.summary && (
                    <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <FileText size={12} className="text-green-600" />
                        <span className="text-xs font-medium text-green-700">
                          Applied Successfully
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Apply result */}
                  {applyResult && applying === null && expandedId === cr.id && (
                    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Zap size={12} className="text-blue-600" />
                        <span className="text-xs font-medium text-blue-700">
                          Impact Analysis Result
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-2">
                        {applyResult.analysis}
                      </p>
                      {applyResult.changes.length > 0 && (
                        <ul className="text-xs text-gray-600 space-y-1">
                          {applyResult.changes.map((c, i) => (
                            <li key={i}>
                              {c.type === "modified" ? "Modified" : "Created"}{" "}
                              epic: <span className="font-medium">{c.title}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Applying spinner */}
                  {applying === cr.id && (
                    <div className="mt-3 text-center py-4">
                      <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs text-gray-500">
                        AI is analyzing epic impact and applying changes...
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {changeRequests.length === 0 && (
          <div className="px-5 py-8 text-center">
            <RefreshCw size={24} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              No change requests yet.
              {canCreate &&
                " Click \"Submit Change Request\" to request changes to the current requirements."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
