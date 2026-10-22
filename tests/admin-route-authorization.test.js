import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const authSource = await readFile(new URL("../api/_auth.ts", import.meta.url), "utf8");
const authCode = ts.transpileModule(authSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const authUrl = `data:text/javascript;base64,${Buffer.from(authCode).toString("base64")}`;
const routeSource = await readFile(new URL("../lib/api-handlers/admin/community.ts", import.meta.url), "utf8");
const routeCode = ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace('from "../../../api/_auth"', `from "${authUrl}"`);
const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(routeCode).toString("base64")}`);

test("admin moderation endpoint rejects unauthenticated requests before reading private records", async () => {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, email: process.env.ADMIN_EMAIL, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "service-test-key";
  process.env.ADMIN_EMAIL = "admin@example.test";
  const requests = [];
  globalThis.fetch = async (input) => { requests.push(String(input)); return Response.json([]); };
  try {
    const res = { headers: {}, statusCode: 0, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; }, setHeader(name, value) { this.headers[name] = value; } };
    await handler({ method: "GET", query: { kind: "reports" }, headers: { cookie: "__Host-origin_admin_session=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop" } }, res);
    assert.equal(res.statusCode, 401);
    assert.equal(requests.length, 1);
    assert.match(requests[0], /admin_sessions\?/);
    assert.ok(!requests[0].includes("/reports?"));
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [["SUPABASE_URL", previous.url], ["SUPABASE_SECRET_KEY", previous.key], ["ADMIN_EMAIL", previous.email]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
