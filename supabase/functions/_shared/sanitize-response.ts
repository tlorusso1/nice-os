const sensitiveField = /^(?:access[_-]?token|refresh[_-]?token|client[_-]?secret|api[_-]?key|authorization|password|secret|token)$/i;

/** Never follow provider redirects or expose credential-bearing network errors. */
export async function fetchIntegration(input: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(input, { ...init, redirect: "error" });
  } catch {
    return new Response(JSON.stringify({ error: "Integration unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/** Remove credentials (including provider-generated paging tokens) before returning JSON. */
export function sanitizeResponseBody(body: string, secrets: string[] = []): string {
  const redactString = (value: string): string => {
    let sanitized = value.replace(
      /([?&](?:access_token|refresh_token|api_key|apikey|token|client_secret)=)[^&#\s"<>]*/gi,
      "$1[REDACTED]",
    );
    for (const secret of secrets.filter(Boolean)) {
      sanitized = sanitized.split(secret).join("[REDACTED]");
      sanitized = sanitized.split(encodeURIComponent(secret)).join("[REDACTED]");
    }
    return sanitized;
  };
  const sanitize = (value: unknown): unknown => {
    if (typeof value === "string") return redactString(value);
    if (Array.isArray(value)) return value.map(sanitize);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
        key, sensitiveField.test(key) ? "[REDACTED]" : sanitize(entry),
      ]));
    }
    return value;
  };
  try {
    return JSON.stringify(sanitize(JSON.parse(body)));
  } catch {
    // These proxies serve JSON APIs. Do not reflect unstructured provider errors.
    return JSON.stringify({ error: "Invalid upstream response" });
  }
}
