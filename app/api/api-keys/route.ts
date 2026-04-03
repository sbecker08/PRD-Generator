import pool from "@/lib/db";
import { generateApiKey, requireAuth } from "@/lib/auth-utils";

/** List all active API keys for the current user */
export async function GET(req: Request) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const { rows } = await pool.query(
    `SELECT id, name, key_prefix, created_at, last_used_at
     FROM api_keys
     WHERE user_id = $1 AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    [user.id]
  );

  return Response.json(rows);
}

/** Create a new API key for the current user */
export async function POST(req: Request) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const { name } = await req.json();
  if (!name?.trim()) {
    return Response.json({ error: "name is required" }, { status: 400 });
  }

  const { raw, hash, prefix } = generateApiKey();

  const { rows } = await pool.query(
    `INSERT INTO api_keys (user_id, name, key_hash, key_prefix)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, key_prefix, created_at`,
    [user.id, name.trim(), hash, prefix]
  );

  // Return the raw key only once — it cannot be retrieved again
  return Response.json({ ...rows[0], key: raw }, { status: 201 });
}
