import { type NextRequest } from "next/server";
import pool from "@/lib/db";

export async function GET() {
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
  const { title }: { title: string } = await req.json();
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO requests (title) VALUES ($1) RETURNING id",
    [title]
  );
  return Response.json({ id: rows[0].id });
}
