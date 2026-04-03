import pool from "@/lib/db";
import { requireAuth, hasRole } from "@/lib/auth-utils";

/** GET /api/requests/[id]/change-requests — list all change requests for a request */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const { id } = await params;

  const { rows } = await pool.query(
    `SELECT cr.id, cr.request_id, cr.conversation_history, cr.status, cr.summary,
            cr.created_by_user_id, cr.created_at, cr.updated_at,
            COALESCE(u.name, 'Unknown') as created_by_name
     FROM change_requests cr
     LEFT JOIN users u ON cr.created_by_user_id = u.id
     WHERE cr.request_id = $1
     ORDER BY cr.created_at DESC`,
    [id]
  );

  return Response.json(rows);
}

/** POST /api/requests/[id]/change-requests — create a new change request (Business Requester only) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const { id } = await params;

  // Verify request exists and is In Progress
  const { rows: requests } = await pool.query(
    "SELECT id, status, created_by_user_id FROM requests WHERE id = $1",
    [id]
  );

  if (requests.length === 0) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  if (requests[0].status !== "In Progress") {
    return Response.json(
      { error: "Change requests can only be submitted for In Progress requests" },
      { status: 400 }
    );
  }

  // Only the original requester or a Business Requester can create change requests
  const isOriginalRequester = requests[0].created_by_user_id === user.id;
  const isBusinessRequester = hasRole(user, "Business Requester");
  if (!isOriginalRequester && !isBusinessRequester) {
    return Response.json(
      { error: "Only the business requester can submit change requests" },
      { status: 403 }
    );
  }

  const initialHistory = [
    {
      role: "assistant",
      content:
        "I'll help you document this change request. Please describe what you'd like to change about the current requirements or epics. Be as specific as possible about:\n\n1. **What** needs to change\n2. **Why** the change is needed\n3. **Which areas** of the project are affected\n\nWhat change would you like to make?",
    },
  ];

  const { rows } = await pool.query(
    `INSERT INTO change_requests (request_id, created_by_user_id, conversation_history, status)
     VALUES ($1, $2, $3, 'Draft')
     RETURNING *`,
    [id, user.id, JSON.stringify(initialHistory)]
  );

  return Response.json(rows[0], { status: 201 });
}
