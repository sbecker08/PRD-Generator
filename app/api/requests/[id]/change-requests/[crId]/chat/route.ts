import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import pool from "@/lib/db";
import { requireAuth } from "@/lib/auth-utils";

export const maxDuration = 60;

const CHANGE_REQUEST_PROMPT = `You are a change request specialist helping capture requirement changes for an in-progress software project. Your goal is to fully understand the requested change so that the development team can assess its impact on existing work.

## Your Approach
- Ask ONE focused question at a time
- Be conversational and helpful
- Understand the full scope of the change before wrapping up

## Areas to Cover
1. **What** exactly needs to change (be specific about features, behaviors, or requirements)
2. **Why** the change is needed (business driver, user feedback, regulatory requirement, etc.)
3. **Impact scope** — which parts of the system are affected
4. **Priority** — how urgent is this change
5. **Acceptance criteria** — how will you know the change is correctly implemented

## When You Have Enough
After 4-8 exchanges, when you understand the change clearly, say exactly:
"I have enough information to summarize this change request. Here's the summary:"

Then generate a structured summary:

# Change Request Summary

## Description
[Clear description of what needs to change]

## Reason for Change
[Why this change is needed]

## Affected Areas
- [List of affected features/areas]

## Priority
[High/Medium/Low with justification]

## Acceptance Criteria
- [List of criteria]

## Impact Notes
[Any notes about potential impact on existing work]`;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; crId: string }> }
) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const { id, crId } = await params;
  const { message } = await req.json();

  if (!message?.trim()) {
    return Response.json({ error: "Message is required" }, { status: 400 });
  }

  // Fetch change request
  const { rows: crs } = await pool.query(
    "SELECT id, request_id, conversation_history, status, created_by_user_id FROM change_requests WHERE id = $1 AND request_id = $2",
    [crId, id]
  );

  if (crs.length === 0) {
    return Response.json({ error: "Change request not found" }, { status: 404 });
  }

  const cr = crs[0];

  if (cr.status !== "Draft") {
    return Response.json(
      { error: "Can only chat during Draft status" },
      { status: 400 }
    );
  }

  // Only the creator can chat
  if (cr.created_by_user_id !== user.id) {
    return Response.json(
      { error: "Only the change request creator can continue this conversation" },
      { status: 403 }
    );
  }

  // Get PRD context for the AI
  const { rows: messages } = await pool.query(
    "SELECT content FROM messages WHERE request_id = $1 AND role = 'assistant' ORDER BY created_at DESC",
    [id]
  );

  const prdMessage = messages.find(
    (m: { content: string }) =>
      m.content.includes("# Product Requirements Document") ||
      m.content.includes("## 1. Executive Summary")
  );

  // Get current epics for context
  const { rows: epics } = await pool.query(
    "SELECT title, description, status FROM epics WHERE request_id = $1 ORDER BY created_at",
    [id]
  );

  // Build conversation history
  const history = cr.conversation_history as Array<{ role: string; content: string }>;
  history.push({ role: "user", content: message.trim() });

  // Build context for AI
  let contextPrefix = "";
  if (prdMessage) {
    contextPrefix += `\n\n## Current PRD (for reference)\n${prdMessage.content}\n`;
  }
  if (epics.length > 0) {
    contextPrefix += `\n\n## Current Epics\n${epics.map((e: { title: string; status: string }, i: number) => `${i + 1}. ${e.title} [${e.status}]`).join("\n")}\n`;
  }

  const aiMessages = history.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const result = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: CHANGE_REQUEST_PROMPT + contextPrefix,
    messages: aiMessages,
  });

  history.push({ role: "assistant", content: result.text });

  // Extract summary if the AI generated one
  let summary: string | null = null;
  if (result.text.includes("# Change Request Summary")) {
    summary = result.text;
  }

  await pool.query(
    "UPDATE change_requests SET conversation_history = $1, summary = $2, updated_at = NOW() WHERE id = $3",
    [JSON.stringify(history), summary || cr.summary, crId]
  );

  return Response.json({
    message: { role: "assistant", content: result.text },
    conversation_history: history,
    hasSummary: !!summary,
  });
}
