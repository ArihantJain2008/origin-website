import test from "node:test";
import assert from "node:assert/strict";
import { fetchOfficialInstaller, isUuid, isValidOfficialAsset, isValidOfficialRelease, isWholeInstallerTransfer, waitForDrainOrClose } from "../api/_installers.js";

test("accepts valid UUID asset identifiers and rejects malformed values", () => {
  assert.equal(isUuid("24c2d90b-7b2e-4d76-a960-bbbf2238c229"), true);
  assert.equal(isUuid("not-a-uuid"), false);
  assert.equal(isUuid(undefined), false);
});

test("release registration accepts only the canonical Origin release URL", () => {
  assert.equal(isValidOfficialRelease("v1.2.0", "https://github.com/ArihantJain2008/origin/releases/tag/v1.2.0"), true);
  assert.equal(isValidOfficialRelease("v1.2.0", "https://github.com.evil.test/ArihantJain2008/origin/releases/tag/v1.2.0"), false);
  assert.equal(isValidOfficialRelease("v1.2.0", "https://example.com/releases/tag/v1.2.0"), false);
});

test("asset registration rejects arbitrary URLs, paths, extensions, and unsafe sizes", () => {
  const good = { platform: "windows", name: "Origin_1.2.0_x64-setup.exe", url: "https://github.com/ArihantJain2008/origin/releases/download/v1.2.0/Origin_1.2.0_x64-setup.exe", size: 100 };
  assert.equal(isValidOfficialAsset("v1.2.0", good), true);
  assert.equal(isValidOfficialAsset("v1.2.0", { ...good, url: "https://evil.example/file.exe" }), false);
  assert.equal(isValidOfficialAsset("v1.2.0", { ...good, name: "installer.exe", url: "https://github.com/ArihantJain2008/origin/releases/download/v1.2.0/installer.exe" }), false);
  assert.equal(isValidOfficialAsset("v1.2.0", { ...good, size: -1 }), false);
});

test("only a whole response or whole-file range qualifies as a full installer transfer", () => {
  assert.equal(isWholeInstallerTransfer(200, null, 100, 100), true);
  assert.equal(isWholeInstallerTransfer(200, null, 99, 100), false);
  assert.equal(isWholeInstallerTransfer(206, "bytes 0-99/100", 100, 100), true);
  assert.equal(isWholeInstallerTransfer(206, "bytes 0-49/100", 50, 50), false);
  assert.equal(isWholeInstallerTransfer(206, "bytes 50-99/100", 50, 50), false);
});

test("a completed full response without Content-Length can still qualify", () => {
  assert.equal(isWholeInstallerTransfer(200, null, 2048, Number.NaN), true);
  assert.equal(isWholeInstallerTransfer(206, "bytes 0-2047/4096", 2048, Number.NaN), false);
});

test("installer redirects are validated before each destination request", async () => {
  const requested = [];
  const fetcher = async (url, options) => {
    requested.push({ url, redirect: options.redirect });
    if (url.includes("github.com/")) return new Response(null, { status: 302, headers: { location: "https://release-assets.githubusercontent.com/download/file?signature=test" } });
    return new Response("installer", { status: 200 });
  };
  const response = await fetchOfficialInstaller("https://github.com/ArihantJain2008/origin/releases/download/v1/origin.exe", { method: "GET" }, fetcher);
  assert.equal(response.status, 200);
  assert.equal(requested.length, 2);
  assert.ok(requested.every((item) => item.redirect === "manual"));

  const unsafeRequests = [];
  await assert.rejects(fetchOfficialInstaller("https://github.com/ArihantJain2008/origin/releases/download/v1/origin.exe", { method: "GET" }, async (url) => {
    unsafeRequests.push(url);
    return new Response(null, { status: 302, headers: { location: "https://attacker.example/payload" } });
  }));
  assert.equal(unsafeRequests.length, 1, "The untrusted redirect destination must never be requested.");
});

test("client disconnect while backpressured is distinguished from a writable response", async () => {
  const listeners = new Map();
  const response = { writableFinished: false, on(event, callback) { listeners.set(event, callback); } };
  const result = waitForDrainOrClose(response);
  listeners.get("close")();
  assert.equal(await result, false);

  const finished = { writableFinished: true, on(event, callback) { listeners.set(event, callback); } };
  const finishedResult = waitForDrainOrClose(finished);
  listeners.get("close")();
  assert.equal(await finishedResult, true);
});
