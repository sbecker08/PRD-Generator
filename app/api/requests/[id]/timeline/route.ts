import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

/** GET /api/requests/[id]/timeline — full chronological timeline of all events */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  if (user instanceof Response) return user;

  const { id } = await params;

  // Verify request exists
  const { rows: requests } = await pool.query(
    "SELECT id FROM requests WHERE id = $1",
    [id]
  );

  if (requests.length === 0) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  // Fetch all timeline events in parallel
  const [statusHistory, epicHistory, questions, messages] = await Promise.all([
    pool.query(
      `SELECT sh.id, sh.from_status, sh.to_status, sh.changed_at as timestamp,
              COALESCE(u.name, 'System') as actor_name
       FROM status_history sh
       LEFT JOIN users u ON sh.changed_by_user_id = u.id
       WHERE sh.request_id = $1
       ORDER BY sh.changed_at`,
      [id]
    ),
    pool.query(
      `SELECT eh.id, eh.status, eh.change_reason, eh.changed_at as timestamp,
              e.title as epic_title
       FROM epic_history eh
       JOIN epics e ON eh.epic_id = e.id
       WHERE e.request_id = $1
       ORDER BY eh.changed_at`,
      [id]
    ),
    pool.query(
      `SELECT q.id, q.question, q.answer, q.sent_at, q.answered_at, q.created_at,
              COALESCE(u.name, 'Unknown') as asked_by_name
       FROM questions q
       LEFT JOIN users u ON q.asked_by_user_id = u.id
       WHERE q.request_id = $1 AND q.sent_at IS NOT NULL
       ORDER BY q.sent_at`,
      [id]
    ),
    pool.query(
      `SELECT id, role, LEFT(content, 200) as content_preview, created_at as timestamp
       FROM messages
       WHERE request_id = $1
       ORDER BY created_at`,
      [id]
    ),
  ]);

  // Build unified timeline
  const events: Array<{
    id: string;
    type: string;
    timestamp: string;
    data: Record<string, unknown>;
  }> = [];

  for (const row of statusHistory.rows) {
    events.push({
      id: `status-${row.id}`,
      type: "status_change",
      timestamp: row.timestamp,
      data: {
        from: row.from_status,
        to: row.to_status,
        actor: row.actor_name,
      },
    });
  }

  for (const row of epicHistory.rows) {
    events.push({
      id: `epic-${row.id}`,
      type: "epic_update",
      timestamp: row.timestamp,
      data: {
        epicTitle: row.epic_title,
        status: row.status,
        reason: row.change_reason,
      },
    });
  }

  for (const row of questions.rows) {
    events.push({
      id: `question-${row.id}`,
      type: "question_sent",
      timestamp: row.sent_at,
      data: {
        question: row.question,
        askedBy: row.asked_by_name,
      },
    });
    if (row.answered_at) {
      events.push({
        id: `answer-${row.id}`,
        type: "question_answered",
        timestamp: row.answered_at,
        data: {
          question: row.question,
          answer: row.answer,
        },
      });
    }
  }

  for (const row of messages.rows) {
    events.push({
      id: `msg-${row.id}`,
      type: "message",
      timestamp: row.timestamp,
      data: {
        role: row.role,
        preview: row.content_preview,
      },
    });
  }

  // Sort by timestamp
  events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return Response.json(events);
}
