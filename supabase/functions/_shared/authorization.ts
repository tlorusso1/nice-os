export type AuthorizationResult =
  | { authorized: true; principal: "user" | "service" }
  | { authorized: false; status: 401 | 403 | 503; error: string };

export interface AuthorizationDependencies {
  /** Must validate the token with Supabase Auth, never just decode its claims. */
  getUser: (token: string) => Promise<{ id: string; is_anonymous?: boolean } | null>;
  getRoles: (userId: string, token: string) => Promise<string[]>;
  serviceRoleKey?: string;
  allowServiceRole?: boolean;
}

/** Pure decision logic. Missing roles and unavailable authorization fail closed. */
export async function authorizeAdmin(
  request: Request,
  dependencies: AuthorizationDependencies,
): Promise<AuthorizationResult> {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.get("Authorization") ?? "");
  if (!match) return { authorized: false, status: 401, error: "Unauthorized" };
  const token = match[1];

  // Only callers explicitly opting in may accept the existing server credential.
  // Never trust a client-supplied role claim or an apikey header as user identity.
  if (dependencies.allowServiceRole && dependencies.serviceRoleKey && token === dependencies.serviceRoleKey) {
    return { authorized: true, principal: "service" };
  }

  try {
    const user = await dependencies.getUser(token);
    if (!user?.id || user.is_anonymous) {
      return { authorized: false, status: 401, error: "Unauthorized" };
    }
    const roles = await dependencies.getRoles(user.id, token);
    if (!roles.includes("admin")) {
      return { authorized: false, status: 403, error: "Forbidden" };
    }
    return { authorized: true, principal: "user" };
  } catch {
    // Do not return provider errors, request headers or credentials to callers.
    return { authorized: false, status: 503, error: "Authorization unavailable" };
  }
}

/** Existing sync-vendas service calls need only these read-only Bling resources. */
export function isBlingSyncRead(request: Request): boolean {
  if (request.method !== "GET") return false;
  const path = new URL(request.url).pathname
    .replace(/^\/functions\/v1\/proxy-bling(?=\/|$)/, "")
    .replace(/^\/proxy-bling(?=\/|$)/, "");
  return /^\/(?:lojas|pedidos\/vendas|nfe(?:\/\d+)?)$/.test(path);
}
