import { type NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

export async function GET() {
  const user = await requireAuth();
  if (user instanceof Response) return user;

  const { rows } = await pool.query<{
    id: string;
    title: string;
    status: string;
    classification: string | null;
    application_name: string | null;
    created_at: string;
    updated_at: string;
    message_count: string;
  }>(`
    SELECT r.id, r.title, r.status, r.classification, r.application_name,
           r.created_at, r.updated_at, COUNT(m.id)::int AS message_count
    FROM requests r
    LEFT JOIN messages m ON m.request_id = r.id
    GROUP BY r.id
    ORDER BY r.updated_at DESC
  `);
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (user instanceof Response) return user;

  const { title }: { title: string } = await req.json();
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO requests (title, status, created_by_user_id) VALUES ($1, 'Draft', $2) RETURNING id",
    [title, user.id]
  );

  // Record initial status in history
  await pool.query(
    `INSERT INTO status_history (request_id, from_status, to_status) VALUES ($1, NULL, 'Draft')`,
    [rows[0].id]
  );

  return Response.json({ id: rows[0].id });
}
