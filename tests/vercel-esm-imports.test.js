import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.(?:ts|js)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) files.push(path);
  }
  return files;
}

test("API and shared handler relative imports resolve as explicit ESM files", async () => {
  const files = [
    ...await sourceFiles(join(root, "api")),
    ...await sourceFiles(join(root, "lib", "api-handlers")),
  ];
  const unresolved = [];
  for (const file of files) {
    const source = ts.createSourceFile(file, await readFile(file, "utf8"), ts.ScriptTarget.Latest, true);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const specifier = statement.moduleSpecifier.text;
      if (!specifier.startsWith(".")) continue;
      if (![".js", ".mjs", ".cjs"].includes(extname(specifier))) {
        unresolved.push(`${file}: extensionless ESM import ${specifier}`);
        continue;
      }
      const target = resolve(dirname(file), specifier);
      const candidates = extname(target) === ".js" ? [target, target.slice(0, -3) + ".ts"] : [target];
      let found = false;
      for (const candidate of candidates) {
        try { await access(candidate); found = true; break; } catch { /* try the TypeScript source candidate */ }
      }
      if (!found) unresolved.push(`${file}: missing target for ${specifier}`);
    }
  }
  assert.deepEqual(unresolved, []);

  const accountSource = await readFile(join(root, "api", "account", "index.ts"), "utf8");
  assert.match(accountSource, /from "\.\.\/_account\.js"/);
});
