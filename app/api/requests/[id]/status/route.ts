import { type NextRequest } from "next/server";
import { transitionStatus, type RequestStatus } from "@/lib/status";
import { requireAuth } from "@/lib/auth-utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth();
  if (user instanceof Response) return user;

  const { id } = await params;
  const { status }: { status: RequestStatus } = await req.json();

  try {
    const newStatus = await transitionStatus(id, status);
    return Response.json({ status: newStatus });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 400 });
  }
}
