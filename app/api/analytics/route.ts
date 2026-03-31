import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";
import type { RequestStatus } from "@/lib/status";

type StatusCount = { status: RequestStatus; count: number };
type CycleTimeRow = {
  from_status: RequestStatus;
  to_status: RequestStatus;
  avg_hours: number;
  min_hours: number;
  max_hours: number;
  transition_count: number;
};
type RequestCycleRow = {
  id: string;
  title: string;
  status: RequestStatus;
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

export async function GET(req: Request) {
  const user = await requireAuth();
  if (user instanceof Response) return user;

  const url = new URL(req.url);
  const statusFilter = url.searchParams.getAll("status");
  const classificationFilter = url.searchParams.get("classification");
  const requesterFilter = url.searchParams.get("requester");
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  const sortBy = url.searchParams.get("sortBy") || "updated_at";
  const sortDir = url.searchParams.get("sortDir") === "asc" ? "ASC" : "DESC";

  // Build WHERE clause for request filters
  const conditions: string[] = [];
  const params: (string | string[])[] = [];
  let paramIdx = 1;

  if (statusFilter.length > 0) {
    conditions.push(`r.status = ANY($${paramIdx}::text[])`);
    params.push(statusFilter);
    paramIdx++;
  }
  if (classificationFilter) {
    conditions.push(`r.classification = $${paramIdx}`);
    params.push(classificationFilter);
    paramIdx++;
  }
  if (requesterFilter) {
    conditions.push(`u.id = $${paramIdx}`);
    params.push(requesterFilter);
    paramIdx++;
  }
  if (dateFrom) {
    conditions.push(`r.created_at >= $${paramIdx}::timestamptz`);
    params.push(dateFrom);
    paramIdx++;
  }
  if (dateTo) {
    conditions.push(`r.created_at <= $${paramIdx}::timestamptz`);
    params.push(dateTo);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Validate sort column
  const validSorts = ["updated_at", "created_at", "title", "status", "total_hours"];
  const safeSort = validSorts.includes(sortBy) ? sortBy : "updated_at";
  const sortExpression = safeSort === "total_hours"
    ? `EXTRACT(EPOCH FROM (r.updated_at - r.created_at))/3600`
    : `r.${safeSort}`;

  // 1. Status counts (respecting filters)
  const statusCountsQuery = `
    SELECT r.status, COUNT(*)::int AS count
    FROM requests r
    LEFT JOIN users u ON u.id = r.created_by_user_id
    ${whereClause}
    GROUP BY r.status
    ORDER BY r.status
  `;

  // 2. Average cycle times between statuses (global, not filtered)
  const cycleTimesQuery = `
    SELECT
      sh.from_status,
      sh.to_status,
      ROUND(AVG(EXTRACT(EPOCH FROM (sh.changed_at - prev.changed_at)) / 3600)::numeric, 1) AS avg_hours,
      ROUND(MIN(EXTRACT(EPOCH FROM (sh.changed_at - prev.changed_at)) / 3600)::numeric, 1) AS min_hours,
      ROUND(MAX(EXTRACT(EPOCH FROM (sh.changed_at - prev.changed_at)) / 3600)::numeric, 1) AS max_hours,
      COUNT(*)::int AS transition_count
    FROM status_history sh
    JOIN LATERAL (
      SELECT changed_at FROM status_history prev
      WHERE prev.request_id = sh.request_id
        AND prev.to_status = sh.from_status
        AND prev.changed_at < sh.changed_at
      ORDER BY prev.changed_at DESC
      LIMIT 1
    ) prev ON true
    WHERE sh.from_status IS NOT NULL
    GROUP BY sh.from_status, sh.to_status
    ORDER BY sh.from_status, sh.to_status
  `;

  // 3. Requests with epic progress and cycle time (filtered)
  const requestsQuery = `
    SELECT
      r.id, r.title, r.status, r.classification, r.application_name,
      r.created_at, r.updated_at,
      ROUND(EXTRACT(EPOCH FROM (r.updated_at - r.created_at)) / 3600, 1) AS total_hours,
      COALESCE(u.name, 'Unknown') AS requester_name,
      COALESCE(u.email, '') AS requester_email,
      COALESCE(e.epic_total, 0)::int AS epic_total,
      COALESCE(e.epic_complete, 0)::int AS epic_complete,
      COALESCE(e.epic_in_progress, 0)::int AS epic_in_progress
    FROM requests r
    LEFT JOIN users u ON u.id = r.created_by_user_id
    LEFT JOIN (
      SELECT request_id,
        COUNT(*)::int AS epic_total,
        COUNT(*) FILTER (WHERE status = 'Complete')::int AS epic_complete,
        COUNT(*) FILTER (WHERE status = 'In Progress')::int AS epic_in_progress
      FROM epics
      GROUP BY request_id
    ) e ON e.request_id = r.id
    ${whereClause}
    ORDER BY ${sortExpression} ${sortDir}
  `;

  // 4. List of requesters for filter dropdown
  const requestersQuery = `
    SELECT DISTINCT u.id, u.name, u.email
    FROM users u
    JOIN requests r ON r.created_by_user_id = u.id
    ORDER BY u.name
  `;

  const [statusCounts, cycleTimes, requests, requesters] = await Promise.all([
    pool.query<StatusCount>(statusCountsQuery, params),
    pool.query<CycleTimeRow>(cycleTimesQuery),
    pool.query<RequestCycleRow>(requestsQuery, params),
    pool.query<{ id: string; name: string; email: string }>(requestersQuery),
  ]);

  return Response.json({
    statusCounts: statusCounts.rows,
    cycleTimes: cycleTimes.rows,
    requests: requests.rows,
    requesters: requesters.rows,
  });
}
