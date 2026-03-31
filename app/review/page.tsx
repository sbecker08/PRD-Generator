import Link from "next/link";
import {
  FileText,
  ClipboardCheck,
  Clock,
  MessageSquare,
  LayoutDashboard,
} from "lucide-react";
import pool from "@/lib/db";
import { STATUS_COLORS, type RequestStatus } from "@/lib/status";
import { getCurrentUser, hasRole } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import UserMenu from "../components/user-menu";

type ReviewRow = {
  id: string;
  title: string;
  status: RequestStatus;
  classification: string | null;
  application_name: string | null;
  created_at: string;
  updated_at: string;
  requester_name: string | null;
  question_count: number;
  unanswered_count: number;
};

async function getReviewQueue(): Promise<ReviewRow[]> {
  const { rows } = await pool.query<ReviewRow>(`
    SELECT r.id, r.title, r.status, r.classification, r.application_name,
           r.created_at, r.updated_at,
           u.name AS requester_name,
           COUNT(q.id)::int AS question_count,
           COUNT(q.id) FILTER (WHERE q.sent_at IS NOT NULL AND q.answered_at IS NULL)::int AS unanswered_count
    FROM requests r
    LEFT JOIN users u ON u.id = r.created_by_user_id
    LEFT JOIN questions q ON q.request_id = r.id
    WHERE r.status IN ('Business Approved', 'IS Review', 'Q&A Sent')
    GROUP BY r.id, u.name
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

export default async function ReviewQueuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasRole(user, "IS Reviewer")) redirect("/");

  const requests = await getReviewQueue();

  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-yellow-500 flex items-center justify-center shadow-sm">
              <ClipboardCheck size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 leading-tight">
                IS Review Queue
              </h1>
              <p className="text-xs text-gray-500 leading-tight">
                Requests awaiting review
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

      <main className="px-4 py-8">
        <div className="max-w-3xl mx-auto">
          {requests.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-yellow-50 flex items-center justify-center mx-auto mb-4">
                <ClipboardCheck size={28} className="text-yellow-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-700 mb-2">
                No requests to review
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Requests will appear here once a business requester approves
                their PRD.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <Link
                  key={req.id}
                  href={`/${req.id}`}
                  className="block bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 hover:border-yellow-200 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-yellow-100 transition-colors">
                        <FileText size={14} className="text-yellow-600" />
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
                          {req.unanswered_count > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              {req.unanswered_count} unanswered
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          {req.requester_name && (
                            <span className="text-xs text-gray-400">
                              By {req.requester_name}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock size={11} />
                            {formatDate(req.updated_at)}
                          </span>
                          {req.question_count > 0 && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <MessageSquare size={11} />
                              {req.question_count}{" "}
                              {req.question_count === 1
                                ? "question"
                                : "questions"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs text-yellow-600 font-medium flex-shrink-0 mt-1 group-hover:text-yellow-700 transition-colors">
                      Review →
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
