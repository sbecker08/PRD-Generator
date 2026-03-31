import Link from "next/link";
import { FileText, MessageSquare, Plus, Clock } from "lucide-react";
import pool from "@/lib/db";

type RequestRow = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
};

async function getRequests(): Promise<RequestRow[]> {
  const { rows } = await pool.query<RequestRow>(`
    SELECT r.id, r.title, r.created_at, r.updated_at, COUNT(m.id)::int AS message_count
    FROM requests r
    LEFT JOIN messages m ON m.request_id = r.id
    GROUP BY r.id
    ORDER BY r.updated_at DESC
  `);
  return rows;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const requests = await getRequests();

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
              <FileText size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 leading-tight">
                PRD Bot
              </h1>
              <p className="text-xs text-gray-500 leading-tight">My Requests</p>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
          >
            <Plus size={14} />
            New Request
          </Link>
        </div>
      </header>

      <main className="px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {requests.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                <FileText size={28} className="text-indigo-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-700 mb-2">
                No requests yet
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Start a conversation with PRD-Bot to create your first product
                requirements document.
              </p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
              >
                <Plus size={14} />
                Start a request
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <Link
                  key={req.id}
                  href={`/dashboard/${req.id}`}
                  className="block bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 hover:border-indigo-200 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-indigo-100 transition-colors">
                        <FileText size={14} className="text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {req.title}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock size={11} />
                            {formatDate(req.updated_at)}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <MessageSquare size={11} />
                            {req.message_count}{" "}
                            {req.message_count === 1 ? "message" : "messages"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-indigo-500 font-medium flex-shrink-0 mt-1 group-hover:text-indigo-700 transition-colors">
                      View →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
