import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const enabled = process.env.ORIGIN_SUPABASE_ENV === "development"
  && process.env.ORIGIN_DEV_CONFIRM_NAME === "origin-development"
  && process.env.ORIGIN_RUN_SUPABASE_INTEGRATION === "1";
const projectRef = process.env.ORIGIN_DEV_PROJECT_REF ?? "";
const supabaseUrl = process.env.ORIGIN_DEV_SUPABASE_URL ?? "";
const anonKey = process.env.ORIGIN_DEV_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.ORIGIN_DEV_SUPABASE_SERVICE_ROLE_KEY ?? "";

test("development Supabase RLS, moderation visibility, and concurrent download deduplication", { skip: !enabled }, async () => {
  assert.ok(/^[a-z0-9]{15,30}$/.test(projectRef), "Set the development project's reference id.");
  assert.equal(new URL(supabaseUrl).hostname, `${projectRef}.supabase.co`, "The URL must match the explicitly named development project.");
  assert.ok(anonKey && serviceKey, "Development Supabase keys are required.");

  const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };
  const anonHeaders = { apikey: anonKey, "Content-Type": "application/json" };
  const createdUsers = [];
  let versionId = "";
  let assetId = "";
  const admin = async (path, init = {}) => fetch(`${supabaseUrl}${path}`, { ...init, headers: { ...serviceHeaders, ...(init.headers ?? {}) } });
  const userRequest = async (token, path, init = {}) => fetch(`${supabaseUrl}${path}`, { ...init, headers: { apikey: anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const createUser = async (label) => {
    const email = `origin-test-${randomUUID()}@example.invalid`;
    const password = `T-${randomUUID()}-aA9!`;
    const response = await admin("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { display_name: label } }) });
    assert.equal(response.ok, true, "Could not create a disposable test user.");
    const user = await response.json();
    createdUsers.push(user.id);
    const login = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, { method: "POST", headers: anonHeaders, body: JSON.stringify({ email, password }) });
    assert.equal(login.ok, true, "Could not sign in a disposable test user.");
    return { id: user.id, token: (await login.json()).access_token };
  };
  try {
    const first = await createUser("integration-owner");
    const second = await createUser("integration-other-user");
    const applications = await admin("/rest/v1/applications?slug=eq.origin&select=id&limit=1");
    assert.equal(applications.ok, true, "The origin application fixture is missing.");
    const [application] = await applications.json();
    assert.ok(application?.id, "The origin application fixture is missing.");

    const versionResponse = await admin("/rest/v1/application_versions", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ application_id: application.id, version: `integration-${randomUUID()}`, release_url: "https://github.com/ArihantJain2008/origin/releases/tag/integration-test" }) });
    assert.equal(versionResponse.ok, true, "Could not create a disposable release fixture.");
    versionId = (await versionResponse.json())[0].id;
    const assetResponse = await admin("/rest/v1/installer_assets", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ version_id: versionId, platform: "windows", filename: "origin-integration.exe", source_url: "https://github.com/ArihantJain2008/origin/releases/download/integration-test/origin-integration.exe", active: true }) });
    assert.equal(assetResponse.ok, true, "Could not create a disposable installer fixture.");
    assetId = (await assetResponse.json())[0].id;

    const reviewResponse = await userRequest(first.token, "/rest/v1/reviews", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ application_id: application.id, user_id: first.id, rating: 5, body: "RLS integration fixture" }) });
    assert.equal(reviewResponse.ok, true, "Owner could not create a review.");
    const reviewId = (await reviewResponse.json())[0].id;

    const wrongOwner = await userRequest(second.token, `/rest/v1/reviews?id=eq.${reviewId}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ body: "unauthorized change" }) });
    assert.equal(wrongOwner.ok, true);
    assert.deepEqual(await wrongOwner.json(), [], "A different user must not update the review.");

    await assertModerationVisibility(reviewId, first.token, admin, anonHeaders, supabaseUrl);

    const interrupted = await admin("/rest/v1/rpc/record_download_event", { method: "POST", body: JSON.stringify({ p_asset_id: assetId, p_identity_hash: null, p_user_id: first.id, p_event_type: "interrupted", p_request_id: randomUUID(), p_byte_count: 128, p_http_status: 200, p_user_agent: "integration-test", p_full_transfer: false }) });
    assert.equal(interrupted.ok, true, "Could not record an interrupted transfer.");
    const beforeCompletion = await admin(`/rest/v1/unique_downloads?version_id=eq.${versionId}&select=version_id`);
    assert.deepEqual(await beforeCompletion.json(), [], "Interrupted transfers must not count as downloads.");

    const completions = await Promise.all(Array.from({ length: 12 }, () => admin("/rest/v1/rpc/record_download_event", { method: "POST", body: JSON.stringify({ p_asset_id: assetId, p_identity_hash: null, p_user_id: first.id, p_event_type: "completed", p_request_id: randomUUID(), p_byte_count: 4096, p_http_status: 200, p_user_agent: "integration-test", p_full_transfer: true }) })));
    assert.ok(completions.every((response) => response.ok), "Concurrent completed events must be accepted.");
    const counts = await admin(`/rest/v1/unique_downloads?version_id=eq.${versionId}&select=version_id,user_id`);
    const counted = await counts.json();
    assert.equal(counted.length, 1, "Concurrent requests by one user must create one unique download.");
    assert.equal(counted[0].user_id, first.id);
  } finally {
    if (assetId) await admin(`/rest/v1/download_events?asset_id=eq.${assetId}`, { method: "DELETE" });
    if (createdUsers.length) await admin(`/auth/v1/admin/users/${createdUsers[0]}`, { method: "DELETE" });
    if (createdUsers.length > 1) await admin(`/auth/v1/admin/users/${createdUsers[1]}`, { method: "DELETE" });
    if (assetId) await admin(`/rest/v1/installer_assets?id=eq.${assetId}`, { method: "DELETE" });
    if (versionId) await admin(`/rest/v1/application_versions?id=eq.${versionId}`, { method: "DELETE" });
  }
});

async function assertModerationVisibility(reviewId, ownerToken, admin, anonHeaders, supabaseUrl) {
  const hide = await admin(`/rest/v1/reviews?id=eq.${reviewId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "hidden" }) });
  assert.equal(hide.ok, true, "Service role could not moderate the review.");
  const publicRead = await fetch(`${supabaseUrl}/rest/v1/reviews?id=eq.${reviewId}&select=id`, { headers: anonHeaders });
  assert.equal(publicRead.ok, true);
  assert.deepEqual(await publicRead.json(), [], "Hidden reviews must not be visible publicly.");
  const ownerRead = await fetch(`${supabaseUrl}/rest/v1/reviews?id=eq.${reviewId}&select=id`, { headers: { apikey: anonHeaders.apikey, Authorization: `Bearer ${ownerToken}` } });
  assert.equal(ownerRead.ok, true);
  assert.equal((await ownerRead.json()).length, 1, "The author should retain access to their own hidden review.");
}
