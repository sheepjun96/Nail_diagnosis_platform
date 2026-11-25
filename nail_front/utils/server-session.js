import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const INTERNAL_API_BASE_URL = (
  process.env.INTERNAL_API_BASE_URL ?? "http://127.0.0.1:8001/api"
).replace(/\/$/, "");

async function buildCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore.getAll()
    .filter(({ name }) => name === "access_token" || name === "refresh_token")
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
}

async function fetchInternal(path, options = {}) {
  try {
    const response = await fetch(`${INTERNAL_API_BASE_URL}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      ...options,
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function getAuthConfig() {
  return fetchInternal("/auth/config");
}

export async function getSessionOrNull() {
  const cookie = await buildCookieHeader();
  if (!cookie) return null;
  const data = await fetchInternal("/auth/me", { headers: { cookie } });
  return data?.member ?? null;
}

export async function getSessionOrRedirect() {
  const member = await getSessionOrNull();
  if (!member) redirect("/app/login");
  return member;
}
