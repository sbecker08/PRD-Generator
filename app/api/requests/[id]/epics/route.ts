import pool from "@/lib/db";
import { requireAuth, requireRole, hasRole } from "@/lib/auth-utils";

/** GET /api/requests/[id]/epics — list all epics for a request */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const { id } = await params;

  const { rows } = await pool.query(
    "SELECT id, request_id, title, description, status, version, created_at, updated_at FROM epics WHERE request_id = $1 ORDER BY created_at",
    [id]
  );

  return Response.json(rows);
}

/** POST /api/requests/[id]/epics — add a new epic (IS Engineer only) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("IS Engineer", req);
  if (user instanceof Response) return user;

  const { id } = await params;
  const { title, description } = await req.json();

  if (!title?.trim()) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  // Verify request is in Epic Planning
  const { rows: requests } = await pool.query(
    "SELECT status FROM requests WHERE id = $1",
    [id]
  );

  if (requests.length === 0) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  if (requests[0].status !== "Epic Planning") {
    return Response.json(
      { error: "Can only add epics during Epic Planning" },
      { status: 400 }
    );
  }

  const { rows } = await pool.query(
    "INSERT INTO epics (request_id, title, description) VALUES ($1, $2, $3) RETURNING *",
    [id, title.trim(), description?.trim() || null]
  );

  return Response.json(rows[0], { status: 201 });
}

/** PUT /api/requests/[id]/epics — update an epic (IS Engineer only) */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("IS Engineer", req);
  if (user instanceof Response) return user;

  const { id } = await params;
  const { epicId, title, description } = await req.json();

  if (!epicId) {
    return Response.json({ error: "epicId is required" }, { status: 400 });
  }

  if (!title?.trim()) {
    return Response.json({ error: "Title is required" }, { status: 400 });
  }

  // Verify epic belongs to this request and request is in Epic Planning
  const { rows: epics } = await pool.query(
    `SELECT e.id, r.status FROM epics e JOIN requests r ON e.request_id = r.id WHERE e.id = $1 AND e.request_id = $2`,
    [epicId, id]
  );

  if (epics.length === 0) {
    return Response.json({ error: "Epic not found" }, { status: 404 });
  }

  if (epics[0].status !== "Epic Planning") {
    return Response.json(
      { error: "Can only edit epics during Epic Planning" },
      { status: 400 }
    );
  }

  const { rows } = await pool.query(
    "UPDATE epics SET title = $1, description = $2, updated_at = NOW() WHERE id = $3 RETURNING *",
    [title.trim(), description?.trim() || null, epicId]
  );

  return Response.json(rows[0]);
}

/** DELETE /api/requests/[id]/epics — remove an epic (IS Engineer only) */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("IS Engineer", req);
  if (user instanceof Response) return user;

  const { id } = await params;
  const { epicId } = await req.json();

  if (!epicId) {
    return Response.json({ error: "epicId is required" }, { status: 400 });
  }

  // Verify epic belongs to this request and request is in Epic Planning
  const { rows: epics } = await pool.query(
    `SELECT e.id, r.status FROM epics e JOIN requests r ON e.request_id = r.id WHERE e.id = $1 AND e.request_id = $2`,
    [epicId, id]
  );

  if (epics.length === 0) {
    return Response.json({ error: "Epic not found" }, { status: 404 });
  }

  if (epics[0].status !== "Epic Planning") {
    return Response.json(
      { error: "Can only remove epics during Epic Planning" },
      { status: 400 }
    );
  }

  await pool.query("DELETE FROM epics WHERE id = $1", [epicId]);

  return Response.json({ success: true });
}
