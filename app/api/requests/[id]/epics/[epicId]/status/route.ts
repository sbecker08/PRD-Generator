import pool from "@/lib/db";
import { requireRole } from "@/lib/auth-utils";

type EpicStatus = "Not Started" | "In Progress" | "Complete";

const VALID_EPIC_TRANSITIONS: Record<EpicStatus, EpicStatus[]> = {
  "Not Started": ["In Progress"],
  "In Progress": ["Complete", "Not Started"],
  Complete: ["In Progress"],
};

/** PATCH /api/requests/[id]/epics/[epicId]/status — update an epic's status (IS Engineer only) */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; epicId: string }> }
) {
  const user = await requireRole("IS Engineer");
  if (user instanceof Response) return user;

  const { id, epicId } = await params;
  const { status } = (await req.json()) as { status: EpicStatus };

  if (!["Not Started", "In Progress", "Complete"].includes(status)) {
    return Response.json({ error: "Invalid epic status" }, { status: 400 });
  }

  // Verify epic belongs to this request and request is In Progress
  const { rows: epics } = await pool.query(
    `SELECT e.id, e.title, e.description, e.status as epic_status, r.status as request_status
     FROM epics e JOIN requests r ON e.request_id = r.id
     WHERE e.id = $1 AND e.request_id = $2`,
    [epicId, id]
  );

  if (epics.length === 0) {
    return Response.json({ error: "Epic not found" }, { status: 404 });
  }

  if (epics[0].request_status !== "In Progress") {
    return Response.json(
      { error: "Can only update epic status when request is In Progress" },
      { status: 400 }
    );
  }

  const currentStatus = epics[0].epic_status as EpicStatus;
  if (!VALID_EPIC_TRANSITIONS[currentStatus]?.includes(status)) {
    return Response.json(
      { error: `Cannot transition epic from "${currentStatus}" to "${status}"` },
      { status: 400 }
    );
  }

  // Update epic status
  const { rows } = await pool.query(
    "UPDATE epics SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    [status, epicId]
  );

  // Record to epic_history
  await pool.query(
    "INSERT INTO epic_history (epic_id, title, description, status, change_reason) VALUES ($1, $2, $3, $4, $5)",
    [epicId, epics[0].title, epics[0].description, status, `Status changed from "${currentStatus}" to "${status}"`]
  );

  return Response.json(rows[0]);
}
