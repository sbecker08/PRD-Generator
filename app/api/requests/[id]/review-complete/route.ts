import { type NextRequest } from "next/server";
import pool from "@/lib/db";
import { transitionStatus } from "@/lib/status";
import { requireRole } from "@/lib/auth-utils";

/**
 * POST /api/requests/[id]/review-complete
 * IS Reviewer marks the review as complete, transitioning to Epic Planning.
 * Requires the request to be in "IS Review" status (all questions answered).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("IS Reviewer", req);
  if (user instanceof Response) return user;

  const { id } = await params;

  // Verify no unanswered sent questions remain
  const { rows: unanswered } = await pool.query(
    `SELECT id FROM questions
     WHERE request_id = $1 AND sent_at IS NOT NULL AND answered_at IS NULL`,
    [id]
  );

  if (unanswered.length > 0) {
    return Response.json(
      { error: "All sent questions must be answered before completing review" },
      { status: 400 }
    );
  }

  try {
    const newStatus = await transitionStatus(id, "Epic Planning", user.id);
    return Response.json({ status: newStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 400 });
  }
}
