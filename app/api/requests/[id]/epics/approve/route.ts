import pool from "@/lib/db";
import { requireRole } from "@/lib/auth-utils";
import { transitionStatus } from "@/lib/status";

/** POST /api/requests/[id]/epics/approve — finalize epics and transition to In Progress */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("IS Engineer");
  if (user instanceof Response) return user;

  const { id } = await params;

  // Verify request is in Epic Planning
  const { rows: requests } = await pool.query(
    "SELECT id, status FROM requests WHERE id = $1",
    [id]
  );

  if (requests.length === 0) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  if (requests[0].status !== "Epic Planning") {
    return Response.json(
      { error: "Request must be in Epic Planning status" },
      { status: 400 }
    );
  }

  // Verify there are epics to approve
  const { rows: epics } = await pool.query(
    "SELECT id, title, description, status FROM epics WHERE request_id = $1",
    [id]
  );

  if (epics.length === 0) {
    return Response.json(
      { error: "No epics to approve. Generate or add epics first." },
      { status: 400 }
    );
  }

  // Set all epics to "Not Started" and record initial history
  for (const epic of epics) {
    await pool.query(
      "UPDATE epics SET status = 'Not Started', updated_at = NOW() WHERE id = $1",
      [epic.id]
    );

    await pool.query(
      "INSERT INTO epic_history (epic_id, title, description, status, change_reason) VALUES ($1, $2, $3, $4, $5)",
      [epic.id, epic.title, epic.description, "Not Started", "Epic breakdown approved"]
    );
  }

  // Transition request status: Epic Planning → In Progress
  const newStatus = await transitionStatus(id, "In Progress", user.id);

  return Response.json({ status: newStatus, epicCount: epics.length });
}
