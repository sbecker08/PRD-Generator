import { type NextRequest } from "next/server";
import pool from "@/lib/db";
import { transitionStatus } from "@/lib/status";
import { requireAuth } from "@/lib/auth-utils";

/**
 * POST /api/requests/[id]/questions/[questionId]/answer
 * Business requester answers a question.
 * When all sent questions are answered, auto-transitions Q&A Sent → IS Review.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const user = await requireAuth();
  if (user instanceof Response) return user;

  const { id, questionId } = await params;
  const { answer }: { answer: string } = await req.json();

  if (!answer?.trim()) {
    return Response.json({ error: "Answer text is required" }, { status: 400 });
  }

  // Verify the current user is the original requester
  const { rows: reqRows } = await pool.query<{ created_by_user_id: string | null; status: string }>(
    "SELECT created_by_user_id, status FROM requests WHERE id = $1",
    [id]
  );

  if (reqRows.length === 0) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  if (reqRows[0].created_by_user_id !== user.id) {
    return Response.json(
      { error: "Only the original requester can answer questions" },
      { status: 403 }
    );
  }

  // Update the question with the answer
  const { rowCount } = await pool.query(
    `UPDATE questions SET answer = $1, answered_at = NOW()
     WHERE id = $2 AND request_id = $3 AND sent_at IS NOT NULL`,
    [answer.trim(), questionId, id]
  );

  if (rowCount === 0) {
    return Response.json(
      { error: "Question not found or not yet sent" },
      { status: 400 }
    );
  }

  // Check if all sent questions are now answered
  const { rows: unanswered } = await pool.query(
    `SELECT id FROM questions
     WHERE request_id = $1 AND sent_at IS NOT NULL AND answered_at IS NULL`,
    [id]
  );

  // Auto-transition Q&A Sent → IS Review when all questions answered
  let newStatus = reqRows[0].status;
  if (unanswered.length === 0 && reqRows[0].status === "Q&A Sent") {
    try {
      newStatus = await transitionStatus(id, "IS Review", user.id);
    } catch {
      // If transition fails, that's okay — the answer was still saved
    }
  }

  return Response.json({ answered: true, allAnswered: unanswered.length === 0, status: newStatus });
}
