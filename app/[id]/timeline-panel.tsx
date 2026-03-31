"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  MessageSquare,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type TimelineEvent = {
  id: string;
  type: "status_change" | "epic_update" | "question_sent" | "question_answered" | "message";
  timestamp: string;
  data: Record<string, unknown>;
};

type TimelinePanelProps = {
  requestId: string;
};

const EVENT_ICONS: Record<string, { icon: typeof Clock; color: string }> = {
  status_change: { icon: ArrowRight, color: "text-blue-500" },
  epic_update: { icon: Layers, color: "text-purple-500" },
  question_sent: { icon: HelpCircle, color: "text-yellow-500" },
  question_answered: { icon: CheckCircle2, color: "text-green-500" },
  message: { icon: MessageSquare, color: "text-gray-400" },
};

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function EventDescription({ event }: { event: TimelineEvent }) {
  const { type, data } = event;

  switch (type) {
    case "status_change":
      return (
        <span>
          Status changed from{" "}
          <span className="font-medium">{data.from as string}</span> to{" "}
          <span className="font-medium">{data.to as string}</span>
          {data.actor ? (
            <span className="text-gray-400"> by {data.actor as string}</span>
          ) : null}
        </span>
      );
    case "epic_update":
      return (
        <span>
          Epic <span className="font-medium">{data.epicTitle as string}</span>{" "}
          — {data.reason as string}
        </span>
      );
    case "question_sent":
      return (
        <span>
          Question sent by{" "}
          <span className="font-medium">{data.askedBy as string}</span>:{" "}
          <span className="text-gray-500 italic">
            {(data.question as string).slice(0, 100)}
            {(data.question as string).length > 100 ? "..." : ""}
          </span>
        </span>
      );
    case "question_answered":
      return (
        <span>
          Question answered:{" "}
          <span className="text-gray-500 italic">
            {(data.answer as string).slice(0, 100)}
            {(data.answer as string).length > 100 ? "..." : ""}
          </span>
        </span>
      );
    case "message":
      return (
        <span>
          <span className="font-medium">
            {data.role === "user" ? "User" : "AI Assistant"}
          </span>
          :{" "}
          <span className="text-gray-500">
            {(data.preview as string).slice(0, 120)}
            {(data.preview as string).length > 120 ? "..." : ""}
          </span>
        </span>
      );
    default:
      return <span>Unknown event</span>;
  }
}

export default function TimelinePanel({ requestId }: TimelinePanelProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  const fetchTimeline = useCallback(async () => {
    try {
      const res = await fetch(`/api/requests/${requestId}/timeline`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  const filteredEvents =
    filter === "all"
      ? events
      : events.filter((e) => e.type === filter);

  // Show only the last 5 events when collapsed
  const displayEvents = expanded ? filteredEvents : filteredEvents.slice(-5);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mt-4">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          Loading timeline...
        </div>
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mt-4">
      {/* Header */}
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-700">
            Request Timeline
          </h3>
          <span className="text-xs text-gray-400">
            ({events.length} events)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-600"
          >
            <option value="all">All events</option>
            <option value="status_change">Status changes</option>
            <option value="epic_update">Epic updates</option>
            <option value="question_sent">Questions</option>
            <option value="message">Messages</option>
          </select>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-5 py-3">
        {!expanded && filteredEvents.length > 5 && (
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium mb-3 transition-colors"
          >
            <ChevronUp size={12} />
            Show {filteredEvents.length - 5} earlier events
          </button>
        )}

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-200" />

          <div className="space-y-3">
            {displayEvents.map((event) => {
              const config = EVENT_ICONS[event.type] || EVENT_ICONS.message;
              const Icon = config.icon;

              return (
                <div key={event.id} className="flex items-start gap-3 relative">
                  <div className={`w-6 h-6 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center flex-shrink-0 z-10`}>
                    <Icon size={11} className={config.color} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="text-xs text-gray-800 leading-relaxed">
                      <EventDescription event={event} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatTimestamp(event.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {expanded && filteredEvents.length > 5 && (
          <button
            onClick={() => setExpanded(false)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium mt-3 transition-colors"
          >
            <ChevronDown size={12} />
            Show fewer events
          </button>
        )}
      </div>
    </div>
  );
}
