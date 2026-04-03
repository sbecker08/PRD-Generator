import { type NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireAuth, requireRole, hasRole } from "@/lib/auth-utils";

/** GET /api/requests/[id]/questions — list all questions for a request */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const { id } = await params;

  const { rows } = await pool.query(
    `SELECT q.id, q.request_id, q.asked_by_user_id, q.question, q.answer,
            q.sent_at, q.answered_at, q.created_at,
            u.name AS asked_by_name
     FROM questions q
     LEFT JOIN users u ON u.id = q.asked_by_user_id
     WHERE q.request_id = $1
     ORDER BY q.created_at ASC`,
    [id]
  );

  return Response.json(rows);
}

/** POST /api/requests/[id]/questions — create a draft question (IS Reviewer only) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("IS Reviewer", req);
  if (user instanceof Response) return user;

  const { id } = await params;
  const { question }: { question: string } = await req.json();

  if (!question?.trim()) {
    return Response.json({ error: "Question text is required" }, { status: 400 });
  }

  // Verify the request exists and is in a reviewable status
  const { rows: reqRows } = await pool.query<{ status: string }>(
    "SELECT status FROM requests WHERE id = $1",
    [id]
  );

  if (reqRows.length === 0) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  if (!["Business Approved", "IS Review"].includes(reqRows[0].status)) {
    return Response.json(
      { error: "Questions can only be added during IS Review" },
      { status: 400 }
    );
  }

  const { rows } = await pool.query(
    `INSERT INTO questions (request_id, asked_by_user_id, question)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [id, user.id, question.trim()]
  );

  return Response.json(rows[0], { status: 201 });
}

/** DELETE /api/requests/[id]/questions — delete a draft question (IS Reviewer only) */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("IS Reviewer", req);
  if (user instanceof Response) return user;

  const { questionId }: { questionId: string } = await req.json();

  // Only allow deleting unsent (draft) questions
  const { rowCount } = await pool.query(
    "DELETE FROM questions WHERE id = $1 AND sent_at IS NULL AND asked_by_user_id = $2",
    [questionId, user.id]
  );

  if (rowCount === 0) {
    return Response.json(
      { error: "Question not found or already sent" },
      { status: 400 }
    );
  }

  return Response.json({ deleted: true });
}
