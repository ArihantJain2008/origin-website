import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

function moduleUrl(source) { return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`; }
const accountSource = await readFile(new URL("../api/_account.ts", import.meta.url), "utf8");
const accountUrl = moduleUrl(ts.transpileModule(accountSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const installerSource = await readFile(new URL("../api/_installers.js", import.meta.url), "utf8");
const installerUrl = moduleUrl(ts.transpileModule(installerSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const source = await readFile(new URL("../lib/api-handlers/community.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace('from "../../api/_account.js"', `from "${accountUrl}"`)
  .replace('from "../../api/_installers.js"', `from "${installerUrl}"`);
const { default: handler } = await import(moduleUrl(code));

const appId = "24c2d90b-7b2e-4d76-a960-bbbf2238c229";
const userId = "18bc3372-12b9-4eec-9af8-e329695f9a6d";
const otherContentId = "641a5d1a-a71e-4f9e-bd60-c852a2d3bf82";

async function withEnvironment(fetcher, run) {
  const old = { url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-test-key";
  globalThis.fetch = fetcher;
  try { await run(); }
  finally {
    globalThis.fetch = old.fetch;
    if (old.url === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = old.url;
    if (old.anon === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = old.anon;
  }
}

function routeRequest({ method = "GET", kind, body, id, cookie } = {}) {
  const req = { method, query: { kind, application: "origin", ...(id ? { id } : {}) }, headers: { origin: "https://origin.test", host: "origin.test", ...(cookie ? { cookie } : {}) }, ...(body ? { body } : {}) };
  const res = { headers: {}, statusCode: 0, body: undefined, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; }, setHeader(name, value) { this.headers[name] = value; } };
  return { req, res };
}

function authFetch(url) {
  if (url.includes("/auth/v1/user")) return Response.json({ id: userId, email: "owner@example.test" });
  if (url.includes("/rest/v1/profiles?")) return Response.json([{ suspended_at: null }]);
  if (url.includes("/rest/v1/applications?")) return Response.json([{ id: appId }]);
  return null;
}

test("public review reads request published rows only", async () => {
  await withEnvironment(async (input, init) => {
    const url = String(input);
    const auth = authFetch(url);
    if (auth) return auth;
    assert.match(url, /reviews\?/);
    assert.equal(new URL(url).searchParams.get("status"), "eq.published");
    return Response.json([]);
  }, async () => {
    const { req, res } = routeRequest({ kind: "reviews" });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.items, []);
  });
});

test("anonymous users cannot submit community content and invalid ratings are rejected", async () => {
  await withEnvironment(async (input) => {
    const auth = authFetch(String(input));
    if (auth) return auth;
    throw new Error("No content write should be attempted");
  }, async () => {
    const anonymous = routeRequest({ method: "POST", kind: "comment", body: { applicationId: "origin", body: "hello" } });
    await handler(anonymous.req, anonymous.res);
    assert.equal(anonymous.res.statusCode, 401);

    const invalid = routeRequest({ method: "POST", kind: "review", cookie: "origin_user_access=valid; origin_user_refresh=refresh", body: { applicationId: "origin", rating: 6, body: "not a valid rating" } });
    await handler(invalid.req, invalid.res);
    assert.equal(invalid.res.statusCode, 400);
  });
});

test("review edits filter by both content id and the current user id", async () => {
  let updateUrl = "";
  await withEnvironment(async (input, init = {}) => {
    const url = String(input);
    const auth = authFetch(url);
    if (auth) return auth;
    updateUrl = url;
    assert.equal(init.method, "PATCH");
    return Response.json([]);
  }, async () => {
    const { req, res } = routeRequest({ method: "PATCH", kind: "review", id: otherContentId, cookie: "origin_user_access=valid; origin_user_refresh=refresh", body: { rating: 5, body: "updated" } });
    await handler(req, res);
    assert.equal(res.statusCode, 404);
    const query = new URL(updateUrl).searchParams;
    assert.equal(query.get("id"), `eq.${otherContentId}`);
    assert.equal(query.get("user_id"), `eq.${userId}`);
  });
});
