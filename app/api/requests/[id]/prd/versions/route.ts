import { type NextRequest } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import pool from "@/lib/db";
import { transitionStatus } from "@/lib/status";
import { requireAuth, requireRole } from "@/lib/auth-utils";

export const maxDuration = 60;

/**
 * GET /api/requests/[id]/prd/versions
 * Returns all PRD versions for a request, ordered oldest to newest.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(req);
  if (user instanceof Response) return user;

  const { id } = await params;

  const { rows } = await pool.query(
    `SELECT
       pv.id,
       pv.version_number,
       pv.content,
       pv.change_summary,
       pv.status,
       pv.generated_at,
       pv.approved_at,
       u.name AS approved_by_name
     FROM prd_versions pv
     LEFT JOIN users u ON u.id = pv.approved_by_user_id
     WHERE pv.request_id = $1
     ORDER BY pv.version_number ASC`,
    [id]
  );

  return Response.json(rows);
}

/**
 * POST /api/requests/[id]/prd/versions
 * IS Reviewer generates an updated PRD version incorporating Q&A answers.
 * Transitions the request from "IS Review" to "PRD Updated".
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireRole("IS Reviewer", req);
  if (user instanceof Response) return user;

  const { id } = await params;

  // Verify status is IS Review
  const { rows: reqRows } = await pool.query<{
    status: string;
    title: string;
  }>(
    "SELECT status, title FROM requests WHERE id = $1",
    [id]
  );

  if (reqRows.length === 0) {
    return Response.json({ error: "Request not found" }, { status: 404 });
  }

  if (reqRows[0].status !== "IS Review") {
    return Response.json(
      { error: "PRD can only be updated during IS Review" },
      { status: 400 }
    );
  }

  // Ensure no unanswered questions remain
  const { rows: unanswered } = await pool.query(
    `SELECT id FROM questions
     WHERE request_id = $1 AND sent_at IS NOT NULL AND answered_at IS NULL`,
    [id]
  );

  if (unanswered.length > 0) {
    return Response.json(
      { error: "All sent questions must be answered before updating the PRD" },
      { status: 400 }
    );
  }

  // Fetch the latest PRD version (or fall back to messages)
  const { rows: existingVersions } = await pool.query<{
    id: string;
    version_number: number;
    content: string;
  }>(
    `SELECT id, version_number, content
     FROM prd_versions WHERE request_id = $1
     ORDER BY version_number DESC LIMIT 1`,
    [id]
  );

  let currentPrdContent: string;
  let nextVersionNumber: number;

  if (existingVersions.length > 0) {
    currentPrdContent = existingVersions[0].content;
    nextVersionNumber = existingVersions[0].version_number + 1;
  } else {
    // Legacy: extract from messages
    const { rows: messages } = await pool.query<{ content: string }>(
      `SELECT content FROM messages
       WHERE request_id = $1 AND role = 'assistant'
       ORDER BY created_at DESC`,
      [id]
    );
    const prdMsg = messages.find(
      (m) =>
        m.content.includes("# Product Requirements Document") ||
        m.content.includes("## 1. Executive Summary")
    );
    if (!prdMsg) {
      return Response.json({ error: "No existing PRD found for this request" }, { status: 400 });
    }
    currentPrdContent = prdMsg.content;
    nextVersionNumber = 2;
  }

  // Fetch all answered Q&A
  const { rows: questions } = await pool.query<{
    question: string;
    answer: string;
  }>(
    `SELECT question, answer FROM questions
     WHERE request_id = $1 AND answered_at IS NOT NULL
     ORDER BY answered_at ASC`,
    [id]
  );

  const qaContext = questions
    .map((q, i) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.answer}`)
    .join("\n\n");

  // Ask Claude to update the PRD and produce a change summary
  const prompt = `You are updating a Product Requirements Document based on new information gathered during an IS (Information Systems) review Q&A session.

## Current PRD
${currentPrdContent}

## Q&A Answers from Business Requester
${qaContext || "(No Q&A answers — reviewer completed review without sending questions)"}

## Your Task
1. Update the PRD to incorporate the new information from the Q&A answers. Correct any gaps, ambiguities, or misunderstandings revealed by the answers. Keep all sections that are still accurate unchanged.
2. Bump the Version number by 1 and update the Date.
3. After the updated PRD, write a CHANGE SUMMARY section using this exact marker and format:

<!-- CHANGE_SUMMARY_START -->
## What Changed in This Version

### Added
- [bullet each new requirement, section, or clarification added]

### Updated
- [bullet each section or requirement that was revised]

### Removed
- [bullet anything removed or descoped, or "Nothing removed" if none]

### Key Clarifications from Q&A
- [bullet the most important insights from the Q&A that shaped the update]
<!-- CHANGE_SUMMARY_END -->

Respond with ONLY the updated PRD markdown followed immediately by the change summary block. No preamble or explanation.`;

  const { text: fullText } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    prompt,
  });

  // Split PRD content from change summary
  const summaryStart = fullText.indexOf("<!-- CHANGE_SUMMARY_START -->");
  const summaryEnd = fullText.indexOf("<!-- CHANGE_SUMMARY_END -->");

  let updatedContent: string;
  let changeSummary: string | null = null;

  if (summaryStart !== -1 && summaryEnd !== -1) {
    updatedContent = fullText.slice(0, summaryStart).trim();
    changeSummary = fullText
      .slice(summaryStart + "<!-- CHANGE_SUMMARY_START -->".length, summaryEnd)
      .trim();
  } else {
    updatedContent = fullText;
  }

  // Mark prior versions as Superseded and insert the new version
  await pool.query(
    `UPDATE prd_versions SET status = 'Superseded'
     WHERE request_id = $1 AND status != 'Superseded'`,
    [id]
  );

  const { rows: inserted } = await pool.query<{ id: string }>(
    `INSERT INTO prd_versions (request_id, version_number, content, change_summary)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [id, nextVersionNumber, updatedContent, changeSummary]
  );

  // Transition to PRD Updated
  await transitionStatus(id, "PRD Updated", user.id);

  return Response.json({
    id: inserted[0].id,
    version_number: nextVersionNumber,
    change_summary: changeSummary,
  });
}
