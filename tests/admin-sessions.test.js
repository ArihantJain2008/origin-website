import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../api/_auth.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const auth = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("administrator sessions store only token hashes and can be revoked", async () => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, email: process.env.ADMIN_EMAIL, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "test-secret";
  process.env.ADMIN_EMAIL = "admin@example.com";
  const rows = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (init.method === "POST" && url.pathname.endsWith("/admin_sessions")) {
      const row = { id: "c7917caa-fba2-40ab-a9e4-c0d05d26ce46", ...JSON.parse(init.body) };
      rows.push(row);
      return Response.json([row], { status: 201 });
    }
    if (init.method === "POST") return new Response(null, { status: 201 });
    if (init.method === "PATCH") {
      const id = url.searchParams.get("id")?.replace("eq.", "");
      const row = rows.find((item) => item.id === id);
      if (row) Object.assign(row, JSON.parse(init.body));
      return new Response(null, { status: 204 });
    }
    const hash = url.searchParams.get("token_hash")?.replace("eq.", "");
    const row = rows.filter((item) => item.token_hash === hash && !item.revoked_at && Date.parse(item.expires_at) > Date.now());
    return Response.json(row);
  };
  try {
    const token = await auth.createSession("admin@example.com");
    assert.match(token, /^[A-Za-z0-9_-]{40,60}$/);
    const storedHash = rows[0].token_hash;
    assert.equal(storedHash, createHash("sha256").update(token).digest("hex"));
    assert.notEqual(storedHash, token);
    const req = { headers: { cookie: `__Host-origin_admin_session=${token}` } };
    const active = await auth.getSession(req);
    assert.equal(active.email, "admin@example.com");
    const authorized = await auth.requireAdmin(req, { status() { return this; }, json() {} });
    assert.equal(authorized.id, active.id);
    assert.equal(await auth.revokeSession(active.id), true);
    assert.equal(await auth.getSession(req), null);
    let statusCode = 0;
    const denied = await auth.requireAdmin(req, { status(code) { statusCode = code; return this; }, json() {} });
    assert.equal(denied, null);
    assert.equal(statusCode, 401);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of [["SUPABASE_URL", previous.url], ["SUPABASE_SECRET_KEY", previous.key], ["ADMIN_EMAIL", previous.email]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("administrator login attempts are rate limited by client address", () => {
  const req = { headers: { "x-forwarded-for": "198.51.100.29" } };
  for (let attempt = 0; attempt < 8; attempt++) assert.equal(auth.loginAllowed(req), true);
  assert.equal(auth.loginAllowed(req), false);
});
