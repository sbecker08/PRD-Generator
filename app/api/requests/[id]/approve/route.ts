import { type NextRequest } from "next/server";
import pool from "@/lib/db";
import { transitionStatus } from "@/lib/status";
import { requireAuth } from "@/lib/auth-utils";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
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

  try {
    const newStatus = await transitionStatus(id, "Business Approved", user.id);
    return Response.json({ status: newStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 400 });
  }
}
