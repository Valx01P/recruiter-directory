// gte-server base URL + typed fetch helpers. All auth/connection calls send the
// session cookie via credentials:"include". Dev falls back to localhost; in prod
// an unset URL stays "" (same-origin) so we never poke the visitor's localhost.
export const GTE_BASE =
  process.env.NEXT_PUBLIC_GTE_SERVER_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:8787" : "");

export type User = { id: string; email: string; name: string | null; picture: string | null };

async function jpost(path: string, body?: unknown) {
  const r = await fetch(GTE_BASE + path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `HTTP ${r.status}`);
  return data;
}

async function jget(path: string) {
  const r = await fetch(GTE_BASE + path, { credentials: "include" });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error || `HTTP ${r.status}`);
  return data;
}

export const api = {
  me: () => jget("/auth/me") as Promise<{ user: User | null }>,
  register: (email: string, password: string, name?: string) =>
    jpost("/auth/register", { email, password, name }) as Promise<{ user: User }>,
  login: (email: string, password: string) =>
    jpost("/auth/login", { email, password }) as Promise<{ user: User }>,
  google: (credential: string) => jpost("/auth/google", { credential }) as Promise<{ user: User }>,
  logout: () => jpost("/auth/logout") as Promise<{ ok: boolean }>,
  getConnections: () => jget("/connections") as Promise<{ keys: string[] }>,
  setConnection: (key: string, connected: boolean) =>
    jpost("/connections", { key, connected }) as Promise<{ ok: boolean }>,
  mergeConnections: (keys: string[]) => jpost("/connections/merge", { keys }) as Promise<{ keys: string[] }>,
};
