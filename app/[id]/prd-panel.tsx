"use client";

import { useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Download,
  History,
  Sparkles,
} from "lucide-react";

type PrdVersion = {
  id: string;
  version_number: number;
  content: string;
  change_summary: string | null;
  status: "Pending Approval" | "Approved" | "Superseded";
  generated_at: string;
  approved_at: string | null;
  approved_by_name: string | null;
};

type PrdPanelProps = {
  requestId: string;
  requestStatus: string;
  isRequester: boolean;
  onStatusChange: (newStatus: string) => void;
};

function downloadPrd(content: string, versionNumber: number) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `product-requirements-document-v${versionNumber}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_BADGE: Record<
  PrdVersion["status"],
  { label: string; className: string }
> = {
  "Pending Approval": {
    label: "Pending Approval",
    className: "bg-yellow-100 text-yellow-700",
  },
  Approved: {
    label: "Approved",
    className: "bg-green-100 text-green-700",
  },
  Superseded: {
    label: "Superseded",
    className: "bg-gray-100 text-gray-500",
  },
};

export default function PrdPanel({
  requestId,
  requestStatus,
  isRequester,
  onStatusChange,
}: PrdPanelProps) {
  const [versions, setVersions] = useState<PrdVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const fetchVersions = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${requestId}/prd/versions`);
      if (res.ok) {
        const data: PrdVersion[] = await res.json();
        setVersions(data);
        // Default to the latest version
        if (data.length > 0) {
          setSelectedVersionId((prev) => prev ?? data[data.length - 1].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleApprove = async (versionId: string) => {
    setApproving(true);
    try {
      const res = await fetch(
        `/api/requests/${requestId}/prd/versions/${versionId}/approve`,
        { method: "POST" }
      );
      if (!res.ok) {
        let errorMsg = "Failed to approve PRD";
        try {
          const data = await res.json();
          errorMsg = data.error || errorMsg;
        } catch {
          // Non-JSON error response (e.g. 500 HTML)
        }
        alert(errorMsg);
        return;
      }
      const data = await res.json();
      onStatusChange(data.status);
      await fetchVersions();
    } catch (err) {
      console.error("Approve PRD error:", err);
      alert("An unexpected error occurred while approving the PRD.");
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mt-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          Loading PRD...
        </div>
      </div>
    );
  }

  if (versions.length === 0) {
    return null;
  }

  const selectedVersion = versions.find((v) => v.id === selectedVersionId) ?? versions[versions.length - 1];
  const latestVersion = versions[versions.length - 1];
  const canApprove =
    isRequester &&
    (requestStatus === "PRD Generated" || requestStatus === "PRD Updated") &&
    selectedVersion.status === "Pending Approval" &&
    selectedVersion.id === latestVersion.id;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-4">
      {/* Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 hover:opacity-70 transition-opacity"
        >
          {collapsed ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronUp size={14} className="text-gray-400" />}
          <FileText size={16} className="text-primary-600" />
          <h3 className="text-sm font-semibold text-gray-700">
            Product Requirements Document
          </h3>
          {versions.length > 1 && (
            <span className="text-xs text-gray-400">
              ({versions.length} versions)
            </span>
          )}
        </button>

        <div className="flex items-center gap-2">
          {!collapsed && versions.length > 1 && (
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="flex items-center gap-1.5 text-xs text-gray-500 px-2.5 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <History size={12} />
              History
            </button>
          )}
          {!collapsed && (
            <button
              onClick={() => downloadPrd(selectedVersion.content, selectedVersion.version_number)}
              className="flex items-center gap-1.5 text-xs text-primary-600 px-2.5 py-1.5 rounded-lg hover:bg-primary-50 transition-colors"
            >
              <Download size={12} />
              Download
            </button>
          )}
          {canApprove && (
            <button
              onClick={() => handleApprove(selectedVersion.id)}
              disabled={approving}
              className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <CheckCircle2 size={12} />
              {approving ? "Approving…" : "Approve PRD"}
            </button>
          )}
          {selectedVersion.status === "Approved" && (
            <span className="flex items-center gap-1.5 text-xs bg-green-100 text-green-700 px-2.5 py-1.5 rounded-lg font-medium">
              <CheckCircle2 size={12} />
              Approved
            </span>
          )}
        </div>
      </div>

      {/* Version history sidebar (shown when toggled) */}
      {!collapsed && showHistory && versions.length > 1 && (
        <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Version History
          </p>
          <div className="flex flex-col gap-1">
            {[...versions].reverse().map((v) => {
              const badge = STATUS_BADGE[v.status];
              const isSelected = v.id === selectedVersionId;
              return (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersionId(v.id)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors text-xs ${
                    isSelected
                      ? "bg-primary-50 border border-primary-200"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <span className="font-medium text-gray-700">
                    Version {v.version_number}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">
                      {new Date(v.generated_at).toLocaleDateString()}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Version selector (compact, when multiple but history hidden) */}
      {!collapsed && versions.length > 1 && !showHistory && (
        <div className="px-5 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <span className="text-xs text-gray-400">Viewing:</span>
          <div className="relative">
            <select
              value={selectedVersionId ?? ""}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              className="text-xs text-gray-700 font-medium bg-white border border-gray-200 rounded-lg pl-2.5 pr-7 py-1.5 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              {[...versions].reverse().map((v) => (
                <option key={v.id} value={v.id}>
                  Version {v.version_number}{" "}
                  {v.status === "Approved" ? "✓" : v.status === "Pending Approval" ? "(pending)" : "(superseded)"}
                </option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>

          {selectedVersion.status === "Approved" && selectedVersion.approved_at && (
            <span className="text-xs text-gray-400">
              Approved {new Date(selectedVersion.approved_at).toLocaleDateString()}
              {selectedVersion.approved_by_name && ` by ${selectedVersion.approved_by_name}`}
            </span>
          )}
          {selectedVersion.status === "Pending Approval" && (
            <span className="flex items-center gap-1 text-xs text-yellow-600">
              <Clock size={11} />
              Pending business approval
            </span>
          )}
        </div>
      )}

      {/* Change summary (shown for v2+) */}
      {!collapsed && selectedVersion.change_summary && (
        <div className="px-5 py-4 border-b border-sky-100 bg-sky-50">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-sky-600" />
            <span className="text-xs font-semibold text-sky-700 uppercase tracking-wide">
              What Changed in Version {selectedVersion.version_number}
            </span>
          </div>
          <div className="text-sm prose-chat text-gray-700">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {selectedVersion.change_summary}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* PRD content */}
      {!collapsed && (
        <div className="px-5 py-5">
          <div className="text-sm prose-chat">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {selectedVersion.content.replace(/<!-- CLASSIFICATION:.*?-->/g, "").trim()}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Bottom approve banner for pending versions */}
      {!collapsed && canApprove && (
        <div className="px-5 py-3 bg-yellow-50 border-t border-yellow-100 flex items-center justify-between">
          <p className="text-xs text-yellow-700">
            {requestStatus === "PRD Updated"
              ? "This is an updated PRD incorporating Q&A insights. Please review and approve to proceed to Epic Planning."
              : "Please review the PRD above and approve to proceed to IS Review."}
          </p>
          <button
            onClick={() => handleApprove(selectedVersion.id)}
            disabled={approving}
            className="flex-shrink-0 flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium ml-4"
          >
            <CheckCircle2 size={12} />
            {approving ? "Approving…" : "Approve PRD"}
          </button>
        </div>
      )}
    </div>
  );
}
