"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  BarChart3,
  Clock,
  Layers,
  Filter,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import UserMenu from "../components/user-menu";
import PageHeader from "../components/page-header";

const STATUS_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  Draft: { bg: "bg-gray-100", text: "text-gray-600", bar: "bg-gray-400" },
  "PRD Generated": { bg: "bg-blue-100", text: "text-blue-700", bar: "bg-blue-500" },
  "Business Approved": { bg: "bg-green-100", text: "text-green-700", bar: "bg-green-500" },
  "IS Review": { bg: "bg-yellow-100", text: "text-yellow-700", bar: "bg-yellow-500" },
  "Q&A Sent": { bg: "bg-orange-100", text: "text-orange-700", bar: "bg-orange-500" },
  "Epic Planning": { bg: "bg-purple-100", text: "text-purple-700", bar: "bg-purple-500" },
  "In Progress": { bg: "bg-indigo-100", text: "text-indigo-700", bar: "bg-indigo-500" },
  Complete: { bg: "bg-emerald-100", text: "text-emerald-700", bar: "bg-emerald-500" },
};

const ALL_STATUSES = [
  "Draft", "PRD Generated", "Business Approved", "IS Review",
  "Q&A Sent", "Epic Planning", "In Progress", "Complete",
];

type StatusCount = { status: string; count: number };
type CycleTime = {
  from_status: string;
  to_status: string;
  avg_hours: number;
  min_hours: number;
  max_hours: number;
  transition_count: number;
};
type RequestRow = {
  id: string;
  title: string;
  status: string;
  classification: string | null;
  application_name: string | null;
  created_at: string;
  updated_at: string;
  total_hours: number | null;
  requester_name: string;
  requester_email: string;
  epic_total: number;
  epic_complete: number;
  epic_in_progress: number;
};
type Requester = { id: string; name: string; email: string };

