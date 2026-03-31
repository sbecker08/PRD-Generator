import { type NextRequest } from "next/server";
import { transitionStatus, type RequestStatus } from "@/lib/status";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
