import { type NextRequest } from "next/server";
import pool from "@/lib/db";
import { requireRole } from "@/lib/auth-utils";
import type { UserRole } from "@/lib/auth";

const VALID_ROLES: UserRole[] = [
  "Business Requester",
  "IS Reviewer",
  "IS Engineer",
  "Admin",
];

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await requireRole("Admin");
  if (admin instanceof Response) return admin;

  const { userId } = await params;
  const { roles }: { roles: UserRole[] } = await req.json();

  // Validate roles
  for (const role of roles) {
    if (!VALID_ROLES.includes(role)) {
      return Response.json(
        { error: `Invalid role: ${role}` },
        { status: 400 }
      );
    }
  }

  // Verify user exists
  const { rows: userRows } = await pool.query(
    "SELECT id FROM users WHERE id = $1",
    [userId]
  );
  if (userRows.length === 0) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  // Replace all roles in a transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
    for (const role of roles) {
      await client.query(
        "INSERT INTO user_roles (user_id, role) VALUES ($1, $2)",
        [userId, role]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return Response.json({ userId, roles });
}
