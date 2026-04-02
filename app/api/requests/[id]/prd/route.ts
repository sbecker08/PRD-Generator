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

  const requestResult = await pool.query<{ id: string }>(
    "SELECT id FROM requests WHERE id = $1",
    [id]
  );

  if (!requestResult.rows.length) {
    return new Response("Not found", { status: 404 });
  }

  // Prefer prd_versions over raw messages
  const { rows: versions } = await pool.query<{ content: string }>(
    `SELECT content FROM prd_versions
     WHERE request_id = $1
     ORDER BY version_number DESC
     LIMIT 1`,
    [id]
  );

  if (versions.length > 0) {
    return Response.json({ content: versions[0].content });
  }

  // Fallback: scan messages for legacy requests that pre-date prd_versions
  const { rows: messages } = await pool.query<{ content: string }>(
    "SELECT content FROM messages WHERE request_id = $1 AND role = 'assistant' ORDER BY created_at DESC",
    [id]
  );

  const prdMessage = messages.find(
    (m) =>
      m.content.includes("# Product Requirements Document") ||
      m.content.includes("## 1. Executive Summary")
  );

  if (!prdMessage) {
    return Response.json({ error: "No PRD found for this request" }, { status: 404 });
  }

  return Response.json({ content: prdMessage.content });
}
