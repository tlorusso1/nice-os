import { supabase } from '@/integrations/supabase/client';

/** Integration credentials stay on the server. The browser sends its user session. */
const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export function apiBase(service: string): string {
  if (!/^[a-z0-9-]+$/.test(service)) throw new Error('Serviço inválido');
  return import.meta.env.DEV ? `/api/${service}` : `${SUPABASE_FUNCTIONS_URL}/proxy-${service}`;
}

export async function proxyFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const requestUrl = typeof input === 'string' ? input : input instanceof Request ? input.url : input.href;
  if (!requestUrl.startsWith(`${SUPABASE_FUNCTIONS_URL}/`)) return fetch(input, init);

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error('Sessão necessária para consultar esta integração');
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  headers.set('apikey', SUPABASE_PUBLISHABLE_KEY);
  headers.set('Authorization', `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}
