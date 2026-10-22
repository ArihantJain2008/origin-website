import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../api/_account.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const account = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("account auth cookies are HttpOnly, Secure and scoped on the same-site host", () => {
  const headers = {};
  account.setAuthCookies({ setHeader: (name, value) => { headers[name] = value; } }, { access_token: "access", refresh_token: "refresh", expires_in: 600 });
  assert.equal(headers["Set-Cookie"].length, 2);
  assert.match(headers["Set-Cookie"][0], /HttpOnly; Secure; SameSite=Lax/);
  assert.match(headers["Set-Cookie"][1], /Path=\//);
  assert.match(headers["Set-Cookie"][1], /HttpOnly; Secure; SameSite=Lax/);
});

test("account identity is resolved from Supabase and suspended profiles fail closed", async () => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = "https://unit-test.supabase.co"; process.env.SUPABASE_ANON_KEY = "public-test-key";
  let suspended = false;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.includes("/auth/v1/user")) return Response.json({ id: "user-1", email: "member@example.com" });
    if (url.includes("/rest/v1/profiles")) return Response.json([{ suspended_at: suspended ? "2026-01-01T00:00:00Z" : null }]);
    throw new Error(`Unexpected URL: ${url}`);
  };
  try {
    const req = { headers: { cookie: "origin_user_access=valid-token; origin_user_refresh=refresh-token" } };
    const res = { setHeader() {} };
    const active = await account.authenticatedUser(req, res);
    assert.equal(active.user.id, "user-1");
    suspended = true;
    assert.equal(await account.authenticatedUser(req, res), null);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previous.key;
  }
});

test("invalid account access tokens fail closed and mutating requests reject foreign origins", async () => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_ANON_KEY, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = "https://unit-test.supabase.co"; process.env.SUPABASE_ANON_KEY = "public-test-key";
  globalThis.fetch = async () => new Response(null, { status: 401 });
  try {
    const req = { headers: { cookie: "origin_user_access=invalid" } };
    const res = { setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    assert.equal(await account.authenticatedUser(req, res), null);
    assert.equal(account.sameOrigin({ headers: { origin: "https://attacker.example", host: "origin.example" } }, res), false);
    assert.equal(res.code, 403);
  } finally {
    globalThis.fetch = previous.fetch;
    if (previous.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previous.key;
  }
});
