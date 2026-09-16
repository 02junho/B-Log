import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardEntries } from "../src/lib/dashboard";
import type { Db } from "../src/lib/supabase/server";

function dashboardDatabase() {
  const filters: Array<{ table: string; column: string; value: unknown }> = [];
  const db = {
    from(table: string) {
      return {
        select() {
          if (table === "projects") {
            return {
              async eq(column: string, value: string) {
                filters.push({ table, column, value });
                return {
                  data: [{ id: "project-a", name: "B-Log", repo_url: "https://github.com/02junho/B-Log" }],
                  error: null,
                };
              },
            };
          }
          return {
            in(column: string, value: string[]) {
              filters.push({ table, column, value });
              return {
                order() {
                  if (table === "sessions") {
                    return {
                      async limit() {
                        return {
                          data: [
                            { id: "session-review", project_id: "project-a", source_tool: "codex", status: "ready", created_at: "2026-09-14T01:00:00Z" },
                            { id: "session-public", project_id: "project-a", source_tool: "claude-code", status: "ready", created_at: "2026-09-13T01:00:00Z" },
                          ],
                          error: null,
                        };
                      },
                    };
                  }
                  return Promise.resolve({
                    data: [
                      { session_id: "session-review", title: "검수할 기록", slug: "review", published_at: null, created_at: "2026-09-14T02:00:00Z" },
                      { session_id: "session-public", title: "공개된 기록", slug: "public", published_at: "2026-09-13T02:00:00Z", created_at: "2026-09-13T02:00:00Z" },
                    ],
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Db;
  return { db, filters };
}

test("dashboard lists only the signed-in owner's sessions and derives useful actions", async () => {
  const { db, filters } = dashboardDatabase();
  const entries = await getDashboardEntries(db, "owner-a");

  assert.deepEqual(entries.map((entry) => entry.state), ["review", "published"]);
  assert.deepEqual(entries.map((entry) => entry.portfolio?.slug), ["review", "public"]);
  assert.deepEqual(filters, [
    { table: "projects", column: "owner_id", value: "owner-a" },
    { table: "sessions", column: "project_id", value: ["project-a"] },
    { table: "portfolios", column: "session_id", value: ["session-review", "session-public"] },
  ]);
});
