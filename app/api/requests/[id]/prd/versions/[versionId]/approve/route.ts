import { type NextRequest } from "next/server";
import pool from "@/lib/db";
import { transitionStatus } from "@/lib/status";
import { requireAuth } from "@/lib/auth-utils";

/**
 * POST /api/requests/[id]/prd/versions/[versionId]/approve
 * Business Requester approves a specific PRD version.
 *
 * - If request is "PRD Generated": approves v1, transitions → "Business Approved"
 * - If request is "PRD Updated": approves the updated version, transitions → "Epic Planning"
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const { id, versionId } = await params;

  // Verify ownership and current status
  const { rows: reqRows } = await pool.query<{
    created_by_user_id: string | null;
    status: string;
  }>(
    "SELECT created_by_user_id, status FROM requests WHERE id = $1",
    [id]
  );

  if (reqRows.length === 0) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  if (reqRows[0].created_by_user_id !== user.id) {
    return Response.json(
      { error: "Only the original requester can approve the PRD" },
      { status: 403 }
    );
  }

  const { status } = reqRows[0];
  if (status !== "PRD Generated" && status !== "PRD Updated") {
    return Response.json(
      { error: "PRD can only be approved when status is 'PRD Generated' or 'PRD Updated'" },
      { status: 400 }
    );
  }

  // Verify the version belongs to this request and is pending
  const { rows: versionRows } = await pool.query<{
    id: string;
    status: string;
    version_number: number;
  }>(
    "SELECT id, status, version_number FROM prd_versions WHERE id = $1 AND request_id = $2",
    [versionId, id]
  );

  if (versionRows.length === 0) {
    return Response.json(
      { error: "PRD version not found for this request" },
      { status: 404 }
    );
  }

  if (versionRows[0].status !== "Pending Approval") {
    return Response.json(
      { error: "This PRD version has already been approved or superseded" },
      { status: 400 }
    );
  }

  // Mark this version as approved and record on the request
  await pool.query(
    `UPDATE prd_versions
     SET status = 'Approved', approved_by_user_id = $1, approved_at = NOW()
     WHERE id = $2`,
    [user.id, versionId]
  );

  await pool.query(
    "UPDATE requests SET approved_prd_version_id = $1, updated_at = NOW() WHERE id = $2",
    [versionId, id]
  );

  // Transition status
  const nextStatus = status === "PRD Generated" ? "Business Approved" : "Epic Planning";

  try {
    const newStatus = await transitionStatus(id, nextStatus, user.id);
    return Response.json({
      status: newStatus,
      approved_version_number: versionRows[0].version_number,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 400 });
  }
}
