import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const INTERNAL_API_BASE_URL = (
  process.env.INTERNAL_API_BASE_URL ?? "http://127.0.0.1:8001/api"
).replace(/\/$/, "");

const AUTH_COOKIE_NAMES = new Set(["access_token", "refresh_token"]);

function buildCookieHeader() {
  const cookieStore = cookies();
  return cookieStore
    .getAll()
    .filter(({ name }) => AUTH_COOKIE_NAMES.has(name))
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
}

async function fetchSession() {
  const cookieHeader = buildCookieHeader();
  const response = await fetch(`${INTERNAL_API_BASE_URL}/auth/me`, {
    cache: "no-store",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data?.member ?? null;
}

export async function getSessionOrNull() {
  return fetchSession();
}

export async function getSessionOrRedirect() {
  const member = await fetchSession();
  if (!member) {
    redirect("/app/login");
  }

  return member;
}
