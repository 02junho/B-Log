import assert from "node:assert/strict";
import test from "node:test";
import { authenticateRequest, loginDestination } from "../src/lib/auth/policy";
import { requireSessionOwner } from "../src/lib/auth/access";
import type { Db } from "../src/lib/supabase/server";

const origin = "https://b-log.example";
test("authentication rejects missing, invalid, and expired identity despite the legacy token", async () => {
  for (const method of ["GET", "POST"]) {
    const result = await authenticateRequest(
      new Request(origin, {
        method,
        headers: { origin, "x-blog-token": "legacy" },
      }),
      async () => null,
    );
    assert.ok(result instanceof Response);
    assert.equal(result.status, 401);
  }
});
test("cross-origin and missing-origin mutations fail before identity lookup", async () => {
  for (const given of [
    undefined,
    "null",
    "https://attacker.example",
    origin + ".attacker.example",
  ]) {
    let called = false;
    const result = await authenticateRequest(
      new Request(origin, {
        method: "POST",
        headers: given ? { origin: given } : {},
      }),
      async () => {
        called = true;
        return { id: "alice" };
      },
    );
    assert.ok(result instanceof Response);
    assert.equal(result.status, 403);
    assert.equal(called, false);
  }
});
test("verified same-origin identity is accepted; auth service failure is closed", async () => {
  const request = new Request(origin, { method: "POST", headers: { origin } });
  assert.deepEqual(
    await authenticateRequest(request, async () => ({ id: "alice" })),
    { userId: "alice" },
  );
  const result = await authenticateRequest(request, async () => {
    throw new Error("private provider details");
  });
  assert.ok(result instanceof Response);
  assert.equal(result.status, 503);
  assert.doesNotMatch(await result.text(), /private provider details/);
});
test("same-origin comparison follows the public reverse-proxy host", async () => {
  const request = new Request("http://internal:3000/api/upload", {
    method: "POST",
    headers: {
      origin: "https://b-log.example",
      host: "internal:3000",
      "x-forwarded-host": "b-log.example",
      "x-forwarded-proto": "https",
    },
  });
  assert.deepEqual(
    await authenticateRequest(request, async () => ({ id: "alice" })),
    {
      userId: "alice",
    },
  );
});
test("login return addresses cannot leave the allowed product pages", () => {
  const review = "/sessions/12345678-1234-1234-1234-123456789abc/review";
  assert.equal(loginDestination(review), review);
  assert.equal(loginDestination("/new"), "/new");
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/auth/logout",
    "/new?next=//evil.example",
    "%2f%2fevil.example",
    null,
    [review],
  ]) {
    assert.equal(loginDestination(value), "/new");
  }
});

function database(
  owner: string | null,
  options: { missing?: boolean; failure?: boolean } = {},
) {
  const queries: string[] = [];
  const db = {
    from(table: string) {
      queries.push(table);
      return {
        select(column: string) {
          assert.equal(
            column,
            table === "sessions" ? "project_id" : "owner_id",
          );
          return {
            eq(column: string, value: string) {
              assert.equal(column, "id");
              assert.equal(value, table === "sessions" ? "session" : "project");
              return {
                async maybeSingle() {
                  return {
                    error: options.failure
                      ? { message: "private DB error" }
                      : null,
                    data: options.missing
                      ? null
                      : table === "sessions"
                        ? { project_id: "project" }
                        : { owner_id: owner },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Db;
  return { db, queries };
}
test("only the project owner can access a session; other and unowned sessions are hidden", async () => {
  assert.equal(
    await requireSessionOwner(database("alice").db, "session", "alice"),
    null,
  );
  for (const owner of ["bob", null]) {
    const result = await requireSessionOwner(
      database(owner).db,
      "session",
      "alice",
    );
    assert.equal(result?.status, 404);
  }
  const missing = database(null, { missing: true });
  assert.equal(
    (await requireSessionOwner(missing.db, "session", "alice"))?.status,
    404,
  );
  assert.deepEqual(missing.queries, ["sessions"]);
});
test("failed ownership query does not grant access or expose DB errors", async () => {
  const result = await requireSessionOwner(
    database("alice", { failure: true }).db,
    "session",
    "alice",
  );
  assert.equal(result?.status, 503);
  assert.doesNotMatch(await result!.text(), /private DB error/);
});
