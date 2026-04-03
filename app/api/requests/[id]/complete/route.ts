import pool from "@/lib/db";
import { requireRole } from "@/lib/auth-utils";
import { transitionStatus } from "@/lib/status";

/** POST /api/requests/[id]/complete — mark request as Complete (IS Engineer only, all epics must be Complete) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("IS Engineer", req);
  if (user instanceof Response) return user;

  const { id } = await params;

  // Verify request is In Progress
  const { rows: requests } = await pool.query(
    "SELECT id, status FROM requests WHERE id = $1",
    [id]
  );

  if (requests.length === 0) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  if (requests[0].status !== "In Progress") {
    return Response.json(
      { error: "Request must be In Progress to mark as Complete" },
      { status: 400 }
    );
  }

  // Check all epics are Complete
  const { rows: epics } = await pool.query(
    "SELECT id, status FROM epics WHERE request_id = $1",
    [id]
  );

  if (epics.length === 0) {
    return Response.json(
      { error: "No epics found for this request" },
      { status: 400 }
    );
  }

  const incomplete = epics.filter((e) => e.status !== "Complete");
  if (incomplete.length > 0) {
    return Response.json(
      {
        error: `Cannot complete request: ${incomplete.length} epic(s) are not yet complete`,
      },
      { status: 400 }
    );
  }

  // Transition request: In Progress → Complete
  const newStatus = await transitionStatus(id, "Complete", user.id);

  return Response.json({ status: newStatus });
}
