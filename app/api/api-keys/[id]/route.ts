import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

/** Revoke an API key by id (must belong to the current user) */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const { id } = await params;

  const { rowCount } = await pool.query(
    `UPDATE api_keys SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [id, user.id]
  );

  if (rowCount === 0) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
