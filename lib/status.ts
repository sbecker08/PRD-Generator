import pool from "./db";

export type RequestStatus =
  | "Draft"
  | "PRD Generated"
  | "Business Approved"
  | "IS Review"
  | "Q&A Sent"
  | "Epic Planning"
  | "In Progress"
  | "Complete";

/**
 * Valid status transitions. Each key maps to the set of statuses it can move to.
 *
 * BR-002: Business Approved can only follow PRD Generated
 * BR-005: Epic Planning follows IS Review completion
 * BR-006: In Progress follows approved epic breakdown
 */
const VALID_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  Draft: ["PRD Generated"],
  "PRD Generated": ["Business Approved"],
  "Business Approved": ["IS Review"],
  "IS Review": ["Q&A Sent", "Epic Planning"],
  "Q&A Sent": ["IS Review"],
  "Epic Planning": ["In Progress"],
  "In Progress": ["Complete"],
  Complete: [],
};

export function canTransition(
  from: RequestStatus,
  to: RequestStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Transition a request to a new status.
 * Validates the transition, updates the request, and logs to status_history.
 * Returns the new status on success, throws on invalid transition.
 */
export async function transitionStatus(
  requestId: string,
  toStatus: RequestStatus,
  changedByUserId?: string
): Promise<RequestStatus> {
  const { rows } = await pool.query<{ status: RequestStatus }>(
    "SELECT status FROM requests WHERE id = $1",
    [requestId]
  );

  if (rows.length === 0) {
    throw new Error(`Request ${requestId} not found`);
  }

  const fromStatus = rows[0].status;

  if (!canTransition(fromStatus, toStatus)) {
    throw new Error(
      `Invalid status transition: "${fromStatus}" → "${toStatus}"`
    );
  }

  await pool.query(
    `UPDATE requests SET status = $1, updated_at = NOW() WHERE id = $2`,
    [toStatus, requestId]
  );

  await pool.query(
    `INSERT INTO status_history (request_id, from_status, to_status, changed_by_user_id) VALUES ($1, $2, $3, $4)`,
    [requestId, fromStatus, toStatus, changedByUserId ?? null]
  );

  return toStatus;
}

/** Status badge color mapping for the UI */
export const STATUS_COLORS: Record<RequestStatus, { bg: string; text: string }> = {
  Draft: { bg: "bg-gray-100", text: "text-gray-600" },
  "PRD Generated": { bg: "bg-blue-100", text: "text-blue-700" },
  "Business Approved": { bg: "bg-green-100", text: "text-green-700" },
  "IS Review": { bg: "bg-yellow-100", text: "text-yellow-700" },
  "Q&A Sent": { bg: "bg-orange-100", text: "text-orange-700" },
  "Epic Planning": { bg: "bg-purple-100", text: "text-purple-700" },
  "In Progress": { bg: "bg-indigo-100", text: "text-indigo-700" },
  Complete: { bg: "bg-emerald-100", text: "text-emerald-700" },
};