type AnalyticsData = {
  statusCounts: StatusCount[];
  cycleTimes: CycleTime[];
  requests: RequestRow[];
  requesters: Requester[];
};

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  const days = Math.round((hours / 24) * 10) / 10;
  return `${days}d`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ReportingDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [classificationFilter, setClassificationFilter] = useState("");
  const [requesterFilter, setRequesterFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("overview");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    statusFilter.forEach((s) => params.append("status", s));
    if (classificationFilter) params.set("classification", classificationFilter);
    if (requesterFilter) params.set("requester", requesterFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);

    const res = await fetch(`/api/analytics?${params.toString()}`);
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, [statusFilter, classificationFilter, requesterFilter, dateFrom, dateTo, sortBy, sortDir]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleStatus = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setStatusFilter([]);
    setClassificationFilter("");
    setRequesterFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const hasFilters = statusFilter.length > 0 || classificationFilter || requesterFilter || dateFrom || dateTo;

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection((prev) => (prev === section ? null : section));
  };

  // Computed metrics
  const totalRequests = data?.statusCounts.reduce((sum, s) => sum + s.count, 0) ?? 0;
  const completedRequests = data?.statusCounts.find((s) => s.status === "Complete")?.count ?? 0;
  const inProgressRequests = data?.statusCounts.find((s) => s.status === "In Progress")?.count ?? 0;

  // Average total cycle time for completed requests
  const completedRows = data?.requests.filter((r) => r.status === "Complete") ?? [];
  const avgCompletionHours = completedRows.length > 0
    ? completedRows.reduce((sum, r) => sum + (r.total_hours ?? 0), 0) / completedRows.length
    : null;

  // Status distribution - max count for bar scaling
  const maxStatusCount = Math.max(...(data?.statusCounts.map((s) => s.count) ?? [1]));

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      {/* Header */}
      <PageHeader
        icon={<BarChart3 size={18} className="text-white" />}
        title="Reporting"
        subtitle="Pipeline overview & metrics"
        actions={
          <>
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

      <main className="px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <FileText size={14} />
                <span className="text-xs font-medium">Total Requests</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? "—" : totalRequests}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 text-indigo-600 mb-1">
                <TrendingUp size={14} />
                <span className="text-xs font-medium">In Progress</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? "—" : inProgressRequests}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 text-emerald-600 mb-1">
                <CheckCircle2 size={14} />
                <span className="text-xs font-medium">Completed</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? "—" : completedRequests}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center gap-2 text-orange-600 mb-1">
                <Clock size={14} />
                <span className="text-xs font-medium">Avg Completion</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {loading ? "—" : avgCompletionHours !== null ? formatHours(avgCompletionHours) : "N/A"}
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors rounded-xl"
            >
              <div className="flex items-center gap-2">
                <Filter size={14} />
                Filters
                {hasFilters && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-700">
                    Active
                  </span>
                )}
              </div>
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showFilters && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                {/* Status filter */}
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-2">Status</label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_STATUSES.map((status) => {
                      const colors = STATUS_COLORS[status];
                      const active = statusFilter.includes(status);
                      return (
                        <button
                          key={status}
                          onClick={() => toggleStatus(status)}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                            active
                              ? `${colors.bg} ${colors.text} ring-2 ring-offset-1 ring-current`
                              : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                          }`}
                        >
                          {status}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Classification + Requester row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Classification</label>
                    <select
                      value={classificationFilter}
                      onChange={(e) => setClassificationFilter(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                    >
                      <option value="">All</option>
                      <option value="New Application">New Application</option>
                      <option value="Feature Enhancement">Feature Enhancement</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Requester</label>
                    <select
                      value={requesterFilter}
                      onChange={(e) => setRequesterFilter(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                    >
                      <option value="">All</option>
                      {data?.requesters.map((r) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
                      />
                    </div>
                  </div>
                </div>

                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <X size={12} />
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Status Overview */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <button
              onClick={() => toggleSection("overview")}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors rounded-t-xl"
            >
              <div className="flex items-center gap-2">
                <BarChart3 size={14} className="text-primary-600" />
                Status Overview
              </div>
              {expandedSection === "overview" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedSection === "overview" && (
              <div className="border-t border-gray-100 px-5 py-4">
                {loading ? (
                  <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
                ) : (
                  <div className="space-y-3">
                    {ALL_STATUSES.map((status) => {
                      const count = data?.statusCounts.find((s) => s.status === status)?.count ?? 0;
                      const colors = STATUS_COLORS[status];
                      const pct = maxStatusCount > 0 ? (count / maxStatusCount) * 100 : 0;
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <span className={`text-xs font-medium w-32 text-right ${colors.text}`}>
                            {status}
                          </span>
                          <div className="flex-1 h-6 bg-gray-50 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${colors.bar} rounded-full transition-all duration-500`}
                              style={{ width: `${pct}%`, minWidth: count > 0 ? "24px" : "0" }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-gray-700 w-8 text-right">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cycle Times */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <button
              onClick={() => toggleSection("cycleTimes")}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors rounded-t-xl"
            >
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-orange-600" />
                Cycle Time Metrics
              </div>
              {expandedSection === "cycleTimes" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedSection === "cycleTimes" && (
              <div className="border-t border-gray-100 px-5 py-4">
                {loading ? (
                  <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
                ) : data?.cycleTimes.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle size={20} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">
                      No cycle time data yet. Transition data is recorded as requests move through statuses.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Transition</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">Avg</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">Min</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">Max</th>
                          <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.cycleTimes.map((ct, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-2 px-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[ct.from_status]?.bg ?? "bg-gray-100"} ${STATUS_COLORS[ct.from_status]?.text ?? "text-gray-600"}`}>
                                {ct.from_status}
                              </span>
                              <span className="mx-1.5 text-gray-400">→</span>
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[ct.to_status]?.bg ?? "bg-gray-100"} ${STATUS_COLORS[ct.to_status]?.text ?? "text-gray-600"}`}>
                                {ct.to_status}
                              </span>
                            </td>
                            <td className="text-right py-2 px-2 font-semibold text-gray-700">{formatHours(ct.avg_hours)}</td>
                            <td className="text-right py-2 px-2 text-gray-500">{formatHours(ct.min_hours)}</td>
                            <td className="text-right py-2 px-2 text-gray-500">{formatHours(ct.max_hours)}</td>
                            <td className="text-right py-2 px-2 text-gray-500">{ct.transition_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Request List with Epic Progress */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <button
              onClick={() => toggleSection("requests")}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors rounded-t-xl"
            >
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-purple-600" />
                All Requests
                {!loading && (
                  <span className="text-xs font-normal text-gray-400">
                    ({data?.requests.length ?? 0})
                  </span>
                )}
              </div>
              {expandedSection === "requests" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expandedSection === "requests" && (
              <div className="border-t border-gray-100">
                {loading ? (
                  <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>
                ) : data?.requests.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle size={20} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-400">No requests match the current filters.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/50">
                          <th className="text-left py-2 px-4">
                            <button onClick={() => toggleSort("title")} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">
                              Title <ArrowUpDown size={10} />
                            </button>
                          </th>
                          <th className="text-left py-2 px-2">
                            <button onClick={() => toggleSort("status")} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700">
                              Status <ArrowUpDown size={10} />
                            </button>
                          </th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Requester</th>
                          <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Classification</th>
                          <th className="text-center py-2 px-2 text-xs font-medium text-gray-500">Epics</th>
                          <th className="text-right py-2 px-2">
                            <button onClick={() => toggleSort("total_hours")} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 ml-auto">
                              Age <ArrowUpDown size={10} />
                            </button>
                          </th>
                          <th className="text-right py-2 px-4">
                            <button onClick={() => toggleSort("updated_at")} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 ml-auto">
                              Updated <ArrowUpDown size={10} />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.requests.map((r) => {
                          const colors = STATUS_COLORS[r.status] ?? STATUS_COLORS.Draft;
                          const epicPct = r.epic_total > 0
                            ? Math.round((r.epic_complete / r.epic_total) * 100)
                            : null;
                          return (
                            <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                              <td className="py-2.5 px-4">
                                <Link href={`/${r.id}`} className="text-sm font-medium text-primary-700 hover:text-primary-800 hover:underline truncate block max-w-[200px]">
                                  {r.title}
                                </Link>
                              </td>
                              <td className="py-2.5 px-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                                  {r.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-xs text-gray-600 truncate max-w-[120px]">
                                {r.requester_name}
                              </td>
                              <td className="py-2.5 px-2">
                                {r.classification && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                    {r.classification}
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-center">
                                {r.epic_total > 0 ? (
                                  <div className="flex items-center gap-1.5 justify-center">
                                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                        style={{ width: `${epicPct}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-gray-500">
                                      {r.epic_complete}/{r.epic_total}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-300">—</span>
                                )}
                              </td>
                              <td className="py-2.5 px-2 text-right text-xs text-gray-500">
                                {r.total_hours !== null ? formatHours(r.total_hours) : "—"}
                              </td>
                              <td className="py-2.5 px-4 text-right text-xs text-gray-400">
                                {formatDate(r.updated_at)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
