import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import pool from "@/lib/db";
import { requireRole } from "@/lib/auth-utils";

export const maxDuration = 60;

const EPIC_BREAKDOWN_PROMPT = `You are an expert software architect and project planner. Given a Product Requirements Document (PRD), break it down into buildable development epics.

## Rules
- Each epic should be a cohesive, independently deliverable unit of work
- Epics should be ordered logically (dependencies first)
- Each epic needs a clear title and a detailed description
- Descriptions must include:
  - What will be built
  - Which specific PRD requirements and business rules apply to this epic (quote or reference them by section/number if available)
  - Key acceptance criteria that map directly to those requirements
  - Any dependencies on other epics
- Every functional requirement and business rule from the PRD must be captured in at least one epic — do not omit any
- The FIRST epic must always cover foundational project setup (e.g., repo initialization, dev environment, CI/CD pipeline, core dependencies, project scaffolding) — even if the PRD does not mention it explicitly
- Aim for 3-10 epics depending on project complexity
- Write descriptions from a development perspective — what needs to be implemented

## Output Format
Return ONLY valid JSON — no markdown fences, no commentary. The format must be:
[
  {
    "title": "Epic title",
    "description": "Detailed description of what this epic covers, which PRD requirements/business rules it addresses, acceptance criteria, and dependencies"
  }
]`;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("IS Engineer", req);
  if (user instanceof Response) return user;

  const { id } = await params;

  // Verify request exists and is in Epic Planning status
  const { rows: requests } = await pool.query(
    "SELECT id, status FROM requests WHERE id = $1",
    [id]
  );

  if (requests.length === 0) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  if (requests[0].status !== "Epic Planning") {
    return Response.json(
      { error: "Request must be in Epic Planning status to generate epics" },
      { status: 400 }
    );
  }

  // Get all messages to find the PRD
  const { rows: messages } = await pool.query(
    "SELECT content FROM messages WHERE request_id = $1 AND role = 'assistant' ORDER BY created_at DESC",
    [id]
  );

  const prdMessage = messages.find(
    (m: { content: string }) =>
      m.content.includes("# Product Requirements Document") ||
      m.content.includes("## 1. Executive Summary")
  );

  if (!prdMessage) {
    return Response.json({ error: "No PRD found for this request" }, { status: 400 });
  }

  // Also get Q&A context if available
  const { rows: qaRows } = await pool.query(
    "SELECT question, answer FROM questions WHERE request_id = $1 AND sent_at IS NOT NULL AND answered_at IS NOT NULL ORDER BY created_at",
    [id]
  );

  let context = `## PRD\n\n${prdMessage.content}`;
  if (qaRows.length > 0) {
    context += "\n\n## Q&A Clarifications\n\n";
    context += qaRows
      .map((q: { question: string; answer: string }) => `**Q:** ${q.question}\n**A:** ${q.answer}`)
      .join("\n\n");
  }

  const result = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: EPIC_BREAKDOWN_PROMPT,
    prompt: context,
  });

  try {
    const epics = JSON.parse(result.text);
    return Response.json({ epics });
  } catch {
    return Response.json(
      { error: "Failed to parse epic breakdown from AI", raw: result.text },
      { status: 500 }
    );
  }
}
