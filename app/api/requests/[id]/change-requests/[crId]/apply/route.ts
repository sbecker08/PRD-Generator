import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import pool from "@/lib/db";
import { requireRole } from "@/lib/auth-utils";

export const maxDuration = 60;

const IMPACT_ANALYSIS_PROMPT = `You are a software project impact analyst. Given a change request summary and a list of current epics with their statuses, determine which epics are impacted by the change.

## Rules
- For each impacted epic, explain what needs to change
- For "Not Started" epics: describe how to modify the existing epic to incorporate the change
- For "In Progress" or "Complete" epics: describe what NEW epic(s) should be created to handle the change (don't modify in-progress/complete work)
- Be specific about what changes are needed
- If an epic is not impacted, don't include it

## Output Format
Return ONLY valid JSON — no markdown fences, no commentary. The format must be:
{
  "impacted_epics": [
    {
      "epic_id": "uuid of the impacted epic",
      "epic_title": "title of the impacted epic",
      "epic_status": "current status",
      "action": "modify" | "create_new",
      "changes": "description of what changes are needed",
      "new_title": "new title if action is modify, or title of new epic if action is create_new",
      "new_description": "updated or new description incorporating the change"
    }
  ],
  "summary": "brief overall impact summary"
}`;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; crId: string }> }
) {
  const user = await requireRole("IS Engineer");
  if (user instanceof Response) return user;

  const { id, crId } = await params;

  // Fetch change request
  const { rows: crs } = await pool.query(
    "SELECT id, status, summary FROM change_requests WHERE id = $1 AND request_id = $2",
    [crId, id]
  );

  if (crs.length === 0) {
    return Response.json({ error: "Change request not found" }, { status: 404 });
  }

  if (crs[0].status !== "Approved") {
    return Response.json(
      { error: "Only Approved change requests can be applied" },
      { status: 400 }
    );
  }

  // Fetch current epics
  const { rows: epics } = await pool.query(
    "SELECT id, title, description, status FROM epics WHERE request_id = $1 ORDER BY created_at",
    [id]
  );

  if (epics.length === 0) {
    return Response.json(
      { error: "No epics found to analyze impact against" },
      { status: 400 }
    );
  }

  // Build context for AI
  const epicsList = epics
    .map(
      (e: { id: string; title: string; description: string | null; status: string }, i: number) =>
        `${i + 1}. [${e.id}] "${e.title}" — Status: ${e.status}\n   Description: ${e.description || "N/A"}`
    )
    .join("\n");

  const prompt = `## Change Request Summary\n${crs[0].summary}\n\n## Current Epics\n${epicsList}`;

  const result = await generateText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: IMPACT_ANALYSIS_PROMPT,
    prompt,
  });

  let analysis;
  try {
    analysis = JSON.parse(result.text);
  } catch {
    return Response.json(
      { error: "Failed to parse impact analysis from AI", raw: result.text },
      { status: 500 }
    );
  }

  // Apply changes based on analysis
  const appliedChanges: Array<{ type: string; epicId?: string; title: string }> = [];

  for (const impact of analysis.impacted_epics) {
    if (impact.action === "modify" && impact.epic_status === "Not Started") {
      // BR-007: Fold changes into Not Started epic, preserve original in epic_history
      const epic = epics.find((e: { id: string }) => e.id === impact.epic_id);
      if (!epic) continue;

      // Save original to epic_history
      await pool.query(
        `INSERT INTO epic_history (epic_id, title, description, status, change_reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          epic.id,
          epic.title,
          epic.description,
          epic.status,
          `Original content preserved before change request applied`,
        ]
      );

      // Update the epic with new content
      await pool.query(
        `UPDATE epics SET title = $1, description = $2, version = version + 1, updated_at = NOW() WHERE id = $3`,
        [
          impact.new_title || epic.title,
          impact.new_description || epic.description,
          epic.id,
        ]
      );

      // Record the change in epic_history
      await pool.query(
        `INSERT INTO epic_history (epic_id, title, description, status, change_reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          epic.id,
          impact.new_title || epic.title,
          impact.new_description || epic.description,
          epic.status,
          `Modified by change request: ${impact.changes}`,
        ]
      );

      appliedChanges.push({
        type: "modified",
        epicId: epic.id,
        title: impact.new_title || epic.title,
      });
    } else if (
      impact.action === "create_new" &&
      (impact.epic_status === "In Progress" || impact.epic_status === "Complete")
    ) {
      // BR-008: Create new epics for In Progress or Complete epics
      const { rows: newEpic } = await pool.query(
        `INSERT INTO epics (request_id, title, description, status)
         VALUES ($1, $2, $3, 'Not Started')
         RETURNING *`,
        [id, impact.new_title, impact.new_description]
      );

      // Record creation in epic_history
      await pool.query(
        `INSERT INTO epic_history (epic_id, title, description, status, change_reason)
         VALUES ($1, $2, $3, 'Not Started', $4)`,
        [
          newEpic[0].id,
          impact.new_title,
          impact.new_description,
          `New epic created from change request impacting "${impact.epic_title}"`,
        ]
      );

      appliedChanges.push({
        type: "created",
        epicId: newEpic[0].id,
        title: impact.new_title,
      });
    }
  }

  // Mark change request as Applied
  await pool.query(
    "UPDATE change_requests SET status = 'Applied', updated_at = NOW() WHERE id = $1",
    [crId]
  );

  return Response.json({
    status: "Applied",
    analysis: analysis.summary,
    changes: appliedChanges,
  });
}
