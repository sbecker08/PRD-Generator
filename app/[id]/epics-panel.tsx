"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Trophy,
} from "lucide-react";

type Epic = {
  id: string;
  request_id: string;
  title: string;
  description: string | null;
  status: string;
  version: number;
  created_at: string;
  updated_at: string;
};

type DraftEpic = {
  tempId: string;
  title: string;
  description: string;
};

type EpicsPanelProps = {
  requestId: string;
  requestStatus: string;
  isEngineer: boolean;
  onStatusChange: (newStatus: string) => void;
};

const EPIC_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  "Not Started": { bg: "bg-gray-100", text: "text-gray-600" },
  "In Progress": { bg: "bg-indigo-100", text: "text-indigo-700" },
  Complete: { bg: "bg-emerald-100", text: "text-emerald-700" },
};

const EPIC_STATUSES = ["Not Started", "In Progress", "Complete"] as const;

export default function EpicsPanel({
  requestId,
  requestStatus,
  isEngineer,
  onStatusChange,
}: EpicsPanelProps) {
  const [epics, setEpics] = useState<Epic[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addingNew, setAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const isPlanning = requestStatus === "Epic Planning";
  const isInProgress = requestStatus === "In Progress";
  const canUpdateStatus = isEngineer && isInProgress;

  const fetchEpics = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${requestId}/epics`);
      if (res.ok) {
        const data = await res.json();
        setEpics(data);
      }
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchEpics();
  }, [fetchEpics]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const generateEpics = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/epics/generate`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to generate epics");
        return;
      }

      const data = await res.json();

      // Delete existing epics before inserting the new set
      for (const epic of epics) {
        await fetch(`/api/requests/${requestId}/epics`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ epicId: epic.id }),
        });
      }

      for (const epic of data.epics) {
        await fetch(`/api/requests/${requestId}/epics`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: epic.title,
            description: epic.description,
          }),
        });
      }

      fetchEpics();
      setExpandedIds(new Set(data.epics.map((_: unknown, i: number) => `expanded-${i}`)));
    } finally {
      setGenerating(false);
    }
  };

  const addEpic = async () => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;

    const res = await fetch(`/api/requests/${requestId}/epics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: trimmedTitle,
        description: newDescription.trim(),
      }),
    });

    if (res.ok) {
      setNewTitle("");
      setNewDescription("");
      setAddingNew(false);
      fetchEpics();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to add epic");
    }
  };

  const startEdit = (epic: Epic) => {
    setEditingId(epic.id);
    setEditTitle(epic.title);
    setEditDescription(epic.description || "");
  };

  const saveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;

    const res = await fetch(`/api/requests/${requestId}/epics`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        epicId: editingId,
        title: editTitle.trim(),
        description: editDescription.trim(),
      }),
    });

    if (res.ok) {
      setEditingId(null);
      fetchEpics();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to update epic");
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
  };

  const deleteEpic = async (epicId: string) => {
    const res = await fetch(`/api/requests/${requestId}/epics`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ epicId }),
    });

    if (res.ok) {
      fetchEpics();
    }
  };

  const approveEpics = async () => {
    if (epics.length === 0) {
      alert("No epics to approve. Generate or add epics first.");
      return;
    }

    setApproving(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/epics/approve`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        onStatusChange(data.status);
        fetchEpics();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to approve epic breakdown");
      }
    } finally {
      setApproving(false);
    }
  };

  const updateEpicStatus = async (epicId: string, newStatus: string) => {
    setUpdatingStatusId(epicId);
    try {
      const res = await fetch(
        `/api/requests/${requestId}/epics/${epicId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (res.ok) {
        fetchEpics();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to update epic status");
      }
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const markRequestComplete = async () => {
    setCompleting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/complete`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        onStatusChange(data.status);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to mark request as complete");
      }
    } finally {
      setCompleting(false);
    }
  };

  const completedCount = epics.filter((e) => e.status === "Complete").length;
  const inProgressCount = epics.filter((e) => e.status === "In Progress").length;
  const allComplete = epics.length > 0 && completedCount === epics.length;
  const progressPercent = epics.length > 0 ? Math.round((completedCount / epics.length) * 100) : 0;

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mt-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          Loading epics...
        </div>
      </div>
    );
  }

  if (epics.length === 0 && !isPlanning) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-4">
      {/* Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-purple-600" />
          <h3 className="text-sm font-semibold text-gray-700">
            Epic Breakdown
          </h3>
          {epics.length > 0 && (
            <span className="text-xs text-gray-400">
              ({completedCount} of {epics.length} complete)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPlanning && isEngineer && (
            <>
              {epics.length === 0 && (
                <button
                  onClick={generateEpics}
                  disabled={generating}
                  className="flex items-center gap-1.5 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <Sparkles size={12} />
                  {generating ? "Generating..." : "Generate Epics"}
                </button>
              )}
              {epics.length > 0 && (
                <>
                  <button
                    onClick={generateEpics}
                    disabled={generating}
                    className="flex items-center gap-1.5 text-xs text-purple-600 px-3 py-1.5 rounded-lg hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    <Sparkles size={12} />
                    {generating ? "Regenerating..." : "Regenerate"}
                  </button>
                  <button
                    onClick={approveEpics}
                    disabled={approving}
                    className="flex items-center gap-1.5 text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    <CheckCircle2 size={12} />
                    {approving ? "Approving..." : "Approve Epic Breakdown"}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Progress bar — shown when In Progress or Complete */}
      {(isInProgress || requestStatus === "Complete") && epics.length > 0 && (
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500 font-medium">
              Build Progress
            </span>
            <span className="text-xs font-semibold text-gray-700">
              {progressPercent}%
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${
                allComplete ? "bg-emerald-500" : "bg-indigo-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-400">
            <span>{completedCount} complete</span>
            <span>{inProgressCount} in progress</span>
            <span>{epics.length - completedCount - inProgressCount} not started</span>
          </div>
        </div>
      )}

      {/* Generating spinner */}
      {generating && (
        <div className="px-5 py-8 text-center">
          <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            AI is analyzing the PRD and generating epic suggestions...
          </p>
        </div>
      )}

      {/* Epic list */}
      {!generating && (
        <div className="divide-y divide-gray-50">
          {epics.map((epic, index) => {
            const isExpanded = expandedIds.has(epic.id);
            const isEditing = editingId === epic.id;
            const colors = EPIC_STATUS_COLORS[epic.status] || EPIC_STATUS_COLORS["Not Started"];
            const isUpdating = updatingStatusId === epic.id;

            return (
              <div key={epic.id} className="px-5 py-3">
                {isEditing ? (
                  /* Edit mode */
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                      placeholder="Epic title"
                    />
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent resize-none"
                      placeholder="Epic description..."
                    />
                    <div className="flex items-center gap-2">
                      <button
                        onClick={saveEdit}
                        disabled={!editTitle.trim()}
                        className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium"
                      >
                        <Check size={11} />
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex items-center gap-1 text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <X size={11} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleExpand(epic.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp size={14} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                      <span className="text-xs text-gray-400 font-mono w-6">
                        {index + 1}.
                      </span>
                      <span className="text-sm font-medium text-gray-800 flex-1">
                        {epic.title}
                      </span>

                      {/* Status control — dropdown for IS Engineer during In Progress, badge otherwise */}
                      {canUpdateStatus ? (
                        <select
                          value={epic.status}
                          onChange={(e) => updateEpicStatus(epic.id, e.target.value)}
                          disabled={isUpdating}
                          className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400 ${colors.bg} ${colors.text} ${isUpdating ? "opacity-50" : ""}`}
                        >
                          {EPIC_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} font-medium`}
                        >
                          {epic.status}
                        </span>
                      )}

                      {isPlanning && isEngineer && (
                        <>
                          <button
                            onClick={() => startEdit(epic)}
                            className="text-gray-400 hover:text-purple-600 transition-colors"
                            title="Edit epic"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => deleteEpic(epic.id)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Remove epic"
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                    {isExpanded && epic.description && (
                      <div className="ml-12 mt-2 text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 rounded-lg px-4 py-3">
                        {epic.description}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty state */}
          {epics.length === 0 && !generating && (
            <div className="px-5 py-8 text-center">
              <Layers size={24} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">
                No epics yet.
                {isPlanning && isEngineer &&
                  " Click \"Generate Epics\" to have AI break down the PRD, or add epics manually."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Add new epic — IS Engineer only, during planning */}
      {isPlanning && isEngineer && !generating && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
          {addingNew ? (
            <div className="space-y-2">
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent bg-white"
                placeholder="Epic title"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    addEpic();
                  }
                }}
              />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent resize-none bg-white"
                placeholder="Epic description (optional)"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={addEpic}
                  disabled={!newTitle.trim()}
                  className="flex items-center gap-1 text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium"
                >
                  <Plus size={11} />
                  Add Epic
                </button>
                <button
                  onClick={() => {
                    setAddingNew(false);
                    setNewTitle("");
                    setNewDescription("");
                  }}
                  className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingNew(true)}
              className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium transition-colors"
            >
              <Plus size={13} />
              Add epic manually
            </button>
          )}
        </div>
      )}

      {/* Completion prompt — all epics complete, IS Engineer can mark request as Complete */}
      {allComplete && isInProgress && isEngineer && (
        <div className="px-5 py-4 bg-emerald-50 border-t border-emerald-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={16} className="text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">
                All epics are complete!
              </span>
            </div>
            <button
              onClick={markRequestComplete}
              disabled={completing}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <CheckCircle2 size={12} />
              {completing ? "Completing..." : "Mark Request as Complete"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
