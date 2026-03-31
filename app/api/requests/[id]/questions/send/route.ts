import { type NextRequest } from "next/server";
import pool from "@/lib/db";
import { transitionStatus } from "@/lib/status";
import { requireRole } from "@/lib/auth-utils";

/**
 * POST /api/requests/[id]/questions/send
 * Send all unsent draft questions to the business requester.
 * Transitions status: Business Approved → IS Review (if first time) then IS Review → Q&A Sent
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("IS Reviewer");
  if (user instanceof Response) return user;

  const { id } = await params;

  // Verify request exists and check current status
  const { rows: reqRows } = await pool.query<{ status: string }>(
    "SELECT status FROM requests WHERE id = $1",
    [id]
  );

  if (reqRows.length === 0) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  const currentStatus = reqRows[0].status;

  // Check there are unsent questions to send
  const { rows: unsent } = await pool.query<{ id: string }>(
    "SELECT id FROM questions WHERE request_id = $1 AND sent_at IS NULL",
    [id]
  );

  if (unsent.length === 0) {
    return Response.json({ error: "No draft questions to send" }, { status: 400 });
  }

  // Mark all unsent questions as sent
  await pool.query(
    "UPDATE questions SET sent_at = NOW() WHERE request_id = $1 AND sent_at IS NULL",
    [id]
  );

  // Handle status transitions
  try {
    if (currentStatus === "Business Approved") {
      // First review: Business Approved → IS Review → Q&A Sent
      await transitionStatus(id, "IS Review", user.id);
      await transitionStatus(id, "Q&A Sent", user.id);
    } else if (currentStatus === "IS Review") {
      // Subsequent rounds: IS Review → Q&A Sent
      await transitionStatus(id, "Q&A Sent", user.id);
    }
    // If already Q&A Sent (shouldn't happen normally), questions are just marked sent
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 400 });
  }

  return Response.json({ sent: unsent.length, status: "Q&A Sent" });
}
