import pool from "@/lib/db";
import { requireRole } from "@/lib/auth-utils";

export async function GET(req: Request) {
  const user = await requireRole("Admin", req);
  if (user instanceof Response) return user;

  const { rows } = await pool.query<{
    id: string;
    entra_id: string;
    name: string;
    email: string;
    created_at: string;
    roles: string[];
  }>(`
    SELECT u.id, u.entra_id, u.name, u.email, u.created_at,
           COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    GROUP BY u.id
    ORDER BY u.name ASC
  `);

  return Response.json(rows);
}
