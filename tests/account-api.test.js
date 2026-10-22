import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

function moduleUrl(source) { return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`; }
const helperSource = await readFile(new URL("../api/_account.ts", import.meta.url), "utf8");
const helperUrl = moduleUrl(ts.transpileModule(helperSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const routeSource = await readFile(new URL("../api/account/index.ts", import.meta.url), "utf8");
const routeCode = ts.transpileModule(routeSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace('from "../_account.js"', `from "${helperUrl}"`);
const { default: handler } = await import(moduleUrl(routeCode));

async function withEnv(fetcherOrRun, maybeRun) {
  const previous = { url: process.env.SUPABASE_URL, anon: process.env.SUPABASE_ANON_KEY, service: process.env.SUPABASE_SECRET_KEY, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.SUPABASE_ANON_KEY = "anon-test-key";
  process.env.SUPABASE_SECRET_KEY = "service-test-key";
  if (maybeRun) globalThis.fetch = fetcherOrRun;
  const run = maybeRun ?? fetcherOrRun;
  try { await run(); }
  finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [["SUPABASE_URL", previous.url], ["SUPABASE_ANON_KEY", previous.anon], ["SUPABASE_SECRET_KEY", previous.service]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}

function harness() {
  const res = { headers: {}, statusCode: 0, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; }, setHeader(name, value) { this.headers[name] = value; } };
  const req = { method: "POST", query: {}, headers: { origin: "https://origin.test", host: "origin.test" } };
  return { req, res };
}

test("registration validates password strength before making a Supabase request", async () => {
  await withEnv(async () => {
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error("No Auth request expected"); };
    const { req, res } = harness();
    req.query.op = "register";
    req.body = { email: "new@example.test", password: "short", displayName: "New User" };
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(calls, 0);
  });
});

test("valid registration sends display-name metadata and returns credentials only as cookies", async () => {
  await withEnv(async (input, init = {}) => {
    const url = String(input);
    assert.match(url, /signup\?redirect_to=/);
    assert.equal(new URL(url).searchParams.get("redirect_to"), "https://origin.test/account?verified=1");
    assert.equal(JSON.parse(init.body).data.display_name, "New User");
    return Response.json({ access_token: "registration-access", refresh_token: "registration-refresh", expires_in: 3600 });
  }, async () => {
    const { req, res } = harness();
    req.query.op = "register";
    req.body = { email: "new@example.test", password: "a-secure-test-password", displayName: "New User" };
    await handler(req, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.headers["Set-Cookie"].length, 2);
    assert.ok(!JSON.stringify(res.body).includes("registration-access"));
  });
});

test("login stores Supabase credentials in HttpOnly cookies and logout clears them despite Auth outage", async () => {
  await withEnv(async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);
      if (url.includes("token?grant_type=password")) return Response.json({ access_token: "access-test", refresh_token: "refresh-test", expires_in: 3600 });
      if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-test", email: "member@example.test" });
      if (url.includes("/rest/v1/profiles?")) return Response.json([{ suspended_at: null }]);
      if (url.endsWith("/auth/v1/logout")) throw new Error("simulated auth service outage");
      throw new Error("Unexpected test request");
    };
    const login = harness();
    login.req.query.op = "login";
    login.req.body = { email: "member@example.test", password: "a-long-test-password" };
    await handler(login.req, login.res);
    assert.equal(login.res.statusCode, 200);
    assert.equal(login.res.headers["Set-Cookie"].length, 2);
    assert.ok(login.res.headers["Set-Cookie"].every((cookie) => cookie.includes("HttpOnly; Secure; SameSite=Lax")));
    assert.ok(!JSON.stringify(login.res.body).includes("access-test"));

    const logout = harness();
    logout.req.query.op = "logout";
    logout.req.headers.cookie = "origin_user_access=access-test; origin_user_refresh=refresh-test";
    await handler(logout.req, logout.res);
    assert.equal(logout.res.statusCode, 200);
    assert.ok(logout.res.headers["Set-Cookie"].every((cookie) => cookie.includes("Max-Age=0")));
  });
});

test("email recovery responds generically when Supabase rejects the request", async () => {
  await withEnv(async () => {
    globalThis.fetch = async () => new Response(null, { status: 400 });
    const { req, res } = harness();
    req.query.op = "recover";
    req.body = { email: "member@example.test" };
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.match(res.body.message, /If an account matches/);
  });
});

test("email changes use the account callback and email-change verification tokens are accepted", async () => {
  await withEnv(async () => {
    let emailRedirect = "";
    let verificationType = "";
    globalThis.fetch = async (input, init = {}) => {
      const url = String(input);
      if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-test", email: "member@example.test" });
      if (url.includes("/rest/v1/profiles?")) return Response.json([{ suspended_at: null }]);
      if (url.includes("/auth/v1/user?redirect_to=")) { emailRedirect = new URL(url).searchParams.get("redirect_to"); return Response.json({}); }
      if (url.endsWith("/auth/v1/verify")) { verificationType = JSON.parse(init.body).type; return Response.json({}); }
      throw new Error("Unexpected test request");
    };

    const emailChange = harness();
    emailChange.req.query.op = "email";
    emailChange.req.headers.cookie = "origin_user_access=access-test";
    emailChange.req.body = { email: "next@example.test" };
    await handler(emailChange.req, emailChange.res);
    assert.equal(emailChange.res.statusCode, 200);
    assert.equal(emailRedirect, "https://origin.test/account");

    const verification = harness();
    verification.req.query.op = "verify";
    verification.req.body = { token_hash: "0123456789abcdefghijklmn", type: "email_change" };
    await handler(verification.req, verification.res);
    assert.equal(verification.res.statusCode, 200);
    assert.equal(verificationType, "email_change");
    assert.match(verification.res.body.message, /email address has been updated/i);
  });
});

test("password changes require an active account and send the new password only to Supabase Auth", async () => {
  await withEnv(async (input, init = {}) => {
    const url = String(input);
    if (url.includes("/auth/v1/user") && init.method === "PUT") {
      assert.equal(JSON.parse(init.body).password, "brand-new-test-password");
      assert.equal(new Headers(init.headers).get("Authorization"), "Bearer access-test");
      return Response.json({});
    }
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-test", email: "member@example.test" });
    if (url.includes("/rest/v1/profiles?")) return Response.json([{ suspended_at: null }]);
    throw new Error("Unexpected test request");
  }, async () => {
    const { req, res } = harness();
    req.query.op = "password";
    req.headers.cookie = "origin_user_access=access-test";
    req.body = { password: "brand-new-test-password" };
    await handler(req, res);
    assert.equal(res.statusCode, 200);
  });
});

test("authenticated download history is scoped to the current user and full completed transfers", async () => {
  await withEnv(async (input) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-test", email: "member@example.test" });
    if (url.includes("/rest/v1/profiles?")) return Response.json([{ id: "user-test", display_name: "Member", created_at: "2026-01-01T00:00:00Z", suspended_at: null }]);
    if (url.includes("/rest/v1/download_events?")) {
      const query = new URL(url).searchParams;
      assert.equal(query.get("user_id"), "eq.user-test");
      assert.equal(query.get("event_type"), "eq.completed");
      assert.equal(query.get("full_transfer"), "eq.true");
      return Response.json([]);
    }
    throw new Error("Unexpected test request");
  }, async () => {
    const { req, res } = harness();
    req.method = "GET";
    req.query.op = "me";
    req.headers.cookie = "origin_user_access=access-test";
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body.downloads, []);
  });
});

test("account deletion uses the service credential only on the server and clears cookies", async () => {
  await withEnv(async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith("/auth/v1/user")) return Response.json({ id: "user-test", email: "member@example.test" });
    if (url.includes("/rest/v1/profiles?")) return Response.json([{ suspended_at: null }]);
    if (url.endsWith("/auth/v1/admin/users/user-test")) {
      assert.equal(init.method, "DELETE");
      assert.equal(new Headers(init.headers).get("Authorization"), "Bearer service-test-key");
      return new Response(null, { status: 204 });
    }
    throw new Error("Unexpected test request");
  }, async () => {
    const { req, res } = harness();
    req.query.op = "delete";
    req.headers.cookie = "origin_user_access=access-test";
    req.body = {};
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.ok(res.headers["Set-Cookie"].every((cookie) => cookie.includes("Max-Age=0")));
  });
});

test("account login rate limits repeated attempts for one client address", async () => {
  await withEnv(async () => {
    let authAttempts = 0;
    globalThis.fetch = async () => { authAttempts++; return new Response(null, { status: 401 }); };
    let finalStatus = 0;
    for (let attempt = 0; attempt < 9; attempt++) {
      const { req, res } = harness();
      req.query.op = "login";
      req.headers["x-forwarded-for"] = "192.0.2.203";
      req.body = { email: "member@example.test", password: "password" };
      await handler(req, res);
      finalStatus = res.statusCode;
    }
    assert.equal(finalStatus, 429);
    assert.equal(authAttempts, 8);
  });
});
