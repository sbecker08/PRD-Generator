import { type NextRequest } from "next/server";
import pool from "@/lib/db";
import { transitionStatus } from "@/lib/status";
import { requireAuth } from "@/lib/auth-utils";

/**
 * POST /api/requests/[id]/approve
 * Business Requester approves the PRD, transitioning from "PRD Generated" → "Business Approved".
 * Accepts an optional prd_version_id body param to tie the approval to a specific PRD version.
 * If no prd_version_id is provided, looks for the latest Pending Approval version.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const { id } = await params;

  // Verify the request exists and the current user is the original requester
  const { rows } = await pool.query<{ created_by_user_id: string | null; status: string }>(
    "SELECT created_by_user_id, status FROM requests WHERE id = $1",
    [id]
  );

  if (rows.length === 0) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  if (rows[0].created_by_user_id !== user.id) {
    return Response.json(
      { error: "Only the original requester can approve the PRD" },
      { status: 403 }
    );
  }

  // Read optional prd_version_id from body
  let prdVersionId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    prdVersionId = body?.prd_version_id ?? null;
  } catch {
    // No body — that's fine
  }

  // If no version id provided, find the latest Pending Approval version
  if (!prdVersionId) {
    const { rows: vRows } = await pool.query<{ id: string }>(
      `SELECT id FROM prd_versions
       WHERE request_id = $1 AND status = 'Pending Approval'
       ORDER BY version_number DESC LIMIT 1`,
      [id]
    );
    prdVersionId = vRows[0]?.id ?? null;
  }

  // Approve the version (if one exists)
  if (prdVersionId) {
    await pool.query(
      `UPDATE prd_versions
       SET status = 'Approved', approved_by_user_id = $1, approved_at = NOW()
       WHERE id = $2`,
      [user.id, prdVersionId]
    );
    await pool.query(
      "UPDATE requests SET approved_prd_version_id = $1, updated_at = NOW() WHERE id = $2",
      [prdVersionId, id]
    );
  }

  try {
    const newStatus = await transitionStatus(id, "Business Approved", user.id);
    return Response.json({ status: newStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 400 });
  }
}
