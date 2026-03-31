import { type NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  if (user instanceof Response) return user;

  const { id } = await params;

  const requestResult = await pool.query<{
    id: string;
    title: string;
    status: string;
    classification: string | null;
    application_name: string | null;
    created_by_user_id: string | null;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM requests WHERE id = $1", [id]);

  if (!requestResult.rows.length) {
    return new Response("Not found", { status: 404 });
  }

  const messagesResult = await pool.query<{
    id: string;
    request_id: string;
    role: string;
    content: string;
    created_at: string;
  }>(
    "SELECT * FROM messages WHERE request_id = $1 ORDER BY created_at ASC",
    [id]
  );

  return Response.json({
    ...requestResult.rows[0],
    messages: messagesResult.rows,
  });
}
