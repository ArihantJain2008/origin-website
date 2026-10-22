import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const schema = await readFile(new URL("../supabase/origin_features.sql", import.meta.url), "utf8");
const community = await readFile(new URL("../lib/api-handlers/community.ts", import.meta.url), "utf8");

test("download schema deduplicates each release per authenticated user or anonymous visitor", () => {
  assert.match(schema, /unique\s*\(version_id,\s*user_id\)/i);
  assert.match(schema, /unique\s*\(version_id,\s*visitor_id\)/i);
  assert.match(schema, /check\s*\(num_nonnulls\(user_id,\s*visitor_id\)\s*=\s*1\)/i);
  assert.match(schema, /p_event_type\s*=\s*'completed'\s+and\s+p_full_transfer/i);
  assert.match(schema, /insert into unique_downloads[\s\S]*?on conflict do nothing/i);
  assert.match(schema, /revoke all on function public\.record_download_event[\s\S]*?from public, anon, authenticated/i);
  assert.match(schema, /grant execute on function public\.record_download_event[\s\S]*?to service_role/i);
});

test("existing auth users receive profiles when the profile trigger is installed", () => {
  assert.match(schema, /insert into public\.profiles\(id,\s*display_name\)[\s\S]*?from auth\.users[\s\S]*?on conflict \(id\) do nothing/i);
});

test("public community reads filter out hidden and removed entries", () => {
  assert.match(community, /status:\s*"eq\.published"/);
  assert.match(schema, /create policy reviews_public_read[\s\S]*?status = 'published' or user_id = auth\.uid\(\)/i);
  assert.match(schema, /create policy comments_public_read[\s\S]*?status = 'published' or user_id = auth\.uid\(\)/i);
});

test("community updates and deletes constrain the database request to the authenticated owner", () => {
  assert.match(community, /new URLSearchParams\(\{ id: `eq\.\$\{id\}`, user_id: `eq\.\$\{session\.user\.id\}` \}\)/);
  assert.match(schema, /create policy reviews_update_own[\s\S]*?user_id = auth\.uid\(\)/i);
  assert.match(schema, /create policy comments_update_own[\s\S]*?user_id = auth\.uid\(\)/i);
});

test("partial response lengths and resumed byte ranges cannot count as full downloads", async () => {
  const source = await readFile(new URL("../api/_installers.js", import.meta.url), "utf8");
  const { default: ts } = await import("typescript");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const installers = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
  assert.equal(installers.isWholeInstallerTransfer(200, null, 499, 500), false);
  assert.equal(installers.isWholeInstallerTransfer(206, "bytes 500-999/1000", 500, 500), false);
  assert.equal(installers.isWholeInstallerTransfer(206, "bytes 0-999/1000", 1000, 1000), true);
});
