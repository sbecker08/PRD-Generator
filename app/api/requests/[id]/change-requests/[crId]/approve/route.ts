import pool from "@/lib/db";
import { requireRole } from "@/lib/auth-utils";

/** POST /api/requests/[id]/change-requests/[crId]/approve — approve a submitted change request */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; crId: string }> }
) {
  const user = await requireRole("IS Engineer", req);
  if (user instanceof Response) return user;

  const { id, crId } = await params;

  const { rows: crs } = await pool.query(
    "SELECT id, status FROM change_requests WHERE id = $1 AND request_id = $2",
    [crId, id]
  );

  if (crs.length === 0) {
    return Response.json({ error: "Change request not found" }, { status: 404 });
  }

  if (crs[0].status !== "Submitted") {
    return Response.json(
      { error: "Only Submitted change requests can be approved" },
      { status: 400 }
    );
  }

  await pool.query(
    "UPDATE change_requests SET status = 'Approved', updated_at = NOW() WHERE id = $1",
    [crId]
  );

  return Response.json({ status: "Approved" });
}
