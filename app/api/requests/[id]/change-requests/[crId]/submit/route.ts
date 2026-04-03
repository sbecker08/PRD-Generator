import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

/** POST /api/requests/[id]/change-requests/[crId]/submit — submit change request for approval */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; crId: string }> }
) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const { id, crId } = await params;

  const { rows: crs } = await pool.query(
    "SELECT id, status, created_by_user_id, summary FROM change_requests WHERE id = $1 AND request_id = $2",
    [crId, id]
  );

  if (crs.length === 0) {
    return Response.json({ error: "Change request not found" }, { status: 404 });
  }

  if (crs[0].status !== "Draft") {
    return Response.json(
      { error: "Only Draft change requests can be submitted" },
      { status: 400 }
    );
  }

  if (crs[0].created_by_user_id !== user.id) {
    return Response.json(
      { error: "Only the creator can submit this change request" },
      { status: 403 }
    );
  }

  if (!crs[0].summary) {
    return Response.json(
      { error: "Complete the change request conversation before submitting" },
      { status: 400 }
    );
  }

  await pool.query(
    "UPDATE change_requests SET status = 'Submitted', updated_at = NOW() WHERE id = $1",
    [crId]
  );

  return Response.json({ status: "Submitted" });
}
