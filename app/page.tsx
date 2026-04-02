import Link from "next/link";
import { FileText, MessageSquare, Plus, Clock, ClipboardCheck, BarChart3 } from "lucide-react";
import pool from "@/lib/db";
import { STATUS_COLORS, type RequestStatus } from "@/lib/status";
import { getCurrentUser, hasRole } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import UserMenu from "./components/user-menu";
import PageHeader from "./components/page-header";

type RequestRow = {
  id: string;
  title: string;
  status: RequestStatus;
  classification: string | null;
  application_name: string | null;
  created_at: string;
  updated_at: string;
  message_count: number;
};

async function getRequests(): Promise<RequestRow[]> {
  const { rows } = await pool.query<RequestRow>(`
    SELECT r.id, r.title, r.status, r.classification, r.application_name,
           r.created_at, r.updated_at, COUNT(m.id)::int AS message_count
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
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const requests = await getRequests();

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <PageHeader
        icon={<FileText size={18} className="text-white" />}
        title="Product Intake"
        subtitle="My Requests"
        actions={
          <>
            <Link
              href="/reporting"
              className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              <BarChart3 size={14} />
              Reporting
            </Link>
            {hasRole(user, "IS Reviewer") && (
              <Link
                href="/review"
                className="flex items-center gap-1.5 text-sm text-yellow-700 bg-yellow-50 px-3 py-1.5 rounded-lg hover:bg-yellow-100 transition-colors font-medium"
              >
                <ClipboardCheck size={14} />
                IS Review
              </Link>
            )}
            <Link
              href="/chat"
              className="flex items-center gap-1.5 text-sm bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 transition-colors font-medium shadow-sm"
            >
              <Plus size={14} />
              New Request
            </Link>
            <UserMenu />
          </>
        }
      />

      <main className="px-4 py-8">
        <div className="max-w-5xl mx-auto">
          {requests.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <FileText size={28} className="text-primary-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-700 mb-2">
                No requests yet
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Start a conversation with Product Intake to create your first product
                requirements document.
              </p>
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
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
                  href={`/${req.id}`}
                  className="block bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 hover:border-primary-200 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-primary-100 transition-colors">
                        <FileText size={14} className="text-primary-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {req.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[req.status].bg} ${STATUS_COLORS[req.status].text}`}
                          >
                            {req.status}
                          </span>
                          {req.classification && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                              {req.classification}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
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
                    <span className="text-xs text-primary-500 font-medium flex-shrink-0 mt-1 group-hover:text-primary-700 transition-colors">
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
