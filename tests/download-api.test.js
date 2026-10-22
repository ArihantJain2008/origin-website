import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const installersSource = await readFile(new URL("../api/_installers.js", import.meta.url), "utf8");
const installersModule = toModuleUrl(ts.transpileModule(installersSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const accountSource = await readFile(new URL("../api/_account.ts", import.meta.url), "utf8");
const accountModule = toModuleUrl(ts.transpileModule(accountSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
const downloadsSource = await readFile(new URL("../lib/api-handlers/downloads.ts", import.meta.url), "utf8");
let downloadsCode = ts.transpileModule(downloadsSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
downloadsCode = downloadsCode.replace('from "../../api/_installers.js"', `from "${installersModule}"`);
const downloadsModule = toModuleUrl(downloadsCode);
const downloadSource = await readFile(new URL("../api/download.ts", import.meta.url), "utf8");
let downloadCode = ts.transpileModule(downloadSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
downloadCode = downloadCode.replace('from "../lib/api-handlers/downloads.js"', `from "${downloadsModule}"`)
  .replace('from "./_installers.js"', `from "${installersModule}"`)
  .replace('from "./_account.js"', `from "${accountModule}"`);
const { default: handler } = await import(toModuleUrl(downloadCode));

function toModuleUrl(code) { return `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`; }

async function withEnvironment(run) {
  const previous = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SECRET_KEY, anon: process.env.SUPABASE_ANON_KEY, salt: process.env.RATE_LIMIT_SALT, fetch: globalThis.fetch };
  process.env.SUPABASE_URL = "https://unit-test.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "service-test-key";
  process.env.SUPABASE_ANON_KEY = "anon-test-key";
  process.env.RATE_LIMIT_SALT = "local-test-salt";
  try { await run(); }
  finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [["SUPABASE_URL", previous.url], ["SUPABASE_SECRET_KEY", previous.key], ["SUPABASE_ANON_KEY", previous.anon], ["RATE_LIMIT_SALT", previous.salt]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
}

function responseHarness({ disconnect = false } = {}) {
  const listeners = new Map();
  const emit = (event) => { for (const callback of listeners.get(event) ?? []) callback(); };
  const response = {
    statusCode: 0, headersSent: false, writableFinished: false, destroyed: false, headers: {}, body: null, chunks: [],
    status(code) { this.statusCode = code; this.headersSent = true; return this; },
    json(body) { this.body = body; this.headersSent = true; },
    setHeader(name, value) { this.headers[name] = value; },
    write(chunk) { this.chunks.push(Buffer.from(chunk)); this.headersSent = true; if (disconnect) queueMicrotask(() => { this.destroyed = true; emit("close"); }); return !disconnect; },
    end() { if (disconnect) { queueMicrotask(() => { this.destroyed = true; emit("close"); }); return; } this.writableFinished = true; queueMicrotask(() => emit("finish")); },
    on(event, callback) { const callbacks = listeners.get(event) ?? []; callbacks.push(callback); listeners.set(event, callbacks); },
    emitClose() { this.destroyed = true; emit("close"); },
  };
  return response;
}

async function runProxy({ status = 200, range, contentRange, contentLength, disconnect = false, disconnectDuringRead = false } = {}) {
  const calls = [];
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.includes("/rest/v1/installer_assets?")) return Response.json([{ source_url: "https://github.com/ArihantJain2008/origin/releases/download/v1/origin.exe", filename: "origin.exe", byte_size: 4 }]);
    if (url.includes("/rest/v1/rpc/record_download_event")) { calls.push(JSON.parse(init.body)); return new Response(null, { status: 204 }); }
    if (url.includes("github.com/ArihantJain2008/origin/releases/download")) {
      if (range) assert.equal(new Headers(init.headers).get("range"), range);
      const headers = new Headers();
      if (contentLength !== undefined) headers.set("content-length", String(contentLength));
      if (contentRange) headers.set("content-range", contentRange);
      const body = new ReadableStream({ start(controller) {
        if (disconnectDuringRead) { setTimeout(() => res.emitClose(), 1); return; }
        controller.enqueue(new TextEncoder().encode("data")); controller.close();
      } });
      return { status, url, headers, body };
    }
    throw new Error("Unexpected test request");
  };
  const res = responseHarness({ disconnect });
  await handler({ method: "GET", headers: { ...(range ? { range } : {}) }, query: { asset: "24c2d90b-7b2e-4d76-a960-bbbf2238c229" } }, res);
  return { calls, res };
}

test("proxy counts whole responses, full-file ranges, and unknown-length full streams", async () => {
  await withEnvironment(async () => {
    for (const options of [{ status: 200, contentLength: 4 }, { status: 200 }, { status: 206, range: "bytes=0-3", contentRange: "bytes 0-3/4", contentLength: 4 }]) {
      const { calls } = await runProxy(options);
      assert.deepEqual(calls.map((call) => call.p_event_type), ["requested", "completed"]);
      assert.equal(calls[1].p_full_transfer, true);
    }
  });
});

test("proxy records resumed partial responses as completed but not full downloads", async () => {
  await withEnvironment(async () => {
    const { calls } = await runProxy({ status: 206, range: "bytes=4-7", contentRange: "bytes 4-7/8", contentLength: 4 });
    assert.equal(calls.at(-1).p_event_type, "completed");
    assert.equal(calls.at(-1).p_full_transfer, false);
  });
});

test("proxy records a disconnected backpressured stream as interrupted", async () => {
  await withEnvironment(async () => {
    const { calls, res } = await runProxy({ contentLength: 4, disconnect: true });
    assert.deepEqual(calls.map((call) => call.p_event_type), ["requested", "interrupted"]);
    assert.equal(calls[1].p_byte_count, 4);
    assert.equal(res.writableFinished, false);
  });
});

test("proxy records a client disconnect while the upstream body is still pending", async () => {
  await withEnvironment(async () => {
    const { calls, res } = await runProxy({ disconnectDuringRead: true });
    assert.deepEqual(calls.map((call) => call.p_event_type), ["requested", "interrupted"]);
    assert.equal(calls[1].p_byte_count, 0);
    assert.equal(res.destroyed, true);
  });
});
