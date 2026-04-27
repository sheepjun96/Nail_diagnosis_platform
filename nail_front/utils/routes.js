export const NEXT_BASE_PATH = (
  process.env.NEXT_PUBLIC_BASE_PATH ?? "/v2"
).replace(/\/$/, "");

export function withBasePath(path) {
  if (!path || path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (!NEXT_BASE_PATH || NEXT_BASE_PATH === "/" || path.startsWith(NEXT_BASE_PATH)) {
    return path;
  }

  return path.startsWith("/") ? `${NEXT_BASE_PATH}${path}` : `${NEXT_BASE_PATH}/${path}`;
}
