import type { Db } from "../supabase/server";
import { isOwner } from "./policy";

/** Check before reading private data or running jobs with the service role. */
export async function ownsSession(
  db: Db,
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const { data: session, error } = await db
    .from("sessions")
    .select("project_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error("Ownership lookup failed");
  if (!session) return false;
  const { data: project, error: projectError } = await db
    .from("projects")
    .select("owner_id")
    .eq("id", session.project_id)
    .maybeSingle();
  if (projectError) throw new Error("Ownership lookup failed");
  return isOwner(project?.owner_id, userId);
}
export async function requireSessionOwner(
  db: Db,
  sessionId: string,
  userId: string,
): Promise<Response | null> {
  try {
    if (await ownsSession(db, sessionId, userId)) return null;
    return Response.json({ error: "session not found" }, { status: 404 });
  } catch {
    return Response.json(
      { error: "access check unavailable" },
      { status: 503 },
    );
  }
}
