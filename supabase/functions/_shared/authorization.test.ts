import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { authorizeAdmin, isBlingSyncRead } from "./authorization.ts";
import type { AuthorizationDependencies } from "./authorization.ts";
import { fetchIntegration, sanitizeResponseBody } from "./sanitize-response.ts";

const request = (token?: string, suffix = "", method = "GET") => new Request(
  `https://local.invalid/functions/v1/proxy-bling/nfe${suffix}`,
  { method, headers: token ? { Authorization: `Bearer ${token}` } : {} },
);
const allowed: AuthorizationDependencies = {
  getUser: async () => ({ id: "verified-user" }),
  getRoles: async () => ["admin"],
};

test("missing, apikey-only and malformed authorization are rejected before lookup", async () => {
  const deps = { ...allowed, getUser: async () => { throw new Error("should not run"); } };
  const cases: HeadersInit[] = [{}, { apikey: "public-key" }, { Authorization: "Basic fake" }, { Authorization: "Bearer a b" }];
  for (const headers of cases) {
    const result = await authorizeAdmin(new Request("https://local.invalid", { headers }), deps);
    assert.deepEqual(result, { authorized: false, status: 401, error: "Unauthorized" });
  }
});

test("invalid, expired, public and anonymous user tokens cannot authenticate", async () => {
  for (const user of [null, { id: "" }, { id: "anonymous", is_anonymous: true }]) {
    const result = await authorizeAdmin(request("invalid-or-public"), { ...allowed, getUser: async () => user });
    assert.equal(result.authorized, false);
    if (!result.authorized) assert.equal(result.status, 401);
  }
});

test("missing and non-admin roles are forbidden", async () => {
  for (const roles of [[], ["marketing"], ["operacional"], ["comercial"], ["owner"], ["ADMIN"]]) {
    assert.deepEqual(await authorizeAdmin(request("valid-session"), { ...allowed, getRoles: async () => roles }),
      { authorized: false, status: 403, error: "Forbidden" });
  }
});

test("a verified session and explicit admin role are required together", async () => {
  assert.deepEqual(await authorizeAdmin(request("valid-session"), allowed), { authorized: true, principal: "user" });
});

test("client-supplied user, role or CNPJ does not select authorization identity", async () => {
  const req = new Request("https://local.invalid/functions/v1/proxy-asaas?user_id=other-user&role=admin&cnpj=other-company", {
    method: "POST",
    headers: { Authorization: "Bearer limited-session", "Content-Type": "application/json", "X-User-Id": "other-user" },
    body: JSON.stringify({ user_id: "other-user", role: "admin", tenant_id: "other-tenant" }),
  });
  let checkedUser = "";
  const result = await authorizeAdmin(req, {
    getUser: async (token) => { assert.equal(token, "limited-session"); return { id: "verified-user" }; },
    getRoles: async (userId, token) => { checkedUser = userId; assert.equal(token, "limited-session"); return []; },
  });
  assert.equal(checkedUser, "verified-user");
  assert.deepEqual(result, { authorized: false, status: 403, error: "Forbidden" });
});

test("Auth and role lookup failures deny access without returning secrets", async () => {
  for (const step of ["getUser", "getRoles"] as const) {
    const result = await authorizeAdmin(request("private-token"), {
      ...allowed, [step]: async () => { throw new Error("provider private-token secret"); },
    });
    assert.deepEqual(result, { authorized: false, status: 503, error: "Authorization unavailable" });
    assert.doesNotMatch(JSON.stringify(result), /private-token|provider|secret/);
  }
});

test("service auth is opt-in, exact-match and never enabled by an empty key", async () => {
  const serviceOnly = { ...allowed, getUser: async () => null, serviceRoleKey: "server-only-test-credential" };
  assert.equal((await authorizeAdmin(request("server-only-test-credential"), serviceOnly)).authorized, false);
  assert.deepEqual(await authorizeAdmin(request("server-only-test-credential"), { ...serviceOnly, allowServiceRole: true }),
    { authorized: true, principal: "service" });
  assert.equal((await authorizeAdmin(request("forged-role-claim"), { ...serviceOnly, allowServiceRole: true })).authorized, false);
  assert.equal((await authorizeAdmin(request("anything"), { ...serviceOnly, serviceRoleKey: "", allowServiceRole: true })).authorized, false);
});

