import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const apiDirectory = fileURLToPath(new URL("../api/", import.meta.url));

async function routableFunctions(directory, relative = "") {
  const files = await readdir(directory, { withFileTypes: true });
  const found = [];
  for (const file of files) {
    if (file.name.startsWith("_") || file.name.startsWith(".")) continue;
    const path = join(directory, file.name);
    if (file.isDirectory()) found.push(...await routableFunctions(path, join(relative, file.name)));
    else if (/\.(?:js|ts)$/.test(file.name) && !file.name.endsWith(".d.ts")) found.push(join(relative, file.name).replaceAll("\\", "/"));
  }
  return found;
}

test("Vercel deploys four API functions and shared handlers remain private", async () => {
  const functions = (await routableFunctions(apiDirectory)).sort();
  assert.deepEqual(functions, ["[...route].ts", "account/index.ts", "admin/[...route].ts", "download.ts"]);
  assert.ok(functions.length <= 8, `Expected at most 8 Vercel functions, found ${functions.length}`);
});

test("public and admin route groups dispatch every previously exposed endpoint", async () => {
  const publicRouter = await readFile(new URL("../api/[...route].ts", import.meta.url), "utf8");
  const adminRouter = await readFile(new URL("../api/admin/[...route].ts", import.meta.url), "utf8");
  for (const route of ["community", "downloads", "feedback", "installers"]) assert.match(publicRouter, new RegExp(`case "${route}"`));
  for (const route of ["audit", "community", "downloads", "feedback", "installers", "login", "logout", "me", "sessions", "users"]) assert.match(adminRouter, new RegExp(`case "${route}"`));
  assert.match(publicRouter, /req\.query\?\.route/);
  assert.match(adminRouter, /req\.query\?\.route/);
});