test("service access stays limited to existing Bling synchronization reads", () => {
  for (const path of ["/lojas", "/pedidos/vendas", "/nfe", "/nfe/123"]) {
    for (const prefix of ["/proxy-bling", "/functions/v1/proxy-bling"]) {
      assert.equal(isBlingSyncRead(new Request(`https://local.invalid${prefix}${path}?pagina=1`)), true);
    }
  }
  for (const path of ["/oauth/token", "/contas-bancarias", "/nfe/not-numeric", "/nfe/123/delete", "/other/nfe"]) {
    assert.equal(isBlingSyncRead(new Request(`https://local.invalid/functions/v1/proxy-bling${path}`)), false);
  }
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD"]) assert.equal(isBlingSyncRead(request("service", "", method)), false);
});

test("proxy and user-management guards precede privileged work", () => {
  for (const name of ["proxy-asaas", "proxy-tiny", "proxy-meta", "proxy-nuvemshop", "proxy-perfit", "proxy-bling", "create-user"]) {
    const source = readFileSync(new URL(`../${name}/index.ts`, import.meta.url), "utf8");
    const handler = source.slice(source.indexOf("serve(async"));
    const guard = handler.indexOf("await requireAdmin(");
    assert.ok(guard >= 0, `${name} has no guard`);
    const privileged = name === "create-user" ? handler.indexOf("auth.admin.createUser") : handler.indexOf("fetchIntegration(");
    assert.ok(guard < privileged, `${name} privileged work precedes guard`);
    if (name !== "proxy-bling") assert.doesNotMatch(handler, /allowServiceRole/);
  }
});

test("responses redact sensitive JSON fields, paging URLs and known credentials", () => {
  const payload = JSON.stringify({
    data: [{ id: "1", access_token: "page-credential", refreshToken: "refresh-credential", amount: 42 }],
    paging: { next: "https://provider.invalid/next?access_token=paging-credential&after=cursor" },
    note: "echo server-only-value", encoded: "server%2Bkey", count: 3,
  });
  const safe = sanitizeResponseBody(payload, ["server-only-value", "server+key", ""]);
  assert.doesNotMatch(safe, /page-credential|refresh-credential|paging-credential|server-only-value|server%2Bkey/);
  assert.equal(JSON.parse(safe).data[0].amount, 42);
  assert.equal(JSON.parse(safe).count, 3);
  assert.doesNotMatch(sanitizeResponseBody("provider echoed unknown-secret"), /unknown-secret/);
});

test("credential fragments and raw refresh responses are absent from integration logs", () => {
  const nuvemshop = readFileSync(new URL("../proxy-nuvemshop/index.ts", import.meta.url), "utf8");
  const bling = readFileSync(new URL("../proxy-bling/index.ts", import.meta.url), "utf8");
  assert.doesNotMatch(nuvemshop, /tokenPrefix|NS_TOKEN\.slice/);
  assert.doesNotMatch(bling, /console\.error\([^;]*res\.text\(/s);
});


test("network failures do not leak credential-bearing URLs and redirects are refused", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (_input, init) => {
      assert.equal(init?.redirect, "error");
      throw new Error("connection failed: https://provider.invalid?token=private-credential");
    };
    const response = await fetchIntegration("https://provider.invalid?token=private-credential");
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), { error: "Integration unavailable" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("upstream credential failures are not successful empty business data", () => {
  for (const name of ["proxy-bling", "proxy-nuvemshop"]) {
    const source = readFileSync(new URL(`../${name}/index.ts`, import.meta.url), "utf8");
    assert.match(source, /status: 502/);
    assert.doesNotMatch(source, /status: 200/);
    assert.doesNotMatch(source, /data: \[\]/);
  }
});
